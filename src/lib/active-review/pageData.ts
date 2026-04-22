import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActiveReviewMode, ActiveReviewPageData } from "@/lib/active-review/types";

type PairRow = {
  id: string;
  category: string | null;
  sentence_target: string | null;
  sentence_native: string | null;
};

type UserPairRow = {
  pair_id: string;
  word_active_mastered_at: string | null;
  sentence_active_mastered_at: string | null;
};

type ReviewAggregateRow = {
  category: string | null;
  words_reviewable: number | null;
  sentences_reviewable: number | null;
  ws_reviewable: number | null;
};

type DeckLookupRow = {
  id: string;
  name: string;
  target_lang: string;
  native_lang: string;
  level: string | null;
};

type ActiveReviewPageLoadResult =
  | { kind: "ok"; data: ActiveReviewPageData }
  | { kind: "not_found"; deckId: string; error: unknown }
  | { kind: "error"; href: string; error: unknown };

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function hasSentence(pair: PairRow) {
  return !!pair.sentence_target?.trim() && !!pair.sentence_native?.trim();
}

function inc(map: Map<string, number>, key: string, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

export async function getActiveReviewPageData({
  supabase,
  userId,
  deckId,
  mode,
  backParam,
  deckNameFromParam,
  targetLangFromParam,
  supportLangFromParam,
  levelLabelFromParam,
}: {
  supabase: SupabaseServerClient;
  userId: string;
  deckId: string;
  mode: ActiveReviewMode;
  backParam: string;
  deckNameFromParam: string;
  targetLangFromParam: string;
  supportLangFromParam: string;
  levelLabelFromParam: string;
}): Promise<ActiveReviewPageLoadResult> {
  const hasDeckContextFromEntry =
    !!deckNameFromParam && !!targetLangFromParam && !!supportLangFromParam;

  const deckPromise = hasDeckContextFromEntry
    ? Promise.resolve({
        data: {
          id: deckId,
          name: deckNameFromParam,
          target_lang: targetLangFromParam,
          native_lang: supportLangFromParam,
          level: levelLabelFromParam || null,
        } satisfies DeckLookupRow,
        error: null,
      })
    : supabase
        .from("decks")
        .select("id, name, target_lang, native_lang, level")
        .eq("id", deckId)
        .single();

  const activeDeckHref =
    backParam && backParam.startsWith("/")
      ? backParam
      : `/decks/${deckId}/active?mode=${mode}`;

  const aggregatePromise = supabase.rpc(
    "get_active_review_aggregates",
    { p_user_id: userId, p_deck_id: deckId }
  );

  const [{ data: deck, error: deckErr }, { data: aggregateRows, error: aggregateErr }] =
    await Promise.all([deckPromise, aggregatePromise]);

  if (deckErr || !deck) {
    return { kind: "not_found", deckId, error: deckErr };
  }

  let overallWordsReviewable = 0;
  let overallSentencesReviewable = 0;
  let overallWsReviewable = 0;
  let categoryOptionsByMode: Record<ActiveReviewMode, { value: string; label: string }[]> = {
    words: [],
    sentences: [],
    ws: [],
  };

  if (!aggregateErr && (aggregateRows ?? []).length > 0) {
    const rows = (aggregateRows ?? []) as ReviewAggregateRow[];
    const overallRow = rows.find((row) => !String(row.category ?? "").trim());
    overallWordsReviewable = Number(overallRow?.words_reviewable ?? 0);
    overallSentencesReviewable = Number(overallRow?.sentences_reviewable ?? 0);
    overallWsReviewable = Number(overallRow?.ws_reviewable ?? 0);

    const categoryRows = rows
      .map((row) => ({
        category: String(row.category ?? "").trim(),
        words: Number(row.words_reviewable ?? 0),
        sentences: Number(row.sentences_reviewable ?? 0),
        ws: Number(row.ws_reviewable ?? 0),
      }))
      .filter((row) => row.category)
      .sort((a, b) => a.category.localeCompare(b.category));

    categoryOptionsByMode = {
      words: categoryRows
        .filter((row) => row.words > 0)
        .map((row) => ({ value: row.category, label: `${row.category} (${row.words})` })),
      sentences: categoryRows
        .filter((row) => row.sentences > 0)
        .map((row) => ({ value: row.category, label: `${row.category} (${row.sentences})` })),
      ws: categoryRows
        .filter((row) => row.ws > 0)
        .map((row) => ({ value: row.category, label: `${row.category} (${row.ws})` })),
    };
  } else {
    if (aggregateErr) {
      console.warn("[active-review] aggregate RPC fallback:", aggregateErr.message);
    }
    const [{ data: pairRows, error: pairsErr }, { data: userPairRows, error: userPairsErr }] =
      await Promise.all([
        supabase
          .from("pairs")
          .select("id, category, sentence_target, sentence_native")
          .eq("deck_id", deckId),
        supabase
          .from("user_pairs")
          .select("pair_id, word_active_mastered_at, sentence_active_mastered_at")
          .eq("user_id", userId)
          .eq("deck_id", deckId),
      ]);

    if (pairsErr || userPairsErr) {
      return { kind: "error", href: activeDeckHref, error: pairsErr || userPairsErr };
    }

    const pairs = (pairRows ?? []) as PairRow[];
    const userPairs = (userPairRows ?? []) as UserPairRow[];
    const progressByPairId = new Map<string, UserPairRow>();
    for (const row of userPairs) progressByPairId.set(row.pair_id, row);

    const categoryWordsReviewable = new Map<string, number>();
    const categorySentencesReviewable = new Map<string, number>();
    const categoryWsReviewable = new Map<string, number>();

    for (const pair of pairs) {
      const progress = progressByPairId.get(pair.id);
      const category = (pair.category || "").trim();
      const sentenceExists = hasSentence(pair);
      const hasWord = !!progress?.word_active_mastered_at;
      const hasSentenceReview = sentenceExists && !!progress?.sentence_active_mastered_at;
      const hasWs = hasWord || hasSentenceReview;
      if (hasWord) overallWordsReviewable += 1;
      if (hasSentenceReview) overallSentencesReviewable += 1;
      if (hasWs) overallWsReviewable += 1;
      if (!category) continue;
      if (hasWord) inc(categoryWordsReviewable, category);
      if (hasSentenceReview) inc(categorySentencesReviewable, category);
      if (hasWs) inc(categoryWsReviewable, category);
    }

    const allCategories = Array.from(
      new Set([
        ...categoryWordsReviewable.keys(),
        ...categorySentencesReviewable.keys(),
        ...categoryWsReviewable.keys(),
      ])
    ).sort((a, b) => a.localeCompare(b));

    categoryOptionsByMode = {
      words: allCategories
        .filter((category) => (categoryWordsReviewable.get(category) ?? 0) > 0)
        .map((category) => ({
          value: category,
          label: `${category} (${categoryWordsReviewable.get(category) ?? 0})`,
        })),
      sentences: allCategories
        .filter((category) => (categorySentencesReviewable.get(category) ?? 0) > 0)
        .map((category) => ({
          value: category,
          label: `${category} (${categorySentencesReviewable.get(category) ?? 0})`,
        })),
      ws: allCategories
        .filter((category) => (categoryWsReviewable.get(category) ?? 0) > 0)
        .map((category) => ({
          value: category,
          label: `${category} (${categoryWsReviewable.get(category) ?? 0})`,
        })),
    };
  }

  return {
    kind: "ok",
    data: {
      deckId,
      deckName: deck.name,
      targetLang: String(deck.target_lang).toLowerCase(),
      supportLang: String(deck.native_lang).toLowerCase(),
      level: String(deck.level || "").trim().toUpperCase() || "other",
      backToDeckHref: activeDeckHref,
      categoryOptionsByMode,
      reviewTotalsByMode: {
        words: overallWordsReviewable,
        sentences: overallSentencesReviewable,
        ws: overallWsReviewable,
      },
    },
  };
}
