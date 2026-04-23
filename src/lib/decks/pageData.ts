import type { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildDecksHref,
  deckLevelButtonLabel,
  deckLevelUrlValue,
  langName,
  levelRank,
  levelUrlSortKey,
  LEVEL_URL_OTHER,
  parseLevelSearchParam,
  toPct,
} from "@/lib/decks/shared";
import type { DecksDeckRow, DecksDualProgress, DecksPageData } from "@/lib/decks/types";

type PairDeckRow = {
  deck_id: string;
};

type UserPairDeckRow = {
  deck_id: string;
  word_mastered_at: string | null;
  sentence_mastered_at: string | null;
};

type DeckProgressAggregateRow = {
  deck_id: string;
  total_pairs: number | null;
  words_mastered: number | null;
  sentences_mastered: number | null;
};

type DecksPageLoadResult =
  | { kind: "ok"; data: DecksPageData }
  | { kind: "setup" }
  | { kind: "error"; error: unknown };

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function createEmptyDeckProgress(deckIds: string[]): Record<string, DecksDualProgress> {
  const empty: Record<string, DecksDualProgress> = {};
  for (const deckId of deckIds) {
    empty[deckId] = {
      words: { total: 0, mastered: 0, pct: 0 },
      sentences: { total: 0, mastered: 0, pct: 0 },
    };
  }
  return empty;
}

async function getDeckProgressByDeckFallback(
  supabase: SupabaseServerClient,
  userId: string,
  deckIds: string[]
): Promise<Record<string, DecksDualProgress>> {
  const empty = createEmptyDeckProgress(deckIds);
  if (deckIds.length === 0) return empty;

  const [{ data: pairRows, error: pairErr }, { data: userPairRows, error: userPairErr }] = await Promise.all([
    supabase.from("pairs").select("deck_id").in("deck_id", deckIds),
    supabase
      .from("user_pairs")
      .select("deck_id, word_mastered_at, sentence_mastered_at")
      .eq("user_id", userId)
      .in("deck_id", deckIds),
  ]);

  if (pairErr || userPairErr) return empty;

  const totalsByDeck: Record<string, number> = {};
  for (const row of (pairRows ?? []) as PairDeckRow[]) {
    const key = row.deck_id;
    totalsByDeck[key] = (totalsByDeck[key] ?? 0) + 1;
  }

  const wordsByDeck: Record<string, number> = {};
  const sentencesByDeck: Record<string, number> = {};
  for (const row of (userPairRows ?? []) as UserPairDeckRow[]) {
    const key = row.deck_id;
    if (row.word_mastered_at) wordsByDeck[key] = (wordsByDeck[key] ?? 0) + 1;
    if (row.sentence_mastered_at) sentencesByDeck[key] = (sentencesByDeck[key] ?? 0) + 1;
  }

  for (const deckId of deckIds) {
    const total = totalsByDeck[deckId] ?? 0;
    const wMastered = wordsByDeck[deckId] ?? 0;
    const sMastered = sentencesByDeck[deckId] ?? 0;
    empty[deckId] = {
      words: { total, mastered: wMastered, pct: toPct(wMastered, total) },
      sentences: { total, mastered: sMastered, pct: toPct(sMastered, total) },
    };
  }

  return empty;
}

async function getDeckProgressByDeckBulk(
  supabase: SupabaseServerClient,
  userId: string,
  selectedTarget: string,
  selectedSupport: string,
  deckIds: string[]
): Promise<Record<string, DecksDualProgress>> {
  const empty = createEmptyDeckProgress(deckIds);
  if (deckIds.length === 0) return empty;

  // First paint only needs per-deck progress totals, so prefer the aggregate RPC
  // over pulling raw `pairs` and `user_pairs` rows for every visible deck.
  const { data: aggregateRows, error: aggregateErr } = await supabase.rpc("get_my_decks_progress_aggregates", {
    p_user_id: userId,
    p_target_lang: selectedTarget,
    p_native_lang: selectedSupport,
  });

  if (!aggregateErr && (aggregateRows ?? []).length > 0) {
    for (const row of (aggregateRows ?? []) as DeckProgressAggregateRow[]) {
      const deckId = String(row.deck_id || "");
      if (!deckId || !empty[deckId]) continue;
      const total = Number(row.total_pairs ?? 0);
      const wordsMastered = Number(row.words_mastered ?? 0);
      const sentencesMastered = Number(row.sentences_mastered ?? 0);
      empty[deckId] = {
        words: { total, mastered: wordsMastered, pct: toPct(wordsMastered, total) },
        sentences: { total, mastered: sentencesMastered, pct: toPct(sentencesMastered, total) },
      };
    }
    return empty;
  }

  if (aggregateErr) {
    console.warn("[my-decks] aggregate RPC fallback:", aggregateErr.message);
  }

  return getDeckProgressByDeckFallback(supabase, userId, deckIds);
}

