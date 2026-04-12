/**
 * Batch TTS generator for Supabase pairs (MULTI-DECK).
 *
 * - Uses Google Cloud Text-to-Speech
 * - Uploads MP3s to Supabase Storage bucket: "tts"
 * - Writes public URLs back to pairs table:
 *    - word_target_audio_url
 *    - sentence_target_audio_url
 *
 * SAFE / RESUME-FRIENDLY:
 * - By default: only generates audio if URL is missing
 * - Processes in pages
 * - Rate-limits requests
 * - Retries with backoff on Google quota errors (RESOURCE_EXHAUSTED)
 *
 * IMPORTANT:
 * - Collision-proof storage keys:
 *    <lang>/word/<pairId>.mp3
 *    <lang>/sentence/<pairId>.mp3
 *
 * NEW:
 * - cleanForTTS(): turns "X/Y" into "X, Y" so slash is a short pause
 * - --onlySlash true : process ONLY rows where word_target or sentence_target contains "/"
 * - --force true     : regenerate even if audio URL exists (overwrites mp3 via upsert)
 */

require("dotenv").config({ path: ".env.local" });

const textToSpeech = require("@google-cloud/text-to-speech");
const { createClient } = require("@supabase/supabase-js");

// ---- ENV ----
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BUCKET = "tts";

// Defaults (can be overridden by CLI args)
const DEFAULT_TARGET_LOCALE = "es-ES";
const DEFAULT_VOICE_NAME = "es-ES-Chirp-HD-F";
const DEFAULT_SPEAKING_RATE = 1.0;
const DEFAULT_PITCH = 0.0;

// Paging + pacing
const DEFAULT_PAGE_SIZE = 200;
const DEFAULT_SLEEP_MS = 350;

// ---- tiny CLI parser (no dependency) ----
function getArg(name) {
  const key = `--${name}`;
  const idx = process.argv.indexOf(key);
  if (idx === -1) return null;
  const val = process.argv[idx + 1];
  if (!val || val.startsWith("--")) return "";
  return val;
}

