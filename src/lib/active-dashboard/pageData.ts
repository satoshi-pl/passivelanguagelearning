import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { toPct } from "@/lib/active-dashboard/shared";
import type {
  ActiveDashboardCategoryProgressEntry,
  ActiveDashboardMode,
  ActiveDashboardPageData,
} from "@/lib/active-dashboard/types";

type PairRow = {
  id: string;
  category: string | null;
  sentence_target: string | null;
  sentence_native: string | null;
};

type UserPairRow = {
  pair_id: string;
  word_mastered_at: string | null;
  sentence_mastered_at: string | null;
  word_active_mastered_at: string | null;
  sentence_active_mastered_at: string | null;
};

type ActiveAggregateRow = {
  category: string | null;
  words_total: number | null;
  words_done: number | null;
  words_pending: number | null;
  sentences_total: number | null;
  sentences_done: number | null;
  sentences_pending: number | null;
  ws_total_pairs: number | null;
  ws_pending_pairs: number | null;
};

type ActiveDashboardPageLoadResult =
  | { kind: "ok"; data: ActiveDashboardPageData }
  | { kind: "not_found"; deckId: string; error: unknown };

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function hasSentence(pair: PairRow) {
  return !!pair.sentence_target?.trim() && !!pair.sentence_native?.trim();
}

