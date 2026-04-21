export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ResponsiveNavLink from "@/app/components/ResponsiveNavLink";
import FavoritesDeckControls from "./FavoritesDeckControls";

type Mode = "words" | "ws" | "sentences";

type CategoryOption = {
  value: string;
  label: string;
};

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

function normalizeMode(raw: unknown): Mode {
  const v = (typeof raw === "string" ? raw : "").toLowerCase().trim();
  if (v === "words" || v === "ws" || v === "sentences") return v;
  return "ws";
}

function normalizeCategoryParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function getSingleParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function langName(codeOrName: string) {
  const map: Record<string, string> = {
    es: "Spanish",
    en: "English",
    pl: "Polish",
    de: "German",
    fr: "French",
    it: "Italian",
    pt: "Portuguese",
    ru: "Russian",
    tr: "Turkish",
    ar: "Arabic",
    sw: "Swahili",
    zh: "Chinese",
    ja: "Japanese",
    ko: "Korean",
  };
  const key = (codeOrName || "").toLowerCase().trim();
  return map[key] ?? codeOrName;
}

function buildFavoritesHref({
  target,
  support,
  mode,
}: {
  target: string;
  support: string;
  mode?: Mode;
}) {
  const qs = new URLSearchParams();

  if (support) qs.set("support", support);
  if (mode) qs.set("mode", mode);

  const s = qs.toString();
  return s ? `/favorites/${target}?${s}` : `/favorites/${target}`;
}

function hasSentence(pair: PairRow | undefined) {
  return !!pair?.sentence_target?.trim() && !!pair?.sentence_native?.trim();
}

