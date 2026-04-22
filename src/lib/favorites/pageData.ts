import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { FavoritesCategoryOption, FavoritesMode, FavoritesPageData } from "@/lib/favorites/types";
import { buildFavoritesHref, langName } from "@/lib/favorites/shared";

type FavoriteRow = {
  pair_id: string;
  kind: "word" | "sentence" | string;
};

type PairRow = {
  id: string;
  category: string | null;
  sentence_target: string | null;
  sentence_native: string | null;
};

type FavoritesAggregateRow = {
  category: string | null;
  words_total: number | null;
  sentences_total: number | null;
  ws_total: number | null;
  total_favorites: number | null;
};

type SupportDeckRow = {
  native_lang: string | null;
};

type FavoritesPageLoadResult =
  | { kind: "ok"; data: FavoritesPageData }
  | { kind: "redirect"; href: string }
  | { kind: "error"; href: string; error: unknown };

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function hasSentence(pair: PairRow | undefined) {
  return !!pair?.sentence_target?.trim() && !!pair?.sentence_native?.trim();
}

function inc(map: Map<string, number>, key: string, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function normalizeSupportOptions(rows: SupportDeckRow[]) {
  return Array.from(
    new Set(rows.map((row) => (row.native_lang || "").toLowerCase().trim()).filter(Boolean))
  ).sort((a, b) => langName(a).localeCompare(langName(b)));
}

export async function getFavoritesPageData({
  supabase,
  userId,
  targetLang,
  requestedSupport,
  mode,
}: {
  supabase: SupabaseServerClient;
  userId: string;
  targetLang: string;
  requestedSupport: string;
  mode: FavoritesMode;
}): Promise<FavoritesPageLoadResult> {
  let selectedSupport: string;

  if (requestedSupport) {
    const { data: supportProbe, error: supportProbeErr } = await supabase
      .from("decks")
      .select("id")
      .eq("target_lang", targetLang)
      .ilike("native_lang", requestedSupport)
      .limit(1)
      .maybeSingle();

    if (supportProbeErr) {
      return { kind: "error", href: "/decks", error: supportProbeErr };
    }

    if (supportProbe) {
      selectedSupport = requestedSupport;
    } else {
      const { data: supportDecks, error: supportDecksErr } = await supabase
        .from("decks")
        .select("native_lang")
        .eq("target_lang", targetLang);

      if (supportDecksErr) {
        return { kind: "error", href: "/decks", error: supportDecksErr };
      }

      const supportOptions = normalizeSupportOptions((supportDecks ?? []) as SupportDeckRow[]);
      if (supportOptions.length === 0) {
        return { kind: "redirect", href: "/decks" };
      }

      selectedSupport = supportOptions[0]!;
      if (requestedSupport !== selectedSupport) {
        return {
          kind: "redirect",
          href: buildFavoritesHref({ target: targetLang, support: selectedSupport, mode }),
        };
      }
    }
  } else {
    const { data: supportDecks, error: supportDecksErr } = await supabase
      .from("decks")
      .select("native_lang")
      .eq("target_lang", targetLang);

    if (supportDecksErr) {
      return { kind: "error", href: "/decks", error: supportDecksErr };
    }

    const supportOptions = normalizeSupportOptions((supportDecks ?? []) as SupportDeckRow[]);
    if (supportOptions.length === 0) {
      return { kind: "redirect", href: "/decks" };
    }

    selectedSupport = supportOptions[0]!;
  }

  const decksHref = `/decks?target=${targetLang}&support=${selectedSupport}`;

  let total = 0;
  let overallWordsTotal = 0;
  let overallSentencesTotal = 0;
  let overallWsTotal = 0;
  let categoryOptionsByMode: Record<FavoritesMode, FavoritesCategoryOption[]> = {
    words: [],
    sentences: [],
    ws: [],
  };

  const { data: aggregateRows, error: aggregateErr } = await supabase.rpc(
    "get_favorites_aggregates",
    {
      p_user_id: userId,
      p_target_lang: targetLang,
      p_native_lang: selectedSupport,
    }
  );

  if (!aggregateErr && (aggregateRows ?? []).length > 0) {
    const rows = (aggregateRows ?? []) as FavoritesAggregateRow[];
    const overallRow = rows.find((row) => !String(row.category ?? "").trim());
    total = Number(overallRow?.total_favorites ?? 0);
    overallWordsTotal = Number(overallRow?.words_total ?? 0);
    overallSentencesTotal = Number(overallRow?.sentences_total ?? 0);
    overallWsTotal = Number(overallRow?.ws_total ?? 0);

    const categoryRows = rows
      .map((row) => ({
        category: String(row.category ?? "").trim(),
        words: Number(row.words_total ?? 0),
        sentences: Number(row.sentences_total ?? 0),
        ws: Number(row.ws_total ?? 0),
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
      console.warn("[favorites] aggregate RPC fallback:", aggregateErr.message);
    }

    const { count: favCount, error: favErr } = await supabase
      .from("user_favorites")
      .select("pair_id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("target_lang", targetLang)
      .eq("native_lang", selectedSupport);

    if (favErr) {
      return { kind: "error", href: decksHref, error: favErr };
    }

    total = favCount ?? 0;

    const { data: favoriteRows, error: favoriteRowsErr } = await supabase
      .from("user_favorites")
      .select("pair_id, kind")
      .eq("user_id", userId)
      .eq("target_lang", targetLang)
      .eq("native_lang", selectedSupport);

    if (favoriteRowsErr) {
      return { kind: "error", href: decksHref, error: favoriteRowsErr };
    }

    const favorites = (favoriteRows ?? []) as FavoriteRow[];
    const pairIds = Array.from(new Set(favorites.map((row) => row.pair_id).filter(Boolean)));

    let pairs: PairRow[] = [];
    if (pairIds.length > 0) {
      const { data: pairRows, error: pairErr } = await supabase
        .from("pairs")
        .select("id, category, sentence_target, sentence_native")
        .in("id", pairIds);

      if (pairErr) {
        return { kind: "error", href: decksHref, error: pairErr };
      }

      pairs = (pairRows ?? []) as PairRow[];
    }

    const pairById = new Map<string, PairRow>();
    for (const pair of pairs) pairById.set(pair.id, pair);

    const categoryWordsTotal = new Map<string, number>();
    const categorySentencesTotal = new Map<string, number>();
    const categoryWsTotal = new Map<string, number>();

    for (const favorite of favorites) {
      const pair = pairById.get(favorite.pair_id);
      if (!pair) continue;
      const category = (pair.category || "").trim();
      const sentenceExists = hasSentence(pair);
      const countsAsWord = favorite.kind === "word";
      const countsAsSentence = favorite.kind === "sentence" && sentenceExists;
      const countsAsWs = countsAsWord || countsAsSentence;

      if (countsAsWord) overallWordsTotal += 1;
      if (countsAsSentence) overallSentencesTotal += 1;
      if (countsAsWs) overallWsTotal += 1;
      if (!category) continue;
      if (countsAsWord) inc(categoryWordsTotal, category);
      if (countsAsSentence) inc(categorySentencesTotal, category);
      if (countsAsWs) inc(categoryWsTotal, category);
    }

    const allCategories = Array.from(
      new Set([
        ...categoryWordsTotal.keys(),
        ...categorySentencesTotal.keys(),
        ...categoryWsTotal.keys(),
      ])
    ).sort((a, b) => a.localeCompare(b));

    categoryOptionsByMode = {
      words: allCategories
        .filter((category) => (categoryWordsTotal.get(category) ?? 0) > 0)
        .map((category) => ({
          value: category,
          label: `${category} (${categoryWordsTotal.get(category) ?? 0})`,
        })),
      sentences: allCategories
        .filter((category) => (categorySentencesTotal.get(category) ?? 0) > 0)
        .map((category) => ({
          value: category,
          label: `${category} (${categorySentencesTotal.get(category) ?? 0})`,
        })),
      ws: allCategories
        .filter((category) => (categoryWsTotal.get(category) ?? 0) > 0)
        .map((category) => ({
          value: category,
          label: `${category} (${categoryWsTotal.get(category) ?? 0})`,
        })),
    };
  }

  return {
    kind: "ok",
    data: {
      selectedSupport,
      decksHref,
      total,
      favoriteTotalsByMode: {
        words: overallWordsTotal,
        sentences: overallSentencesTotal,
        ws: overallWsTotal,
      },
      categoryOptionsByMode,
      canonicalHref: buildFavoritesHref({ target: targetLang, support: selectedSupport, mode }),
    },
  };
}
