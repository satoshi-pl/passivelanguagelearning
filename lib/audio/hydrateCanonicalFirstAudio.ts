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
  word_target_audio_url: string | null;
  sentence_target_audio_url: string | null;
};

type TemplateAudioAssetRow = {
  pair_template_id: string;
  word_audio_key: string | null;
  sentence_audio_key: string | null;
};

type QueryResult = Promise<{ data: unknown; error: unknown }>;
type QueryBuilder = {
  select: (columns: string) => {
    in: (column: string, values: string[]) => QueryResult;
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
  supabase: SupabaseLike,
  rows: T[],
  targetLang: string
): Promise<T[]> {
  if (!rows.length) return rows;

  const ids = Array.from(new Set(rows.map((r) => String(r.id || "").trim()).filter(Boolean)));
  if (!ids.length) return rows;

  const pairMetaById = new Map<string, PairMetaRow>();

  const { data: pairsData, error: pairsErr } = await supabase
    .from("pairs")
    .select("id, pair_template_id, word_target_audio_url, sentence_target_audio_url")
    .in("id", ids);

  if (!pairsErr && Array.isArray(pairsData)) {
    for (const raw of pairsData as PairMetaRow[]) {
      pairMetaById.set(raw.id, raw);
    }
  }

  const templateIds = Array.from(
    new Set(
      rows
        .map((r) => {
          const fromPair = pairMetaById.get(r.id)?.pair_template_id;
          return (fromPair || r.pair_template_id || "").trim();
        })
        .filter(Boolean)
    )
  );

  const templateById = new Map<string, TemplateAudioAssetRow>();
  if (templateIds.length > 0) {
    const { data: templateRows, error: templateErr } = await supabase
      .from("template_audio_assets")
      .select("pair_template_id, word_audio_key, sentence_audio_key")
      .in("pair_template_id", templateIds);

    if (!templateErr && Array.isArray(templateRows)) {
      for (const raw of templateRows as TemplateAudioAssetRow[]) {
        templateById.set(raw.pair_template_id, raw);
      }
    }
  }

  return rows.map((row) => {
    const pairMeta = pairMetaById.get(row.id);
    const pairTemplateId = (pairMeta?.pair_template_id || row.pair_template_id || "").trim() || null;
    const templateAudio = pairTemplateId ? templateById.get(pairTemplateId) : undefined;

    const pairWordRaw = firstNonEmpty(row.word_target_audio_url, pairMeta?.word_target_audio_url);
    const pairSentenceRaw = firstNonEmpty(
      row.sentence_target_audio_url,
      pairMeta?.sentence_target_audio_url
    );

    const wordRaw = resolvePreferredAudioRaw({
      canonicalKey: templateAudio?.word_audio_key ?? null,
      pairAudioRaw: pairWordRaw,
      targetLang,
      kind: "word",
      pairTemplateId,
    });

    const sentenceRaw = resolvePreferredAudioRaw({
      canonicalKey: templateAudio?.sentence_audio_key ?? null,
      pairAudioRaw: pairSentenceRaw,
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