function getArgNumber(name, fallback) {
  const v = getArg(name);
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function getArgString(name, fallback) {
  const v = getArg(name);
  if (v == null || v === "") return fallback;
  return v;
}

function getArgBool(name, fallback = false) {
  const v = getArg(name);
  if (v == null || v === "") return fallback;
  const s = String(v).toLowerCase().trim();
  if (["1", "true", "yes", "y", "on"].includes(s)) return true;
  if (["0", "false", "no", "n", "off"].includes(s)) return false;
  return fallback;
}

function parseDeckIds() {
  const v = getArg("deckIds");
  if (!v) return [];
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildPath(locale, kind, pairId) {
  return `${locale}/${kind}/${pairId}.mp3`;
}

/**
 * Clean text for TTS:
 * - Normalizes spacing around "/"
 * - Converts "X/Y" into "X, Y" (short pause), NOT "X o Y"
 *   Examples:
 *   - "ningún/ninguna" -> "ningún, ninguna"
 *   - "abuelo/abuela"  -> "abuelo, abuela"
 * - Leaves normal text unchanged
 */
function cleanForTTS(text) {
  if (!text) return "";
  let s = String(text).trim();

  // normalize " / " -> "/"
  s = s.replace(/\s*\/\s*/g, "/");

  // convert token/token -> token, token
  // (works for one-word alternatives like viejo/vieja, ningún/ninguna, etc.)
  s = s.replace(/\b([^\s\/]+)\/([^\s\/]+)\b/g, "$1, $2");

  // collapse whitespace
  s = s.replace(/\s+/g, " ").trim();

  return s;
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }

  const deckIds = parseDeckIds();
  const TARGET_LOCALE = getArgString("lang", DEFAULT_TARGET_LOCALE);
  const VOICE_NAME = getArgString("voice", DEFAULT_VOICE_NAME);
  const SPEAKING_RATE = getArgNumber("rate", DEFAULT_SPEAKING_RATE);
  const PITCH = getArgNumber("pitch", DEFAULT_PITCH);

  const PAGE_SIZE = getArgNumber("pageSize", DEFAULT_PAGE_SIZE);
  const SLEEP_MS = getArgNumber("sleep", DEFAULT_SLEEP_MS);

  const MAX_ITEMS = (() => {
    const v = getArg("max");
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  })();

  const ONLY_SLASH = getArgBool("onlySlash", false);
  const FORCE = getArgBool("force", false);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const ttsClient = new textToSpeech.TextToSpeechClient();

  console.log("Starting batch TTS (multi-deck)...");
  console.log("Bucket:", BUCKET);
  console.log("Locale:", TARGET_LOCALE);
  console.log("Voice:", VOICE_NAME);
  console.log("Rate/Pitch:", SPEAKING_RATE, "/", PITCH);
  console.log("Page size:", PAGE_SIZE);
  console.log("Sleep ms:", SLEEP_MS);
  console.log("Max items:", MAX_ITEMS ?? "(none)");
  console.log("Deck IDs:", deckIds.length ? deckIds.join(", ") : "(none provided)");
  console.log("onlySlash:", ONLY_SLASH);
  console.log("force:", FORCE);

  if (!deckIds.length) {
    console.log("\n⚠️ No --deckIds provided. For safety, this script requires deckIds.");
    console.log("Run with: --deckIds <uuid,uuid,...>");
    process.exit(1);
  }

  const summary = {};
  let globalGenerated = 0;
  let globalSkipped = 0;
  let globalFailed = 0;

  for (const deckId of deckIds) {
    console.log(`\n==============================`);
    console.log(`DECK: ${deckId}`);
    console.log(`==============================`);

    summary[deckId] = {
      scanned: 0,
      generated_word: 0,
      generated_sentence: 0,
      skipped_word: 0,
      skipped_sentence: 0,
      failed_word: 0,
      failed_sentence: 0,
    };

    let page = 0;
    let processed = 0;
    let done = false;

    while (!done) {
      if (MAX_ITEMS && processed >= MAX_ITEMS) break;

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // By default we fetch rows missing word OR sentence audio (fast).
      // If FORCE=true we fetch all rows in deck (so we can overwrite).
      let q = supabase
        .from("pairs")
        .select(
          "id, deck_id, created_at, word_target, sentence_target, word_target_audio_url, sentence_target_audio_url"
        )
        .eq("deck_id", deckId)
        .order("created_at", { ascending: true })
        .range(from, to);

      if (!FORCE) {
        q = q.or("word_target_audio_url.is.null,sentence_target_audio_url.is.null");
      }

      const { data: rows, error } = await q;
      if (error) throw error;

      if (!rows || rows.length === 0) {
        done = true;
        break;
      }

      for (const pair of rows) {
        if (MAX_ITEMS && processed >= MAX_ITEMS) {
          done = true;
          break;
        }

        summary[deckId].scanned += 1;

        const hasSlashWord = (pair.word_target || "").includes("/");
        const hasSlashSentence = (pair.sentence_target || "").includes("/");

        // If onlySlash is enabled, skip rows with no slash in either text
        if (ONLY_SLASH && !hasSlashWord && !hasSlashSentence) {
          summary[deckId].skipped_word += 1;
          summary[deckId].skipped_sentence += 1;
          globalSkipped += 2;
          processed += 1;
          continue;
        }

        // WORD
        const shouldDoWord =
          !!pair.word_target &&
          (FORCE || !pair.word_target_audio_url) &&
          (!ONLY_SLASH || hasSlashWord);

        if (shouldDoWord) {
          try {
            const cleaned = cleanForTTS(pair.word_target);
            const path = buildPath(TARGET_LOCALE, "word", pair.id);

            const publicUrl = await generateAndUpload({
              ttsClient,
              supabase,
              text: cleaned,
              path,
              locale: TARGET_LOCALE,
              voiceName: VOICE_NAME,
              speakingRate: SPEAKING_RATE,
              pitch: PITCH,
            });

            const { error: upErr } = await supabase
              .from("pairs")
              .update({ word_target_audio_url: publicUrl })
              .eq("id", pair.id);

            if (upErr) {
              console.error("DB update failed (word):", pair.id, upErr.message);
              summary[deckId].failed_word += 1;
              globalFailed += 1;
            } else {
              console.log(`✅ word: ${pair.id} -> ${path} (cleaned: "${cleaned}")`);
              summary[deckId].generated_word += 1;
              globalGenerated += 1;
            }
          } catch (e) {
            console.error("❌ word failed:", pair.id, String(e?.message || e));
            summary[deckId].failed_word += 1;
            globalFailed += 1;
          }
          await sleep(SLEEP_MS);
        } else {
          summary[deckId].skipped_word += 1;
          globalSkipped += 1;
        }

        // SENTENCE
        const shouldDoSentence =
          !!pair.sentence_target &&
          (FORCE || !pair.sentence_target_audio_url) &&
          (!ONLY_SLASH || hasSlashSentence);

        if (shouldDoSentence) {
          try {
            const cleaned = cleanForTTS(pair.sentence_target);
            const path = buildPath(TARGET_LOCALE, "sentence", pair.id);

            const publicUrl = await generateAndUpload({
              ttsClient,
              supabase,
              text: cleaned,
              path,
              locale: TARGET_LOCALE,
              voiceName: VOICE_NAME,
              speakingRate: SPEAKING_RATE,
              pitch: PITCH,
            });

            const { error: upErr } = await supabase
              .from("pairs")
              .update({ sentence_target_audio_url: publicUrl })
              .eq("id", pair.id);

            if (upErr) {
              console.error("DB update failed (sentence):", pair.id, upErr.message);
              summary[deckId].failed_sentence += 1;
              globalFailed += 1;
            } else {
              console.log(`✅ sentence: ${pair.id} -> ${path} (cleaned: "${cleaned}")`);
              summary[deckId].generated_sentence += 1;
              globalGenerated += 1;
            }
          } catch (e) {
            console.error("❌ sentence failed:", pair.id, String(e?.message || e));
            summary[deckId].failed_sentence += 1;
            globalFailed += 1;
          }
          await sleep(SLEEP_MS);
        } else {
          summary[deckId].skipped_sentence += 1;
          globalSkipped += 1;
        }

        processed += 1;
      }

      page += 1;
    }

    const s = summary[deckId];
    console.log(`\n--- Deck summary ${deckId} ---`);
    console.log("Scanned rows:", s.scanned);
    console.log("Generated word:", s.generated_word, " | Failed word:", s.failed_word);
    console.log("Generated sentence:", s.generated_sentence, " | Failed sentence:", s.failed_sentence);
    console.log("Skipped word:", s.skipped_word, " | Skipped sentence:", s.skipped_sentence);
  }

  console.log("\n==============================");
  console.log("ALL DONE");
  console.log("==============================");
  console.log("Total generated:", globalGenerated);
  console.log("Total failed:", globalFailed);
  console.log("Total skipped:", globalSkipped);
}

async function generateAndUpload({
  ttsClient,
  supabase,
  text,
  path,
  locale,
  voiceName,
  speakingRate,
  pitch,
}) {
  const MAX_RETRIES = 8;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const [resp] = await ttsClient.synthesizeSpeech({
        input: { text },
        voice: { languageCode: locale, name: voiceName },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate,
          pitch,
        },
      });

      const audioContent = resp.audioContent;
      if (!audioContent) throw new Error("No audioContent returned from TTS");

      const fileBytes = Buffer.isBuffer(audioContent) ? audioContent : Buffer.from(audioContent);

      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, fileBytes, {
        contentType: "audio/mpeg",
        upsert: true, // overwrite mp3 if exists
      });

      if (upErr) throw upErr;

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      if (!data?.publicUrl) throw new Error("Could not get public URL");

      return data.publicUrl;
    } catch (e) {
      const msg = String(e?.message || e);
      const code = e?.code;

      const isResourceExhausted =
        code === 8 ||
        msg.includes("RESOURCE_EXHAUSTED") ||
        msg.includes("Resource has been exhausted");

      if (!isResourceExhausted) throw e;

      const waitMs = Math.min(120000, 5000 * Math.pow(2, attempt - 1));
      console.log(
        `⏳ Quota hit. Waiting ${Math.round(waitMs / 1000)}s then retrying (${attempt}/${MAX_RETRIES})...`
      );
      await sleep(waitMs);
    }
  }

  throw new Error("TTS failed after repeated quota retries.");
}

main().catch((e) => {
  console.error("TTS batch failed:", e);
  process.exit(1);
});
