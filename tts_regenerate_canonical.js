/**
 * Canonical TTS regeneration for the CURRENT live dataset (PLL).
 *
 * Strategy (durable, minimal duplication):
 * - One MP3 per pair_template row + kind (word/sentence), keyed by pair_template UUID in Storage.
 * - Object keys: {locale}/word/pt-{pair_template_id}.mp3 and {locale}/sentence/pt-{pair_template_id}.mp3
 *   (`pt-` prefix avoids collisions with legacy scripts that used pairs.id in the filename.)
 * - After upload, updates ALL public.pairs rows with that pair_template_id to the same public URL.
 * - Future provisioning (sync_* copying by pair_template_id) then inherits consistent URLs.
 *
 * Requires (see .env.local):
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - GOOGLE_APPLICATION_CREDENTIALS (path to service account JSON for Google Cloud TTS)
 *
 * Usage:
 *   node tts_regenerate_canonical.js --sleep 600
 *   node tts_regenerate_canonical.js --max 20          # smoke test first 20 templates
 *   node tts_regenerate_canonical.js --offset 0 --limit 500
 *   node tts_regenerate_canonical.js --force true      # re-upload + overwrite DB URLs
 *   node tts_regenerate_canonical.js --pageSize 1000   # Supabase fetch page (default 1000)
 */

require("dotenv").config({ path: ".env.local" });

const textToSpeech = require("@google-cloud/text-to-speech");
const { createClient } = require("@supabase/supabase-js");

const BUCKET = "tts";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

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

function getArgBool(name, fallback = false) {
  const v = getArg(name);
  if (v == null || v === "") return fallback;
  const s = String(v).toLowerCase().trim();
  if (["1", "true", "yes", "y", "on"].includes(s)) return true;
  if (["0", "false", "no", "n", "off"].includes(s)) return false;
  return fallback;
}

