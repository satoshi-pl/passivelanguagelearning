import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { toPct } from "@/lib/passive-dashboard/shared";
import type {
  PassiveDashboardCategoryOption,
  PassiveDashboardCategoryProgressEntry,
  PassiveDashboardPageData,
} from "@/lib/passive-dashboard/types";

type PairRow = {
  id: string;
  category: string | null;
};

type UserPairRow = {
  pair_id: string;
  word_mastered_at: string | null;
  sentence_mastered_at: string | null;
};

type PassiveAggregateRow = {
  category: string | null;
  total_pairs: number | null;
  words_mastered: number | null;
  sentences_mastered: number | null;
};

type PassiveDashboardPageLoadResult =
  | { kind: "ok"; data: PassiveDashboardPageData }
  | { kind: "not_found"; deckId: string; error: unknown }
  | { kind: "error"; href: string; error: unknown };

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export async function getPassiveDashboardPageData({
  supabase,
  userId,
  deckId,
  decodedBack,
}: {
  supabase: SupabaseServerClient;
  userId: string;
  deckId: string;
  decodedBack?: string;
}): Promise<PassiveDashboardPageLoadResult> {
  const [{ data: deck, error: deckErr }, { data: aggregateRows, error: aggregateErr }] = await Promise.all([
    supabase
      .from("decks")
      .select("id, name, target_lang, native_lang, level, created_at")
      .eq("id", deckId)
      .single(),
    supabase.rpc("get_passive_dashboard_aggregates", { p_user_id: userId, p_deck_id: deckId }),
  ]);

  if (deckErr || !deck) {
    return { kind: "not_found", deckId, error: deckErr };
  }

  let overallTotal = 0;
  let overallWordsMastered = 0;
  let overallSentencesMastered = 0;
  let categoryOptions: PassiveDashboardCategoryOption[] = [];
  let categoryProgressByValue: Record<string, PassiveDashboardCategoryProgressEntry> = {};

  if (!aggregateErr && (aggregateRows ?? []).length > 0) {
    const rows = (aggregateRows ?? []) as PassiveAggregateRow[];
    const overallRow = rows.find((row) => !String(row.category ?? "").trim());

    overallTotal = Number(overallRow?.total_pairs ?? 0);
    overallWordsMastered = Number(overallRow?.words_mastered ?? 0);
    overallSentencesMastered = Number(overallRow?.sentences_mastered ?? 0);

    const categoryRows = rows
      .map((row) => ({
        category: String(row.category ?? "").trim(),
        total: Number(row.total_pairs ?? 0),
        wordsMastered: Number(row.words_mastered ?? 0),
        sentencesMastered: Number(row.sentences_mastered ?? 0),
      }))
      .filter((row) => row.category && row.total > 0)
      .sort((a, b) => a.category.localeCompare(b.category));

    categoryOptions = categoryRows.map((row) => ({
      value: row.category,
      label: `${row.category} (${row.total})`,
    }));

    categoryProgressByValue = {};
    for (const row of categoryRows) {
      categoryProgressByValue[row.category] = {
        words: {
          total: row.total,
          mastered: row.wordsMastered,
          pct: toPct(row.wordsMastered, row.total),
        },
        sentences: {
          total: row.total,
          mastered: row.sentencesMastered,
          pct: toPct(row.sentencesMastered, row.total),
        },
      };
    }
  } else {
    if (aggregateErr) {
      console.warn("[passive-dashboard] aggregate RPC fallback:", aggregateErr.message);
    }

    const [{ data: pairRows, error: pairsErr }, { data: userPairRows, error: userPairsErr }] =
      await Promise.all([
        supabase.from("pairs").select("id, category").eq("deck_id", deckId),
        supabase
          .from("user_pairs")
          .select("pair_id, word_mastered_at, sentence_mastered_at")
          .eq("user_id", userId)
          .eq("deck_id", deckId),
      ]);

    if (pairsErr || userPairsErr) {
      return { kind: "error", href: "/decks", error: pairsErr || userPairsErr };
    }

    const pairs = (pairRows ?? []) as PairRow[];
    const userPairs = (userPairRows ?? []) as UserPairRow[];
    const progressByPairId = new Map<string, UserPairRow>();
    for (const row of userPairs) progressByPairId.set(row.pair_id, row);

    const categoryTotals = new Map<string, number>();
    const categoryWordsMastered = new Map<string, number>();
    const categorySentencesMastered = new Map<string, number>();

    for (const pair of pairs) {
      overallTotal += 1;
      const progress = progressByPairId.get(pair.id);
      if (progress?.word_mastered_at) overallWordsMastered += 1;
      if (progress?.sentence_mastered_at) overallSentencesMastered += 1;

      const category = (pair.category || "").trim();
      if (!category) continue;

      categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + 1);
      if (progress?.word_mastered_at) {
        categoryWordsMastered.set(category, (categoryWordsMastered.get(category) ?? 0) + 1);
      }
      if (progress?.sentence_mastered_at) {
        categorySentencesMastered.set(category, (categorySentencesMastered.get(category) ?? 0) + 1);
      }
    }

    categoryOptions = Array.from(categoryTotals.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([value, count]) => ({
        value,
        label: `${value} (${count})`,
      }));

    categoryProgressByValue = {};
    for (const [category, total] of categoryTotals.entries()) {
      const wordsMastered = categoryWordsMastered.get(category) ?? 0;
      const sentencesMastered = categorySentencesMastered.get(category) ?? 0;
      categoryProgressByValue[category] = {
        words: { total, mastered: wordsMastered, pct: toPct(wordsMastered, total) },
        sentences: { total, mastered: sentencesMastered, pct: toPct(sentencesMastered, total) },
      };
    }
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
        total: overallTotal,
        mastered: overallWordsMastered,
        pct: toPct(overallWordsMastered, overallTotal),
      },
      overallSentencesProgress: {
        total: overallTotal,
        mastered: overallSentencesMastered,
        pct: toPct(overallSentencesMastered, overallTotal),
      },
      categoryOptions,
      categoryProgressByValue,
    },
  };
}
