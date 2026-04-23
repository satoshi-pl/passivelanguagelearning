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

function normalizeText(value) {
  const text = String(value || "").trim();
  return text || null;
}

function buildStoragePath(locale, kind, pairTemplateId) {
  if (!locale || !pairTemplateId) return null;
  return `${locale}/${kind}/pt-${pairTemplateId}.mp3`;
}

function isAlreadyExistsError(error) {
  const msg = String(error?.message || error || "").toLowerCase();
  return msg.includes("already exists") || msg.includes("duplicate");
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
  const results = [];

  async function next() {
    for (;;) {
      const current = idx;
      idx += 1;
      if (current >= items.length) return;
      results[current] = await worker(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }, () => next());
  await Promise.all(workers);
  return results;
}

async function insertCanonicalRows(supabase, rows) {
  const CHUNK_SIZE = 500;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from("template_audio_assets").insert(chunk);
    if (error) throw error;
  }
}

async function updateCanonicalRows(supabase, rows) {
  for (const row of rows) {
    const updatePayload = { updated_at: new Date().toISOString() };
    if (row.word_audio_key) updatePayload.word_audio_key = row.word_audio_key;
    if (row.sentence_audio_key) updatePayload.sentence_audio_key = row.sentence_audio_key;

    const { error } = await supabase
      .from("template_audio_assets")
      .update(updatePayload)
      .eq("pair_template_id", row.pair_template_id);

    if (error) throw error;
  }
}