export async function getDecksPageData({
  supabase,
  userId,
  requestedTarget,
  requestedSupport,
  requestedLevel,
}: {
  supabase: SupabaseServerClient;
  userId: string;
  requestedTarget?: string;
  requestedSupport?: string;
  requestedLevel?: string;
}): Promise<DecksPageLoadResult> {
  const { data: decks, error: decksError } = await supabase
    .from("decks")
    .select("id, name, target_lang, native_lang, level, created_at")
    .order("target_lang", { ascending: true })
    .order("level", { ascending: true })
    .order("native_lang", { ascending: true })
    .order("name", { ascending: true });

  if (decksError) {
    return { kind: "error", error: decksError };
  }

  const allDecks = (decks as DecksDeckRow[]) ?? [];
  if (allDecks.length === 0) {
    return { kind: "setup" };
  }

  const targetOptions = Array.from(
    new Set(allDecks.map((deck) => (deck.target_lang || "").toLowerCase()).filter(Boolean))
  ).sort((a, b) => langName(a).localeCompare(langName(b)));

  const supportOptionsByTarget: Record<string, string[]> = {};
  for (const target of targetOptions) {
    supportOptionsByTarget[target] = Array.from(
      new Set(
        allDecks
          .filter((deck) => (deck.target_lang || "").toLowerCase() === target)
          .map((deck) => (deck.native_lang || "").toLowerCase())
          .filter(Boolean)
      )
    ).sort((a, b) => langName(a).localeCompare(langName(b)));
  }

  const normalizedTarget = (requestedTarget || "").toLowerCase().trim();
  const selectedTarget =
    targetOptions.includes(normalizedTarget) ? normalizedTarget : targetOptions[0] ?? "";

  const normalizedSupport = (requestedSupport || "").toLowerCase().trim();
  const availableSupportsForSelectedTarget = supportOptionsByTarget[selectedTarget] ?? [];
  const selectedSupport =
    availableSupportsForSelectedTarget.includes(normalizedSupport)
      ? normalizedSupport
      : availableSupportsForSelectedTarget[0] ?? "";

  const pairDecks = allDecks
    .filter(
      (deck) =>
        (deck.target_lang || "").toLowerCase() === selectedTarget &&
        (deck.native_lang || "").toLowerCase() === selectedSupport
    )
    .sort((a, b) => levelRank(a.level) - levelRank(b.level));

  const levelUrlValues = Array.from(new Set(pairDecks.map((deck) => deckLevelUrlValue(deck.level)))).sort(
    (a, b) => levelUrlSortKey(a) - levelUrlSortKey(b)
  );

  const normalizedLevel = parseLevelSearchParam(requestedLevel || "");
  const selectedLevelUrl =
    normalizedLevel && levelUrlValues.includes(normalizedLevel)
      ? normalizedLevel
      : levelUrlValues[0] ?? LEVEL_URL_OTHER;

  const pairDeckIds = pairDecks.map((deck) => deck.id);
  const levelOptions = levelUrlValues.map((urlVal) => {
    const sampleDeck = pairDecks.find((deck) => deckLevelUrlValue(deck.level) === urlVal);
    const label = sampleDeck ? deckLevelButtonLabel(sampleDeck.level) : urlVal;
    return { value: urlVal, label };
  });

  const [progressByDeck, { count: favoritesCount, error: favoritesErr }] = await Promise.all([
    getDeckProgressByDeckBulk(supabase, userId, selectedTarget, selectedSupport, pairDeckIds),
    supabase
      .from("user_favorites")
      .select("pair_id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("target_lang", selectedTarget)
      .eq("native_lang", selectedSupport),
  ]);

  return {
    kind: "ok",
    data: {
      targetOptions,
      supportOptionsByTarget,
      selectedTarget,
      selectedSupport,
      availableSupportsForSelectedTarget,
      levelOptions,
      selectedLevelUrl,
      pairDecks,
      progressByDeck,
      favoritesTotal: favoritesErr ? 0 : favoritesCount ?? 0,
      favoritesHref: `/favorites/${selectedTarget}?support=${selectedSupport}&mode=ws&entry=my_decks`,
      currentDecksHref: buildDecksHref({
        target: selectedTarget,
        support: selectedSupport,
        level: selectedLevelUrl,
      }),
    },
  };
}