function xmlEscape(input) {
  return String(input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cleanForTTS(text) {
  if (!text) return "";
  let s = String(text).trim();
  s = s.replace(/\s*\/\s*/g, "/");
  s = s.replace(/\b([^\s\/]+)\/([^\s\/]+)\b/g, "$1, $2");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function buildSsml(text, leadingBreakMs) {
  const cleaned = cleanForTTS(text);
  const escaped = xmlEscape(cleaned);
  return `<speak><break time="${leadingBreakMs}ms"/>${escaped}</speak>`;
}

/**
 * Map deck_templates.target_lang (often 2-letter) to Google TTS voice config.
 * Extend this table if you add languages; unknown langs are skipped with a log line.
 */
function voiceForTargetLang(raw) {
  const t = String(raw || "").toLowerCase().trim();

  if (t.startsWith("es")) {
    return { languageCode: "es-ES", voiceName: "es-ES-Wavenet-F", ssmlGender: "FEMALE" };
  }
  if (t.startsWith("en")) {
    return { languageCode: "en-GB", voiceName: "en-GB-Wavenet-B", ssmlGender: "MALE" };
  }
  if (t.startsWith("de")) {
    return { languageCode: "de-DE", voiceName: "de-DE-Wavenet-G", ssmlGender: "FEMALE" };
  }
  if (t.startsWith("fr")) {
    return { languageCode: "fr-FR", voiceName: "fr-FR-Wavenet-G", ssmlGender: "FEMALE" };
  }
  if (t.startsWith("it")) {
    return { languageCode: "it-IT", voiceName: "it-IT-Wavenet-C", ssmlGender: "FEMALE" };
  }
  if (t.startsWith("pt")) {
    return { languageCode: "pt-PT", voiceName: "pt-PT-Wavenet-D", ssmlGender: "FEMALE" };
  }
  if (t.startsWith("pl")) {
    return { languageCode: "pl-PL", voiceName: "pl-PL-Wavenet-G", ssmlGender: "FEMALE" };
  }
  if (t.startsWith("ru")) {
    return { languageCode: "ru-RU", voiceName: "ru-RU-Wavenet-E", ssmlGender: "FEMALE" };
  }
  if (t.startsWith("tr")) {
    return { languageCode: "tr-TR", voiceName: "tr-TR-Wavenet-C", ssmlGender: "FEMALE" };
  }
  if (t.startsWith("ar")) {
    return { languageCode: "ar-XA", voiceName: "ar-XA-Wavenet-B", ssmlGender: "FEMALE" };
  }
  if (t.startsWith("sw")) {
    return { languageCode: "sw-KE", voiceName: "sw-KE-Wavenet-A", ssmlGender: "FEMALE" };
  }
  if (t.startsWith("zh")) {
    return { languageCode: "cmn-CN", voiceName: "cmn-CN-Wavenet-A", ssmlGender: "FEMALE" };
  }
  if (t.startsWith("ja")) {
    return { languageCode: "ja-JP", voiceName: "ja-JP-Wavenet-B", ssmlGender: "FEMALE" };
  }
  if (t.startsWith("ko")) {
    return { languageCode: "ko-KR", voiceName: "ko-KR-Wavenet-C", ssmlGender: "FEMALE" };
  }

  return null;
}

function buildStoragePath(languageCode, kind, pairTemplateId) {
  return `${languageCode}/${kind}/pt-${pairTemplateId}.mp3`;
}

async function generateAndUpload({
  ttsClient,
  supabase,
  ssml,
  path,
  voice,
  speakingRate,
  pitch,
}) {
  const MAX_RETRIES = 8;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const voiceRequest = {
        languageCode: voice.languageCode,
        ssmlGender: voice.ssmlGender,
        name: voice.voiceName,
      };

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

/** Load all deck_templates rows (paginated; PostgREST caps each response). */
async function fetchAllDeckTemplates(supabase, pageSize) {
  const map = new Map();
  let from = 0;

  for (;;) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("deck_templates")
      .select("id, target_lang")
      .order("id", { ascending: true })
      .range(from, to);

    if (error) throw error;
    const batch = data || [];
    for (const row of batch) {
      map.set(String(row.id), String(row.target_lang || ""));
    }
    console.log(`deck_templates page range ${from}-${to}: fetched ${batch.length} (map size ${map.size})`);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return map;
}

/** Fetch one page of pair_templates ordered by id. */
async function fetchPairTemplatesPage(supabase, from, to) {
  return supabase
    .from("pair_templates")
    .select("id, word_target, sentence_target, deck_template_id")
    .order("id", { ascending: true })
    .range(from, to);
}

async function main() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }

  const SLEEP_MS = getArgNumber("sleep", 500);
  const SPEAKING_RATE = getArgNumber("rate", 1.0);
  const PITCH = getArgNumber("pitch", 0.0);
  const LEADING_BREAK_MS = getArgNumber("leadingBreakMs", 150);
  const MAX_TEMPLATES = (() => {
    const v = getArg("max");
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  })();
  const OFFSET = getArgNumber("offset", 0);
  const LIMIT = (() => {
    const v = getArg("limit");
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  })();
  const FORCE = getArgBool("force", false);
  const PAGE_SIZE = Math.max(1, Math.min(1000, getArgNumber("pageSize", 1000)));

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const ttsClient = new textToSpeech.TextToSpeechClient();

  const { count: pairTemplatesTableCount, error: cntErr } = await supabase
    .from("pair_templates")
    .select("id", { count: "exact", head: true });

  if (cntErr) throw cntErr;

  const targetLangByDeckTemplateId = await fetchAllDeckTemplates(supabase, PAGE_SIZE);

  console.log("Canonical TTS regeneration");
  console.log("Bucket:", BUCKET);
  console.log("pair_templates rows (table count):", pairTemplatesTableCount ?? "unknown");
  console.log("Fetch pageSize:", PAGE_SIZE);
  console.log("Slice:", { offset: OFFSET, limit: LIMIT, max: MAX_TEMPLATES });
  console.log("sleep ms:", SLEEP_MS, "force:", FORCE);

  let okWord = 0;
  let okSentence = 0;
  let skipWord = 0;
  let skipSentence = 0;
  let failWord = 0;
  let failSentence = 0;
  let skipUnsupportedLang = 0;
  let failTemplate = 0;
  /**
   * Count of pair_template rows with non-empty target_lang fully handled so far
   * (skipped for --offset or processed). Matches legacy: filter then slice(OFFSET).slice(limit).
   */
  let nFilteredSeen = 0;
  let pageIdx = 0;

  for (let rangeFrom = 0; ; pageIdx++) {
    const rangeTo = rangeFrom + PAGE_SIZE - 1;
    const { data: batch, error: ptErr } = await fetchPairTemplatesPage(supabase, rangeFrom, rangeTo);
    if (ptErr) throw ptErr;
    const rows = batch || [];

    const processedApprox = Math.max(0, nFilteredSeen - OFFSET);

    console.log(
      `\n--- pair_templates page ${pageIdx} DB range [${rangeFrom}, ${rangeTo}] — fetched ${rows.length} row(s) | nFilteredSeen=${nFilteredSeen} processedInSlice≈${processedApprox} | totals okW=${okWord} okS=${okSentence} skipW=${skipWord} skipS=${skipSentence} failW=${failWord} failS=${failSentence} skipLang=${skipUnsupportedLang} failTpl=${failTemplate} ---`
    );

    if (rows.length === 0) break;

    let stopAll = false;

    for (const raw of rows) {
      const pt = {
        id: String(raw.id),
        word_target: raw.word_target,
        sentence_target: raw.sentence_target,
        deck_template_id: String(raw.deck_template_id),
        target_lang: targetLangByDeckTemplateId.get(String(raw.deck_template_id)) || "",
      };

      if (!pt.target_lang) continue;

      if (nFilteredSeen < OFFSET) {
        nFilteredSeen += 1;
        continue;
      }

      if (LIMIT != null && nFilteredSeen - OFFSET >= LIMIT) {
        stopAll = true;
        break;
      }
      if (MAX_TEMPLATES != null && nFilteredSeen - OFFSET >= MAX_TEMPLATES) {
        stopAll = true;
        break;
      }

      try {
        const voice = voiceForTargetLang(pt.target_lang);
        if (!voice) {
          console.warn(`⚠️ Unsupported target_lang for template ${pt.id}: "${pt.target_lang}" — skip`);
          skipUnsupportedLang += 1;
        } else {
          const { count: rowsForTemplate, error: rcErr } = await supabase
            .from("pairs")
            .select("id", { count: "exact", head: true })
            .eq("pair_template_id", pt.id);
          if (rcErr) throw rcErr;
          if ((rowsForTemplate ?? 0) === 0) {
            console.log(`— skip template ${pt.id}: no pairs rows reference it`);
          } else {
            const wordPath = buildStoragePath(voice.languageCode, "word", pt.id);
            const sentencePath = buildStoragePath(voice.languageCode, "sentence", pt.id);

            // ----- WORD -----
            const hasWord = !!(pt.word_target && String(pt.word_target).trim());
            if (hasWord) {
              const shouldGenWord = FORCE || (await anyPairMissingWordAudio(supabase, pt.id));
              if (shouldGenWord) {
                try {
                  const ssml = buildSsml(pt.word_target, LEADING_BREAK_MS);
                  const publicUrl = await generateAndUpload({
                    ttsClient,
                    supabase,
                    ssml,
                    path: wordPath,
                    voice,
                    speakingRate: SPEAKING_RATE,
                    pitch: PITCH,
                  });

                  const { error: upErr } = await supabase
                    .from("pairs")
                    .update({ word_target_audio_url: publicUrl })
                    .eq("pair_template_id", pt.id);

                  if (upErr) throw upErr;
                  console.log(`✅ word template ${pt.id} -> ${wordPath}`);
                  okWord += 1;
                } catch (e) {
                  console.error(`❌ word template ${pt.id}:`, String(e?.message || e));
                  failWord += 1;
                }
                await sleep(SLEEP_MS);
              } else {
                skipWord += 1;
              }
            }

            // ----- SENTENCE -----
            const hasSentence = !!(pt.sentence_target && String(pt.sentence_target).trim());
            if (hasSentence) {
              const shouldGenSentence = FORCE || (await anyPairMissingSentenceAudio(supabase, pt.id));
              if (shouldGenSentence) {
                try {
                  const ssml = buildSsml(pt.sentence_target, LEADING_BREAK_MS);
                  const publicUrl = await generateAndUpload({
                    ttsClient,
                    supabase,
                    ssml,
                    path: sentencePath,
                    voice,
                    speakingRate: SPEAKING_RATE,
                    pitch: PITCH,
                  });

                  const { error: upErr } = await supabase
                    .from("pairs")
                    .update({ sentence_target_audio_url: publicUrl })
                    .eq("pair_template_id", pt.id);

                  if (upErr) throw upErr;
                  console.log(`✅ sentence template ${pt.id} -> ${sentencePath}`);
                  okSentence += 1;
                } catch (e) {
                  console.error(`❌ sentence template ${pt.id}:`, String(e?.message || e));
                  failSentence += 1;
                }
                await sleep(SLEEP_MS);
              } else {
                skipSentence += 1;
              }
            }
          }
        }
      } catch (e) {
        console.error(`❌ template ${pt.id} (non-TTS):`, String(e?.message || e));
        failTemplate += 1;
      } finally {
        nFilteredSeen += 1;
      }
    }

    if (stopAll) break;
    if (rows.length < PAGE_SIZE) break;
    rangeFrom += PAGE_SIZE;
  }

  const cap = LIMIT ?? MAX_TEMPLATES;
  const processedInSlice =
    cap != null ? Math.min(Math.max(0, nFilteredSeen - OFFSET), cap) : Math.max(0, nFilteredSeen - OFFSET);

  console.log("\n=== Summary ===");
  console.log({
    pairTemplatesTableCount,
    nFilteredSeen,
    processedInSlice,
    okWord,
    okSentence,
    skipWord,
    skipSentence,
    failWord,
    failSentence,
    skipUnsupportedLang,
    failTemplate,
  });
}

async function anyPairMissingWordAudio(supabase, pairTemplateId) {
  const { count, error } = await supabase
    .from("pairs")
    .select("id", { count: "exact", head: true })
    .eq("pair_template_id", pairTemplateId)
    .is("word_target_audio_url", null);
  if (error) throw error;
  return (count ?? 0) > 0;
}

async function anyPairMissingSentenceAudio(supabase, pairTemplateId) {
  const { count, error } = await supabase
    .from("pairs")
    .select("id", { count: "exact", head: true })
    .eq("pair_template_id", pairTemplateId)
    .is("sentence_target_audio_url", null);
  if (error) throw error;
  return (count ?? 0) > 0;
}

main().catch((e) => {
  console.error("tts_regenerate_canonical failed:", e);
  process.exit(1);
});