async function main() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }

  const PAGE_SIZE = Math.max(1, Math.min(1000, getArgNumber("pageSize", 1000)));
  const CONCURRENCY = Math.max(1, Math.min(32, getArgNumber("concurrency", 10)));
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

    const targetLang = String(deckTemplate?.target_lang || "").trim().toLowerCase();
    const nativeLang = String(deckTemplate?.native_lang || "").trim().toLowerCase();
    const locale = toLocale(targetLang);

    return {
      pair_template_id: String(row.id),
      target_lang: targetLang,
      native_lang: nativeLang,
      locale,
      word_target: normalizeText(row.word_target),
      sentence_target: normalizeText(row.sentence_target),
      word_audio_key: canonical?.word_audio_key || null,
      sentence_audio_key: canonical?.sentence_audio_key || null,
      has_canonical_row: !!canonical,
    };
  });

  const wordSourceBySignature = new Map();
  const sentenceSourceBySignature = new Map();

  for (const row of rows) {
    if (row.word_audio_key && row.word_target && row.locale) {
      const key = `${row.target_lang}|${row.locale}|${row.word_target}`;
      if (!wordSourceBySignature.has(key)) {
        wordSourceBySignature.set(key, {
          source_pair_template_id: row.pair_template_id,
          source_key: row.word_audio_key,
        });
      }
    }

    if (row.sentence_audio_key && row.sentence_target && row.locale) {
      const key = `${row.target_lang}|${row.locale}|${row.sentence_target}`;
      if (!sentenceSourceBySignature.has(key)) {
        sentenceSourceBySignature.set(key, {
          source_pair_template_id: row.pair_template_id,
          source_key: row.sentence_audio_key,
        });
      }
    }
  }

  const operations = [];

  for (const row of rows) {
    if (!row.locale) continue;

    if (!row.word_audio_key && row.word_target) {
      const sig = `${row.target_lang}|${row.locale}|${row.word_target}`;
      const source = wordSourceBySignature.get(sig);
      if (source) {
        operations.push({
          kind: "word",
          pair_template_id: row.pair_template_id,
          target_lang: row.target_lang,
          native_lang: row.native_lang,
          source_pair_template_id: source.source_pair_template_id,
          source_key: source.source_key,
          target_key: buildStoragePath(row.locale, "word", row.pair_template_id),
          has_canonical_row: row.has_canonical_row,
        });
      }
    }

    if (!row.sentence_audio_key && row.sentence_target) {
      const sig = `${row.target_lang}|${row.locale}|${row.sentence_target}`;
      const source = sentenceSourceBySignature.get(sig);
      if (source) {
        operations.push({
          kind: "sentence",
          pair_template_id: row.pair_template_id,
          target_lang: row.target_lang,
          native_lang: row.native_lang,
          source_pair_template_id: source.source_pair_template_id,
          source_key: source.source_key,
          target_key: buildStoragePath(row.locale, "sentence", row.pair_template_id),
          has_canonical_row: row.has_canonical_row,
        });
      }
    }
  }

  const selectedOperations = LIMIT > 0 ? operations.slice(0, LIMIT) : operations;

  console.log(
    JSON.stringify(
      {
        totalRows: rows.length,
        availableWordSources: wordSourceBySignature.size,
        availableSentenceSources: sentenceSourceBySignature.size,
        operationsPlanned: selectedOperations.length,
        dryRun: DRY_RUN,
        concurrency: CONCURRENCY,
      },
      null,
      2
    )
  );

  if (DRY_RUN) return;

  const canonicalByTemplateId = new Map(
    rows.map((row) => [
      row.pair_template_id,
      {
        has_canonical_row: row.has_canonical_row,
        word_audio_key: row.word_audio_key,
        sentence_audio_key: row.sentence_audio_key,
      },
    ])
  );

  const copyResults = await runWithConcurrency(
    selectedOperations,
    async (op, idx) => {
      const status = await ensureCopiedObject(supabase, op.source_key, op.target_key);
      if ((idx + 1) % 250 === 0 || idx === selectedOperations.length - 1) {
        console.log(`Processed ${idx + 1}/${selectedOperations.length}`);
      }
      return { ...op, status };
    },
    CONCURRENCY
  );

  const insertsByTemplateId = new Map();
  const updatesByTemplateId = new Map();

  for (const result of copyResults) {
    const canonical = canonicalByTemplateId.get(result.pair_template_id);
    const existingWord = canonical?.word_audio_key || null;
    const existingSentence = canonical?.sentence_audio_key || null;

    if (!canonical?.has_canonical_row) {
      const entry = insertsByTemplateId.get(result.pair_template_id) || {
        pair_template_id: result.pair_template_id,
        word_audio_key: null,
        sentence_audio_key: null,
      };
      if (result.kind === "word" && !existingWord) entry.word_audio_key = result.target_key;
      if (result.kind === "sentence" && !existingSentence) entry.sentence_audio_key = result.target_key;
      insertsByTemplateId.set(result.pair_template_id, entry);
      continue;
    }

    const update = updatesByTemplateId.get(result.pair_template_id) || {
      pair_template_id: result.pair_template_id,
      word_audio_key: null,
      sentence_audio_key: null,
    };
    if (result.kind === "word" && !existingWord) update.word_audio_key = result.target_key;
    if (result.kind === "sentence" && !existingSentence) update.sentence_audio_key = result.target_key;
    updatesByTemplateId.set(result.pair_template_id, update);
  }

  const insertRows = Array.from(insertsByTemplateId.values()).filter(
    (row) => row.word_audio_key || row.sentence_audio_key
  );
  const updateRows = Array.from(updatesByTemplateId.values()).filter(
    (row) => row.word_audio_key || row.sentence_audio_key
  );

  await insertCanonicalRows(supabase, insertRows);
  await updateCanonicalRows(supabase, updateRows);

  const summary = copyResults.reduce(
    (acc, result) => {
      if (result.kind === "word") acc.wordCopies += 1;
      if (result.kind === "sentence") acc.sentenceCopies += 1;
      if (result.status === "copied") acc.copied += 1;
      if (result.status === "copied_via_upload") acc.copiedViaUpload += 1;
      if (result.status === "already_exists") acc.alreadyExists += 1;
      if (result.status === "same_path") acc.samePath += 1;
      return acc;
    },
    {
      copied: 0,
      copiedViaUpload: 0,
      alreadyExists: 0,
      samePath: 0,
      wordCopies: 0,
      sentenceCopies: 0,
      canonicalRowsInserted: insertRows.length,
      canonicalRowsUpdated: updateRows.length,
    }
  );

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("tts_copy_canonical_siblings failed:", error);
  process.exit(1);
});
