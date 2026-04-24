require("dotenv").config({ path: ".env.local" });

const { createClient } = require("@supabase/supabase-js");

const BUCKET = "tts";

function getArg(name) {
  const key = `--${name}`;
  const idx = process.argv.indexOf(key);
  if (idx === -1) return null;
  const val = process.argv[idx + 1];
  if (!val || val.startsWith("--")) return "";
  return val;
}

function getArgBool(name, fallback = false) {
  const v = getArg(name);
  if (v == null || v === "") return fallback;
  const s = String(v).toLowerCase().trim();
  if (["1", "true", "yes", "y", "on"].includes(s)) return true;
  if (["0", "false", "no", "n", "off"].includes(s)) return false;
  return fallback;
}

function getArgNumber(name, fallback) {
  const v = getArg(name);
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toLocale(targetLang) {
  const lang = String(targetLang || "").trim().toLowerCase();
  if (!lang) return null;
  if (lang.startsWith("es")) return "es-ES";
  if (lang.startsWith("en")) return "en-GB";
  if (lang.startsWith("pl")) return "pl-PL";
  if (lang.startsWith("de")) return "de-DE";
  if (lang.startsWith("fr")) return "fr-FR";
  if (lang.startsWith("it")) return "it-IT";
  if (lang.startsWith("pt")) return "pt-PT";
  if (lang.startsWith("ru")) return "ru-RU";
  if (lang.startsWith("tr")) return "tr-TR";
  if (lang.startsWith("ar")) return "ar-SA";
  if (lang.startsWith("sw")) return "sw-KE";
  if (lang.startsWith("zh")) return "zh-CN";
  if (lang.startsWith("ja")) return "ja-JP";
  if (lang.startsWith("ko")) return "ko-KR";
  return null;
}

function buildStoragePath(locale, kind, pairTemplateId) {
  if (!locale || !pairTemplateId) return null;
  return `${locale}/${kind}/pt-${pairTemplateId}.mp3`;
}

function extractPairTemplateId(key) {
  const raw = String(key || "").trim();
  if (!raw) return null;
  const suffix = raw.split("pt-")[1];
  if (!suffix) return null;
  return suffix.replace(/\.mp3$/i, "").trim() || null;
}

function isAlreadyExistsError(error) {
  const msg = String(error?.message || error || "").toLowerCase();
  return msg.includes("already exists") || msg.includes("duplicate");
}

async function ensureCopiedObject(supabase, sourcePath, targetPath) {
  if (!sourcePath || !targetPath) {
    throw new Error("Missing sourcePath or targetPath");
  }
  if (sourcePath === targetPath) {
    return "same_path";
  }

  const { error: copyErr } = await supabase.storage.from(BUCKET).copy(sourcePath, targetPath);
  if (!copyErr) return "copied";
  if (isAlreadyExistsError(copyErr)) return "already_exists";

  const { data: blob, error: downloadErr } = await supabase.storage.from(BUCKET).download(sourcePath);
  if (downloadErr) throw downloadErr;

  const bytes = Buffer.from(await blob.arrayBuffer());
  const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(targetPath, bytes, {
    contentType: "audio/mpeg",
    upsert: false,
  });
  if (!uploadErr) return "copied_via_upload";
  if (isAlreadyExistsError(uploadErr)) return "already_exists";
  throw uploadErr;
}

async function runWithConcurrency(items, worker, concurrency) {
  let idx = 0;

  async function next() {
    for (;;) {
      const current = idx;
      idx += 1;
      if (current >= items.length) return;
      await worker(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }, () => next());
  await Promise.all(workers);
}

async function fetchAllPairTemplates(supabase, pageSize) {
  const rows = [];
  let from = 0;

  for (;;) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from("pair_templates")
      .select(
        "id, word_target, sentence_target, deck_templates!inner(target_lang, native_lang), template_audio_assets(word_audio_key, sentence_audio_key)"
      )
      .order("id", { ascending: true })
      .range(from, to);

    if (error) throw error;
    const batch = data || [];
    rows.push(...batch);
    console.log(`Fetched pair_templates ${from}-${to}: ${batch.length}`);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function main() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }

  const targetLangFilter = String(getArg("target-lang") || "").trim().toLowerCase();
  const nativeLangFilter = String(getArg("native-lang") || "").trim().toLowerCase();
  if (!targetLangFilter || !nativeLangFilter) {
    throw new Error("Both --target-lang and --native-lang are required");
  }

  const PAGE_SIZE = Math.max(1, Math.min(1000, getArgNumber("pageSize", 1000)));
  const CONCURRENCY = Math.max(1, Math.min(32, getArgNumber("concurrency", 12)));
  const LIMIT = Math.max(0, getArgNumber("limit", 0));
  const DRY_RUN = getArgBool("dry-run", false);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const rawRows = await fetchAllPairTemplates(supabase, PAGE_SIZE);
  const rows = rawRows.map((row) => {
    const deckTemplate = Array.isArray(row.deck_templates) ? row.deck_templates[0] : row.deck_templates;
    const canonical = Array.isArray(row.template_audio_assets)
      ? row.template_audio_assets[0]
      : row.template_audio_assets;

    return {
      pair_template_id: String(row.id),
      target_lang: String(deckTemplate?.target_lang || "").trim().toLowerCase(),
      native_lang: String(deckTemplate?.native_lang || "").trim().toLowerCase(),
      locale: toLocale(deckTemplate?.target_lang),
      word_target: String(row.word_target || "").trim(),
      sentence_target: String(row.sentence_target || "").trim(),
      word_audio_key: canonical?.word_audio_key || null,
      sentence_audio_key: canonical?.sentence_audio_key || null,
    };
  });

  const byId = new Map(rows.map((row) => [row.pair_template_id, row]));
  const familyRows = rows.filter(
    (row) => row.target_lang === targetLangFilter && row.native_lang === nativeLangFilter
  );
  const selectedRows = LIMIT > 0 ? familyRows.slice(0, LIMIT) : familyRows;

  const operations = [];
  for (const row of selectedRows) {
    if (!row.locale) continue;

    const targetWordKey = buildStoragePath(row.locale, "word", row.pair_template_id);
    const targetSentenceKey = buildStoragePath(row.locale, "sentence", row.pair_template_id);
    const wordSourceId = extractPairTemplateId(row.word_audio_key);
    const sentenceSourceId = extractPairTemplateId(row.sentence_audio_key);
    const wordSourceRow = wordSourceId ? byId.get(wordSourceId) : null;
    const sentenceSourceRow = sentenceSourceId ? byId.get(sentenceSourceId) : null;

    const needsWordRepair =
      !!row.word_audio_key &&
      targetWordKey !== row.word_audio_key &&
      !!wordSourceRow &&
      wordSourceRow.word_target === row.word_target;
    const needsSentenceRepair =
      !!row.sentence_audio_key &&
      targetSentenceKey !== row.sentence_audio_key &&
      !!sentenceSourceRow &&
      sentenceSourceRow.sentence_target === row.sentence_target;

    if (!needsWordRepair && !needsSentenceRepair) continue;

    operations.push({
      pair_template_id: row.pair_template_id,
      word_source_key: needsWordRepair ? row.word_audio_key : null,
      word_target_key: needsWordRepair ? targetWordKey : null,
      sentence_source_key: needsSentenceRepair ? row.sentence_audio_key : null,
      sentence_target_key: needsSentenceRepair ? targetSentenceKey : null,
    });
  }

  console.log(
    JSON.stringify(
      {
        targetLangFilter,
        nativeLangFilter,
        familyTemplates: familyRows.length,
        selectedTemplates: selectedRows.length,
        repairOperations: operations.length,
        dryRun: DRY_RUN,
        concurrency: CONCURRENCY,
      },
      null,
      2
    )
  );

  if (DRY_RUN) return;

  let repairedWord = 0;
  let repairedSentence = 0;
  let failed = 0;

  await runWithConcurrency(
    operations,
    async (op, idx) => {
      try {
        const updatePayload = { updated_at: new Date().toISOString() };

        if (op.word_source_key && op.word_target_key) {
          await ensureCopiedObject(supabase, op.word_source_key, op.word_target_key);
          const { data } = supabase.storage.from(BUCKET).getPublicUrl(op.word_target_key);
          const { error: pairErr } = await supabase
            .from("pairs")
            .update({ word_target_audio_url: data.publicUrl })
            .eq("pair_template_id", op.pair_template_id);
          if (pairErr) throw pairErr;
          updatePayload.word_audio_key = op.word_target_key;
          repairedWord += 1;
        }

        if (op.sentence_source_key && op.sentence_target_key) {
          await ensureCopiedObject(supabase, op.sentence_source_key, op.sentence_target_key);
          const { data } = supabase.storage.from(BUCKET).getPublicUrl(op.sentence_target_key);
          const { error: pairErr } = await supabase
            .from("pairs")
            .update({ sentence_target_audio_url: data.publicUrl })
            .eq("pair_template_id", op.pair_template_id);
          if (pairErr) throw pairErr;
          updatePayload.sentence_audio_key = op.sentence_target_key;
          repairedSentence += 1;
        }

        const { error: taaErr } = await supabase
          .from("template_audio_assets")
          .update(updatePayload)
          .eq("pair_template_id", op.pair_template_id);
        if (taaErr) throw taaErr;

        if ((idx + 1) % 100 === 0) {
          console.log(`Processed ${idx + 1}/${operations.length}`);
        }
      } catch (error) {
        failed += 1;
        console.error(`Repair failed for ${op.pair_template_id}:`, String(error?.message || error));
      }
    },
    CONCURRENCY
  );

  console.log(
    JSON.stringify(
      {
        targetLangFilter,
        nativeLangFilter,
        repairOperations: operations.length,
        repairedWord,
        repairedSentence,
        failed,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("tts_reown_canonical_family failed:", error);
  process.exit(1);
});
