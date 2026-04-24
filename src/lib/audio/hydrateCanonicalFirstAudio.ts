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

function summarizeLookupError(error: unknown) {
  if (!error || typeof error !== "object") {
    return { message: String(error ?? "unknown error") };
  }

  const candidate = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
    hint?: unknown;
  };

  return {
    code: typeof candidate.code === "string" ? candidate.code : null,
    message:
      typeof candidate.message === "string"
        ? candidate.message
        : String(error),
    details: typeof candidate.details === "string" ? candidate.details : null,
    hint: typeof candidate.hint === "string" ? candidate.hint : null,
  };
}

export async function hydrateCanonicalFirstAudioForPairs<T extends PairLike>(
  supabase: unknown,
  rows: T[]
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

  if (pairsMetaErr) {
    console.error("[audio/hydrator] pair template recovery lookup failed", {
      pairCount: ids.length,
      missingPairTemplateIds: idsMissingTemplateMeta.length,
      error: summarizeLookupError(pairsMetaErr),
    });
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

    if (templateErr) {
      console.error("[audio/hydrator] canonical template audio lookup failed; using runtime fallback", {
        pairCount: ids.length,
        templateCount: templateIds.length,
        error: summarizeLookupError(templateErr),
      });
    }

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
    });

    const sentenceRaw = resolvePreferredAudioRaw({
      canonicalKey: templateAudio?.sentence_audio_key ?? null,
    });

    return {
      ...row,
      word_target_audio_url: wordRaw,
      sentence_target_audio_url: sentenceRaw,
    };
  });
}

