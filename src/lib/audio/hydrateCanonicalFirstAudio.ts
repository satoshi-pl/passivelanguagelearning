import { resolvePreferredAudioRaw } from "./templateAudio";

type PairLike = {
  id: string;
  pair_template_id?: string | null;
  word_target_audio_url?: string | null;
  sentence_target_audio_url?: string | null;
};

type PairMetaRow = {
  id: string;
  pair_template_id: string | null;
};

type TemplateAudioAssetRow = {
  pair_template_id: string;
  word_audio_key: string | null;
  sentence_audio_key: string | null;
};

type QueryBuilder = {
  select: (columns: string) => {
    in: (column: string, values: string[]) => unknown;
  };
};
type SupabaseLike = {
  from: (table: string) => QueryBuilder;
};

function firstNonEmpty(...vals: Array<string | null | undefined>) {
  for (const v of vals) {
    if (typeof v !== "string") continue;
    const t = v.trim();
    if (t) return t;
  }
  return null;
}

export async function hydrateCanonicalFirstAudioForPairs<T extends PairLike>(
  supabase: unknown,
  rows: T[],
  targetLang: string
): Promise<T[]> {
  if (!rows.length) return rows;
  const client = supabase as SupabaseLike;

  const ids = Array.from(new Set(rows.map((r) => String(r.id || "").trim()).filter(Boolean)));
  if (!ids.length) return rows;

  const pairTemplateById = new Map<string, string | null>();

  for (const row of rows) {
    const pairId = String(row.id || "").trim();
    if (!pairId) continue;
    if (typeof row.pair_template_id !== "undefined") {
      pairTemplateById.set(pairId, row.pair_template_id ?? null);
    }
  }

  const idsMissingTemplateMeta = ids.filter((id) => !pairTemplateById.has(id));

  let pairsMetaData: unknown = null;
  let pairsMetaErr: unknown = null;
  if (idsMissingTemplateMeta.length > 0) {
    const pairsMetaResult = (await (client
      .from("pairs")
      .select("id, pair_template_id")
      .in("id", idsMissingTemplateMeta) as Promise<{ data: unknown; error: unknown }>)) as {
      data: unknown;
      error: unknown;
    };
    pairsMetaData = pairsMetaResult.data;
    pairsMetaErr = pairsMetaResult.error;
  }

  if (!pairsMetaErr && Array.isArray(pairsMetaData)) {
    for (const raw of pairsMetaData as PairMetaRow[]) {
      pairTemplateById.set(raw.id, raw.pair_template_id);
    }
  }

  const templateIds = Array.from(
    new Set(
      rows
        .map((r) => {
          const fromPair = pairTemplateById.get(r.id);
          return (fromPair || r.pair_template_id || "").trim();
        })
        .filter(Boolean)
    )
  );

  const templateById = new Map<string, TemplateAudioAssetRow>();
  if (templateIds.length > 0) {
    const { data: templateRows, error: templateErr } = (await (client
      .from("template_audio_assets")
      .select("pair_template_id, word_audio_key, sentence_audio_key")
      .in("pair_template_id", templateIds) as Promise<{ data: unknown; error: unknown }>)) as {
      data: unknown;
      error: unknown;
    };

    if (!templateErr && Array.isArray(templateRows)) {
      for (const raw of templateRows as TemplateAudioAssetRow[]) {
        templateById.set(raw.pair_template_id, raw);
      }
    }
  }

  return rows.map((row) => {
    const pairTemplateId = (pairTemplateById.get(row.id) || row.pair_template_id || "").trim() || null;
    const templateAudio = pairTemplateId ? templateById.get(pairTemplateId) : undefined;

    const wordRaw = resolvePreferredAudioRaw({
      canonicalKey: templateAudio?.word_audio_key ?? null,
      // Pair-row audio fallback is intentionally removed now that canonical
      // coverage is complete. We still keep pair_template_id recovery so the
      // retained pt-* fallback remains available as a temporary final safety net.
      pairAudioRaw: null,
      targetLang,
      kind: "word",
      pairTemplateId,
    });

    const sentenceRaw = resolvePreferredAudioRaw({
      canonicalKey: templateAudio?.sentence_audio_key ?? null,
      pairAudioRaw: null,
      targetLang,
      kind: "sentence",
      pairTemplateId,
    });

    return {
      ...row,
      word_target_audio_url: wordRaw,
      sentence_target_audio_url: sentenceRaw,
    };
  });
}