function inc(map: Map<string, number>, key: string, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

export async function getActiveDashboardPageData({
  supabase,
  userId,
  deckId,
  decodedBack,
}: {
  supabase: SupabaseServerClient;
  userId: string;
  deckId: string;
  decodedBack?: string;
}): Promise<ActiveDashboardPageLoadResult> {
  const [{ data: deck, error: deckErr }, { data: aggregateRows, error: aggregateErr }] = await Promise.all([
    supabase
      .from("decks")
      .select("id, name, target_lang, native_lang, level, created_at")
      .eq("id", deckId)
      .single(),
    supabase.rpc("get_active_dashboard_aggregates", { p_user_id: userId, p_deck_id: deckId }),
  ]);

  if (deckErr || !deck) {
    return { kind: "not_found", deckId, error: deckErr };
  }

  let overallWordsTotal = 0;
  let overallWordsDone = 0;
  let overallWordsPending = 0;
  let overallSentencesTotal = 0;
  let overallSentencesDone = 0;
  let overallSentencesPending = 0;
  let overallWsPendingPairs = 0;
  let categoryProgressByValue: Record<string, ActiveDashboardCategoryProgressEntry> = {};
  let categoryOptionsByMode: Record<ActiveDashboardMode, { value: string; label: string }[]> = {
    words: [],
    sentences: [],
    ws: [],
  };

  if (!aggregateErr && (aggregateRows ?? []).length > 0) {
    const rows = (aggregateRows ?? []) as ActiveAggregateRow[];
    const overallRow = rows.find((row) => !String(row.category ?? "").trim());

    overallWordsTotal = Number(overallRow?.words_total ?? 0);
    overallWordsDone = Number(overallRow?.words_done ?? 0);
    overallWordsPending = Number(overallRow?.words_pending ?? 0);
    overallSentencesTotal = Number(overallRow?.sentences_total ?? 0);
    overallSentencesDone = Number(overallRow?.sentences_done ?? 0);
    overallSentencesPending = Number(overallRow?.sentences_pending ?? 0);
    overallWsPendingPairs = Number(overallRow?.ws_pending_pairs ?? 0);

    const categoryRows = rows
      .map((row) => ({
        category: String(row.category ?? "").trim(),
        wordsTotal: Number(row.words_total ?? 0),
        wordsDone: Number(row.words_done ?? 0),
        wordsPending: Number(row.words_pending ?? 0),
        sentencesTotal: Number(row.sentences_total ?? 0),
        sentencesDone: Number(row.sentences_done ?? 0),
        sentencesPending: Number(row.sentences_pending ?? 0),
        wsTotalPairs: Number(row.ws_total_pairs ?? 0),
        wsPendingPairs: Number(row.ws_pending_pairs ?? 0),
      }))
      .filter((row) => row.category)
      .sort((a, b) => a.category.localeCompare(b.category));

    categoryProgressByValue = {};
    for (const row of categoryRows) {
      categoryProgressByValue[row.category] = {
        words: {
          total: row.wordsTotal,
          mastered: row.wordsDone,
          pct: toPct(row.wordsDone, row.wordsTotal),
        },
        sentences: {
          total: row.sentencesTotal,
          mastered: row.sentencesDone,
          pct: toPct(row.sentencesDone, row.sentencesTotal),
        },
      };
    }

    categoryOptionsByMode = {
      words: categoryRows
        .filter((row) => row.wordsPending > 0)
        .map((row) => ({ value: row.category, label: `${row.category} (${row.wordsTotal})` })),
      sentences: categoryRows
        .filter((row) => row.sentencesPending > 0)
        .map((row) => ({ value: row.category, label: `${row.category} (${row.sentencesTotal})` })),
      ws: categoryRows
        .filter((row) => row.wsPendingPairs > 0)
        .map((row) => ({ value: row.category, label: `${row.category} (${row.wsTotalPairs})` })),
    };
  } else {
    if (aggregateErr) {
      console.warn("[active-dashboard] aggregate RPC fallback:", aggregateErr.message);
    }

    const [{ data: pairRows, error: pairsErr }, { data: userPairRows, error: userPairsErr }] =
      await Promise.all([
        supabase
          .from("pairs")
          .select("id, category, sentence_target, sentence_native")
          .eq("deck_id", deckId),
        supabase
          .from("user_pairs")
          .select(
            "pair_id, word_mastered_at, sentence_mastered_at, word_active_mastered_at, sentence_active_mastered_at"
          )
          .eq("user_id", userId)
          .eq("deck_id", deckId),
      ]);

    const pairs = (pairsErr ? [] : pairRows ?? []) as PairRow[];
    const userPairs = (userPairsErr ? [] : userPairRows ?? []) as UserPairRow[];
    const progressByPairId = new Map<string, UserPairRow>();
    for (const row of userPairs) progressByPairId.set(row.pair_id, row);

    const categoryWordsTotal = new Map<string, number>();
    const categoryWordsDone = new Map<string, number>();
    const categoryWordsPending = new Map<string, number>();
    const categorySentencesTotal = new Map<string, number>();
    const categorySentencesDone = new Map<string, number>();
    const categorySentencesPending = new Map<string, number>();
    const categoryWsTotalPairs = new Map<string, number>();
    const categoryWsPendingPairs = new Map<string, number>();

    for (const pair of pairs) {
      const progress = progressByPairId.get(pair.id);
      const category = (pair.category || "").trim();
      const sentenceExists = hasSentence(pair);
      const wordUnlocked = !!progress?.word_mastered_at;
      const wordDone = wordUnlocked && !!progress?.word_active_mastered_at;
      const wordPending = wordUnlocked && !progress?.word_active_mastered_at;
      const sentenceUnlocked = !!progress?.sentence_mastered_at;
      const sentenceDone = sentenceUnlocked && !!progress?.sentence_active_mastered_at;
      const sentencePending = sentenceExists && sentenceUnlocked && !progress?.sentence_active_mastered_at;
      const wsUnlocked = wordUnlocked || (sentenceExists && sentenceUnlocked);
      const wsPending = wordPending || sentencePending;

      if (wordUnlocked) overallWordsTotal += 1;
      if (wordDone) overallWordsDone += 1;
      if (wordPending) overallWordsPending += 1;
      if (sentenceUnlocked) overallSentencesTotal += 1;
      if (sentenceDone) overallSentencesDone += 1;
      if (sentencePending) overallSentencesPending += 1;
      if (wsPending) overallWsPendingPairs += 1;
      if (!category) continue;
      if (wordUnlocked) inc(categoryWordsTotal, category);
      if (wordDone) inc(categoryWordsDone, category);
      if (wordPending) inc(categoryWordsPending, category);
      if (sentenceUnlocked) inc(categorySentencesTotal, category);
      if (sentenceDone) inc(categorySentencesDone, category);
      if (sentencePending) inc(categorySentencesPending, category);
      if (wsUnlocked) inc(categoryWsTotalPairs, category);
      if (wsPending) inc(categoryWsPendingPairs, category);
    }

    const allCategories = Array.from(
      new Set([
        ...categoryWordsTotal.keys(),
        ...categorySentencesTotal.keys(),
        ...categoryWsTotalPairs.keys(),
      ])
    ).sort((a, b) => a.localeCompare(b));

    categoryProgressByValue = {};
    for (const category of allCategories) {
      const wordsTotal = categoryWordsTotal.get(category) ?? 0;
      const wordsDone = categoryWordsDone.get(category) ?? 0;
      const sentencesTotal = categorySentencesTotal.get(category) ?? 0;
      const sentencesDone = categorySentencesDone.get(category) ?? 0;
      categoryProgressByValue[category] = {
        words: { total: wordsTotal, mastered: wordsDone, pct: toPct(wordsDone, wordsTotal) },
        sentences: { total: sentencesTotal, mastered: sentencesDone, pct: toPct(sentencesDone, sentencesTotal) },
      };
    }

    categoryOptionsByMode = {
      words: allCategories
        .filter((category) => (categoryWordsPending.get(category) ?? 0) > 0)
        .map((category) => ({ value: category, label: `${category} (${categoryWordsTotal.get(category) ?? 0})` })),
      sentences: allCategories
        .filter((category) => (categorySentencesPending.get(category) ?? 0) > 0)
        .map((category) => ({
          value: category,
          label: `${category} (${categorySentencesTotal.get(category) ?? 0})`,
        })),
      ws: allCategories
        .filter((category) => (categoryWsPendingPairs.get(category) ?? 0) > 0)
        .map((category) => ({ value: category, label: `${category} (${categoryWsTotalPairs.get(category) ?? 0})` })),
    };
  }

  const levelLabel = String(deck.level || "").toUpperCase().trim();
  const levelParam = levelLabel || "other";
  const defaultDecksHref = `/decks?target=${String(deck.target_lang).toLowerCase()}&support=${String(
    deck.native_lang
  ).toLowerCase()}&level=${encodeURIComponent(levelParam)}`;
  const backToDecksHref = decodedBack || defaultDecksHref;

  return {
    kind: "ok",
    data: {
      deckId,
      deckName: deck.name,
      targetLang: String(deck.target_lang).toLowerCase(),
      supportLang: String(deck.native_lang).toLowerCase(),
      levelLabel,
      backToDecksHref,
      overallWordsProgress: {
        total: overallWordsTotal,
        mastered: overallWordsDone,
        pct: toPct(overallWordsDone, overallWordsTotal),
      },
      overallSentencesProgress: {
        total: overallSentencesTotal,
        mastered: overallSentencesDone,
        pct: toPct(overallSentencesDone, overallSentencesTotal),
      },
      categoryOptionsByMode,
      categoryProgressByValue,
      pendingTotalsByMode: {
        words: overallWordsPending,
        sentences: overallSentencesPending,
        ws: overallWsPendingPairs,
      },
    },
  };
}
