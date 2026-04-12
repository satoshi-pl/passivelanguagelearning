/**
 * Batch TTS generator for Supabase pairs.
 * - Uses Google Cloud Text-to-Speech
 * - Uploads MP3s to Supabase Storage bucket: "tts"
 * - Writes public URLs back to pairs table:
 *    - word_target_audio_url
 *    - sentence_target_audio_url
 *
 * SAFE / RESUME-FRIENDLY:
 * - Only generates audio if URL is missing
 * - Processes in pages
 * - Rate-limits requests
 * - Retries with backoff on Google quota errors (RESOURCE_EXHAUSTED)
 */

require("dotenv").config({ path: ".env.local" });

const textToSpeech = require("@google-cloud/text-to-speech");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BUCKET = "tts";
const TARGET_LOCALE = "es-ES";

// Choose a voice you like:
const VOICE_NAME = "es-ES-Chirp-HD-F"; // Spain Spanish, high quality
const SPEAKING_RATE = 1.0;
const PITCH = 0.0;

// Paging + pacing
const PAGE_SIZE = 200;
const SLEEP_MS = 350; // slower to reduce quota hits

// Optional filtering
const ONLY_DECK_ID = null; // put a deck UUID here to do A1 only, etc.
const MAX_ITEMS = null; // null = no limit (full run)

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * ASCII-only slug for Supabase Storage keys.
 * - removes accents (aquí -> aqui)
 * - replaces non-alphanumeric with hyphens
 * - collapses hyphens
 * - trims and limits length
 */
function safeSlug(input) {
  const s = (input || "")
    .toString()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-") // keep only ascii
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");

  return s.slice(0, 80);
}

function buildPath(kind, pair) {
  const raw = kind === "word" ? pair.word_target : pair.sentence_target || "sentence";
  const slug = safeSlug(raw) || "item";
  return `${TARGET_LOCALE}/${kind}/${pair.id}-${slug}.mp3`;
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const ttsClient = new textToSpeech.TextToSpeechClient();

  console.log("Starting batch TTS...");
  console.log("Bucket:", BUCKET);
  console.log("Locale:", TARGET_LOCALE);
  console.log("Voice:", VOICE_NAME);
  console.log("Deck filter:", ONLY_DECK_ID || "(none)");
  console.log("Max items:", MAX_ITEMS || "(none)");
  console.log("Page size:", PAGE_SIZE);

  let processedPairs = 0;
  let page = 0;
  let done = false;

  while (!done) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let q = supabase
      .from("pairs")
      .select(
        "id, deck_id, created_at, word_target, sentence_target, word_target_audio_url, sentence_target_audio_url"
      )
      .order("created_at", { ascending: true })
      .range(from, to);

    if (ONLY_DECK_ID) q = q.eq("deck_id", ONLY_DECK_ID);

    const { data: rows, error } = await q;
    if (error) throw error;

    if (!rows || rows.length === 0) {
      done = true;
      break;
    }

    for (const pair of rows) {
      if (MAX_ITEMS && processedPairs >= MAX_ITEMS) {
        done = true;
        break;
      }

      // WORD
      if (!pair.word_target_audio_url && pair.word_target) {
        const path = buildPath("word", pair);
        const publicUrl = await generateAndUpload({
          ttsClient,
          supabase,
          text: pair.word_target,
          path,
        });

        const { error: upErr } = await supabase
          .from("pairs")
          .update({ word_target_audio_url: publicUrl })
          .eq("id", pair.id);

        if (upErr) {
          console.error("DB update failed (word):", pair.id, upErr.message);
        } else {
          console.log("✅ word:", pair.id, "->", path);
        }

        await sleep(SLEEP_MS);
      }

      // SENTENCE
      if (!pair.sentence_target_audio_url && pair.sentence_target) {
        const path = buildPath("sentence", pair);
        const publicUrl = await generateAndUpload({
          ttsClient,
          supabase,
          text: pair.sentence_target,
          path,
        });

        const { error: upErr } = await supabase
          .from("pairs")
          .update({ sentence_target_audio_url: publicUrl })
          .eq("id", pair.id);

        if (upErr) {
          console.error("DB update failed (sentence):", pair.id, upErr.message);
        } else {
          console.log("✅ sentence:", pair.id, "->", path);
        }

        await sleep(SLEEP_MS);
      }

      processedPairs += 1;
    }

    page += 1;
  }

  console.log("Done. Processed pairs:", processedPairs);
}

/**
 * Generate MP3 using Google TTS and upload to Supabase Storage.
 * Retries with exponential backoff on RESOURCE_EXHAUSTED (quota/rate-limit).
 */
async function generateAndUpload({ ttsClient, supabase, text, path }) {
  const MAX_RETRIES = 8;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const [resp] = await ttsClient.synthesizeSpeech({
        input: { text },
        voice: { languageCode: TARGET_LOCALE, name: VOICE_NAME },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: SPEAKING_RATE,
          pitch: PITCH,
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

      if (!isResourceExhausted) {
        // not a quota issue => fail fast
        throw e;
      }

      // Exponential backoff: 5s, 10s, 20s, 40s, 80s... (capped)
      const waitMs = Math.min(120000, 5000 * Math.pow(2, attempt - 1));
      console.log(
        `⏳ Quota hit. Waiting ${Math.round(waitMs / 1000)}s then retrying (${attempt}/${MAX_RETRIES})...`
      );
      await sleep(waitMs);
      // retry loop continues
    }
  }

  throw new Error("TTS failed after repeated quota retries.");
}

main().catch((e) => {
  console.error("TTS batch failed:", e);
  process.exit(1);
});
