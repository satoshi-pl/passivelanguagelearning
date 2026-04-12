/**
 * Final batch TTS generator for Supabase pairs (AUTO ENGLISH + SPANISH).
 *
 * FIXED DEFAULT VOICES
 * - English -> en-GB-Studio-B
 * - Spanish -> es-ES-Wavenet-F
 *
 * WHAT IT DOES
 * - Uses Google Cloud Text-to-Speech
 * - Uploads MP3s to Supabase Storage bucket: "tts"
 * - Writes public URLs back to pairs table:
 *    - word_target_audio_url
 *    - sentence_target_audio_url
 *
 * IMPORTANT
 * - One script handles BOTH Spanish and English decks in one run
 * - It detects the deck target language from the decks table
 * - Adds a tiny leading pause so audio is less likely to feel cut at the start
 * - Processes in pages / batches
 * - Runs decks sequentially (not all at once)
 * - Retries with backoff on Google quota errors (RESOURCE_EXHAUSTED)
 *
 * SAFE / RESUME-FRIENDLY
 * - By default: only generates audio if URL is missing
 * - --force true will overwrite existing files/URLs
 *
 * EXAMPLE
 * node tts_batch_auto_en_es.js --deckIds uuid1,uuid2,uuid3 --pageSize 50 --sleep 700
 */

require("dotenv").config({ path: ".env.local" });

const textToSpeech = require("@google-cloud/text-to-speech");
const { createClient } = require("@supabase/supabase-js");

// ---- ENV ----
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS;

const BUCKET = "tts";

// ---- defaults ----
const DEFAULT_ENGLISH_LOCALE = "en-GB";
const DEFAULT_SPANISH_LOCALE = "es-ES";

const DEFAULT_ENGLISH_VOICE_NAME = "en-GB-Studio-B";
const DEFAULT_SPANISH_VOICE_NAME = "es-ES-Wavenet-F";

const DEFAULT_SPEAKING_RATE = 1.0;
const DEFAULT_PITCH = 0.0;
const DEFAULT_LEADING_BREAK_MS = 150;

const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_SLEEP_MS = 500;

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