function inc(map: Map<string, number>, key: string, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function ErrorBlock({
  href,
  error,
}: {
  href: string;
  error: unknown;
}) {
  return (
    <div className="pll-workspace" style={{ maxWidth: 980, margin: "40px auto", padding: "0 24px" }}>
      <ResponsiveNavLink className="pll-back-link" href={href} style={{ textDecoration: "none", color: "var(--foreground)" }}>
        ← Back to My decks
      </ResponsiveNavLink>
      <h1 style={{ marginTop: 12, fontSize: 30, fontWeight: 900 }}>Favourites</h1>
      <pre
        style={{
          marginTop: 12,
          border: "1px solid var(--border)",
          borderRadius: 12,
          background: "var(--surface-muted)",
          color: "var(--foreground)",
          padding: 12,
          overflow: "auto",
        }}
      >
        {JSON.stringify(error, null, 2)}
      </pre>
    </div>
  );
}

export default async function FavoritesLangPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createSupabaseServerClient();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) redirect("/login");

  const { lang } = await params;
  const targetLang = (lang ?? "").toLowerCase().trim();
  if (!targetLang) redirect("/decks");

  const sp = (await searchParams) ?? {};
  const mode = normalizeMode(sp.mode);
  const selectedCategoryFromUrl = normalizeCategoryParam(sp.category);
  const requestedSupport = getSingleParam(sp.support).toLowerCase();

  const { data: supportDecks, error: supportDecksErr } = await supabase
    .from("decks")
    .select("native_lang")
    .eq("target_lang", targetLang);

  if (supportDecksErr) {
    return <ErrorBlock href="/decks" error={supportDecksErr} />;
  }

  const supportOptions = Array.from(
    new Set(
      (supportDecks ?? [])
        .map((row) => (row.native_lang || "").toLowerCase().trim())
        .filter(Boolean)
    )
  ).sort((a, b) => langName(a).localeCompare(langName(b)));

  if (supportOptions.length === 0) {
    redirect("/decks");
  }

  const selectedSupport = supportOptions.includes(requestedSupport)
    ? requestedSupport
    : supportOptions[0];

  if (requestedSupport !== selectedSupport) {
    redirect(buildFavoritesHref({ target: targetLang, support: selectedSupport, mode }));
  }

  const decksHref = `/decks?target=${targetLang}&support=${selectedSupport}`;

  let total = 0;
  let overallWordsTotal = 0;
  let overallSentencesTotal = 0;
  let overallWsTotal = 0;
  let categoryOptionsByMode: Record<Mode, CategoryOption[]> = {
    words: [],
    sentences: [],
    ws: [],
  };

  const { data: aggregateRows, error: aggregateErr } = await supabase.rpc(
    "get_favorites_aggregates",
    {
      p_user_id: user.id,
      p_target_lang: targetLang,
      p_native_lang: selectedSupport,
    }
  );

  if (!aggregateErr && (aggregateRows ?? []).length > 0) {
    const rows = (aggregateRows ?? []) as FavoritesAggregateRow[];
    const overallRow = rows.find((r) => !String(r.category ?? "").trim());
    total = Number(overallRow?.total_favorites ?? 0);
    overallWordsTotal = Number(overallRow?.words_total ?? 0);
    overallSentencesTotal = Number(overallRow?.sentences_total ?? 0);
    overallWsTotal = Number(overallRow?.ws_total ?? 0);

    const categoryRows = rows
      .map((r) => ({
        category: String(r.category ?? "").trim(),
        words: Number(r.words_total ?? 0),
        sentences: Number(r.sentences_total ?? 0),
        ws: Number(r.ws_total ?? 0),
      }))
      .filter((r) => r.category)
      .sort((a, b) => a.category.localeCompare(b.category));

    categoryOptionsByMode = {
      words: categoryRows
        .filter((r) => r.words > 0)
        .map((r) => ({ value: r.category, label: `${r.category} (${r.words})` })),
      sentences: categoryRows
        .filter((r) => r.sentences > 0)
        .map((r) => ({ value: r.category, label: `${r.category} (${r.sentences})` })),
      ws: categoryRows
        .filter((r) => r.ws > 0)
        .map((r) => ({ value: r.category, label: `${r.category} (${r.ws})` })),
    };
  } else {
    const { count: favCount, error: favErr } = await supabase
      .from("user_favorites")
      .select("pair_id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("target_lang", targetLang)
      .eq("native_lang", selectedSupport);

    if (favErr) {
      return <ErrorBlock href={decksHref} error={favErr} />;
    }

    total = favCount ?? 0;

    const { data: favoriteRows, error: favoriteRowsErr } = await supabase
      .from("user_favorites")
      .select("pair_id, kind")
      .eq("user_id", user.id)
      .eq("target_lang", targetLang)
      .eq("native_lang", selectedSupport);

    if (favoriteRowsErr) {
      return <ErrorBlock href={decksHref} error={favoriteRowsErr} />;
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
        return <ErrorBlock href={decksHref} error={pairErr} />;
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

  const currentOptions = categoryOptionsByMode[mode] ?? [];
  const initialSelectedCategory =
    selectedCategoryFromUrl && currentOptions.some((c) => c.value === selectedCategoryFromUrl)
      ? selectedCategoryFromUrl
      : null;

  const favoriteTotalsByMode: Record<Mode, number> = {
    words: overallWordsTotal,
    sentences: overallSentencesTotal,
    ws: overallWsTotal,
  };

  return (
    <div className="pll-workspace" style={{ maxWidth: 980, margin: "40px auto", padding: "0 24px" }}>
      <div
        className="pll-primary-card"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 16,
          background: "var(--surface-solid)",
          padding: 22,
          boxShadow: "var(--shadow)",
        }}
      >
        <div className="pll-card-inner" style={{ width: "100%", maxWidth: 900, margin: "0 auto" }}>
          <ResponsiveNavLink className="pll-back-link" href={decksHref} style={{ textDecoration: "none", color: "var(--foreground)" }}>
            ← Back to My decks
          </ResponsiveNavLink>

          <div style={{ marginTop: 18 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 34,
                fontWeight: 900,
                letterSpacing: "-0.03em",
                lineHeight: 1.08,
              }}
            >
              {langName(targetLang)} - Favourites
            </h1>

            <div style={{ marginTop: 8, color: "var(--foreground-muted)", fontSize: 15 }}>
              {langName(selectedSupport)}
            </div>

            <div style={{ marginTop: 8, fontSize: 13, color: "var(--foreground-muted)" }}>
              Total favourites: <b style={{ color: "var(--foreground)" }}>{total}</b>
            </div>

            {total === 0 ? (
              <div style={{ marginTop: 14, fontSize: 13, color: "var(--foreground-muted)" }}>
                No favourites yet for this language pair. Add some while practising.
              </div>
            ) : (
              <FavoritesDeckControls
                targetLang={targetLang}
                supportLang={selectedSupport}
                mode={mode}
                initialSelectedCategory={initialSelectedCategory}
                categoryOptionsByMode={categoryOptionsByMode}
                favoriteTotalsByMode={favoriteTotalsByMode}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