function xmlEscape(input) {
  return String(input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Clean text for TTS:
 * - Normalizes spacing around "/"
 * - Converts "X/Y" into "X, Y" so slash becomes a short spoken pause
 * - Collapses whitespace
 */
function cleanForTTS(text) {
  if (!text) return "";
  let s = String(text).trim();

  s = s.replace(/\s*\/\s*/g, "/");
  s = s.replace(/\b([^\s\/]+)\/([^\s\/]+)\b/g, "$1, $2");
  s = s.replace(/\s+/g, " ").trim();

  return s;
}

function normalizeLang(raw) {
  const v = String(raw || "").toLowerCase().trim();

  if (
    v === "es" ||
    v === "es-es" ||
    v.startsWith("es-") ||
    v === "spanish" ||
    v === "español" ||
    v === "castellano"
  ) {
    return "es";
  }

  if (
    v === "en" ||
    v === "en-gb" ||
    v === "en-us" ||
    v.startsWith("en-") ||
    v === "english"
  ) {
    return "en";
  }

  return "";
}

function getVoiceConfig(langKey, opts) {
  if (langKey === "es") {
    return {
      langKey: "es",
      languageCode: opts.spanishLocale,
      voiceName: opts.spanishVoiceName,
      ssmlGender: "FEMALE",
    };
  }

  if (langKey === "en") {
    return {
      langKey: "en",
      languageCode: opts.englishLocale,
      voiceName: opts.englishVoiceName,
      ssmlGender: "MALE",
    };
  }

  return null;
}

function buildSsml(text, leadingBreakMs) {
  const cleaned = cleanForTTS(text);
  const escaped = xmlEscape(cleaned);
  return `<speak><break time="${leadingBreakMs}ms"/>${escaped}</speak>`;
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }

  if (!GOOGLE_APPLICATION_CREDENTIALS) {
    console.log("⚠️ GOOGLE_APPLICATION_CREDENTIALS is not set in .env.local.");
    console.log("If your Google auth is not configured globally, TTS will fail.");
  }

  const deckIds = parseDeckIds();
  const PAGE_SIZE = getArgNumber("pageSize", DEFAULT_PAGE_SIZE);
  const SLEEP_MS = getArgNumber("sleep", DEFAULT_SLEEP_MS);
  const SPEAKING_RATE = getArgNumber("rate", DEFAULT_SPEAKING_RATE);
  const PITCH = getArgNumber("pitch", DEFAULT_PITCH);
  const LEADING_BREAK_MS = getArgNumber("leadingBreakMs", DEFAULT_LEADING_BREAK_MS);

  const MAX_ITEMS = (() => {
    const v = getArg("max");
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  })();

  const ONLY_SLASH = getArgBool("onlySlash", false);
  const FORCE = getArgBool("force", false);

  const voiceOpts = {
    englishLocale: getArgString("englishLocale", DEFAULT_ENGLISH_LOCALE),
    spanishLocale: getArgString("spanishLocale", DEFAULT_SPANISH_LOCALE),
    englishVoiceName: getArgString("englishVoiceName", DEFAULT_ENGLISH_VOICE_NAME),
    spanishVoiceName: getArgString("spanishVoiceName", DEFAULT_SPANISH_VOICE_NAME),
  };

  if (!deckIds.length) {
    console.log("\\n⚠️ No --deckIds provided. For safety, this script requires deckIds.");
    console.log("Run with: --deckIds <uuid,uuid,...>");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const ttsClient = new textToSpeech.TextToSpeechClient();

  console.log("Starting batch TTS (auto English + Spanish)...");
  console.log("Bucket:", BUCKET);
  console.log("Page size:", PAGE_SIZE);
  console.log("Sleep ms:", SLEEP_MS);
  console.log("Max items:", MAX_ITEMS ?? "(none)");
  console.log("Deck IDs:", deckIds.join(", "));
  console.log("onlySlash:", ONLY_SLASH);
  console.log("force:", FORCE);
  console.log("Leading break ms:", LEADING_BREAK_MS);
  console.log("English locale / voice:", voiceOpts.englishLocale, "/", voiceOpts.englishVoiceName);
  console.log("Spanish locale / voice:", voiceOpts.spanishLocale, "/", voiceOpts.spanishVoiceName);

  const { data: deckRows, error: deckErr } = await supabase
    .from("decks")
    .select("id, name, target_lang")
    .in("id", deckIds);

  if (deckErr) throw deckErr;

  const deckById = new Map();
  for (const row of deckRows || []) {
    deckById.set(String(row.id), {
      id: String(row.id),
      name: String(row.name || ""),
      target_lang: String(row.target_lang || ""),
    });
  }

  const summary = {};
  let globalGenerated = 0;
  let globalSkipped = 0;
  let globalFailed = 0;

  for (const deckId of deckIds) {
    const deck = deckById.get(deckId);

    console.log("\\n==============================");
    console.log(`DECK: ${deckId}`);
    console.log("==============================");

    if (!deck) {
      console.log("⚠️ Deck not found. Skipping.");
      continue;
    }

    const langKey = normalizeLang(deck.target_lang);
    const voice = getVoiceConfig(langKey, voiceOpts);

    console.log("Deck name:", deck.name || "(unnamed)");
    console.log("Target lang:", deck.target_lang || "(empty)");

    if (!voice) {
      console.log("⚠️ Unsupported target language for this script. Skipping deck.");
      continue;
    }

    console.log("Using voice config:", {
      languageCode: voice.languageCode,
      ssmlGender: voice.ssmlGender,
      voiceName: voice.voiceName || "(auto)",
    });

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

      let q = supabase
        .from("pairs")
        .select(
          "id, deck_id, created_at, word_target, sentence_target, word_target_audio_url, sentence_target_audio_url"
        )
        .eq("deck_id", deckId)
        .order("created_at", { ascending: true })
        .range(from, to);

      
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

        if (ONLY_SLASH && !hasSlashWord && !hasSlashSentence) {
          summary[deckId].skipped_word += 1;
          summary[deckId].skipped_sentence += 1;
          globalSkipped += 2;
          processed += 1;
          continue;
        }

        const shouldDoWord =
          !!pair.word_target &&
          (FORCE || !pair.word_target_audio_url) &&
          (!ONLY_SLASH || hasSlashWord);

        if (shouldDoWord) {
          try {
            const text = cleanForTTS(pair.word_target);
            const path = buildPath(voice.languageCode, "word", pair.id);

            const publicUrl = await generateAndUpload({
              ttsClient,
              supabase,
              text,
              path,
              voice,
              speakingRate: SPEAKING_RATE,
              pitch: PITCH,
              leadingBreakMs: LEADING_BREAK_MS,
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
              console.log(`✅ word: ${pair.id} -> ${path} (lang: ${voice.languageCode}, text: "${text}")`);
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

        const shouldDoSentence =
          !!pair.sentence_target &&
          (FORCE || !pair.sentence_target_audio_url) &&
          (!ONLY_SLASH || hasSlashSentence);

        if (shouldDoSentence) {
          try {
            const text = cleanForTTS(pair.sentence_target);
            const path = buildPath(voice.languageCode, "sentence", pair.id);

            const publicUrl = await generateAndUpload({
              ttsClient,
              supabase,
              text,
              path,
              voice,
              speakingRate: SPEAKING_RATE,
              pitch: PITCH,
              leadingBreakMs: LEADING_BREAK_MS,
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
              console.log(`✅ sentence: ${pair.id} -> ${path} (lang: ${voice.languageCode}, text: "${text}")`);
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
    console.log(`\\n--- Deck summary ${deckId} ---`);
    console.log("Scanned rows:", s.scanned);
    console.log("Generated word:", s.generated_word, " | Failed word:", s.failed_word);
    console.log("Generated sentence:", s.generated_sentence, " | Failed sentence:", s.failed_sentence);
    console.log("Skipped word:", s.skipped_word, " | Skipped sentence:", s.skipped_sentence);
  }

  console.log("\\n==============================");
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
  voice,
  speakingRate,
  pitch,
  leadingBreakMs,
}) {
  const MAX_RETRIES = 8;
  const ssml = buildSsml(text, leadingBreakMs);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const voiceRequest = {
        languageCode: voice.languageCode,
        ssmlGender: voice.ssmlGender,
      };

      if (voice.voiceName) {
        voiceRequest.name = voice.voiceName;
      }

      const [resp] = await ttsClient.synthesizeSpeech({
        input: { ssml },
        voice: voiceRequest,
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
        upsert: true,
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
