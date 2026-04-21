export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import ResponsiveNavLink from "@/app/components/ResponsiveNavLink";
import TrackedResponsiveNavLink from "@/app/components/TrackedResponsiveNavLink";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ActiveReviewDeckControls from "./ActiveReviewDeckControls";

type Mode = "words" | "ws" | "sentences";

type CategoryOption = {
  value: string;
  label: string;
};

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

type ActiveReviewSearchParams = {
  mode?: string | string[];
  back?: string | string[];
  category?: string | string[];
  deck_name?: string | string[];
  target_lang?: string | string[];
  support_lang?: string | string[];
  level_label?: string | string[];
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

function hasSentence(pair: PairRow) {
  return !!pair.sentence_target?.trim() && !!pair.sentence_native?.trim();
}

function inc(map: Map<string, number>, key: string, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

export default async function DeckActiveReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<ActiveReviewSearchParams>;
}) {
  const supabase = await createSupabaseServerClient();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) redirect("/login");

  const { id } = await params;
  const deckId = id;

  const sp = (await searchParams) ?? {};
  const mode = normalizeMode(sp.mode);
  const selectedCategoryFromUrl = normalizeCategoryParam(sp.category);
  const backParam = getSingleParam(sp.back);
  const deckNameFromParam = getSingleParam(sp.deck_name);
  const targetLangFromParam = getSingleParam(sp.target_lang).toLowerCase();
  const supportLangFromParam = getSingleParam(sp.support_lang).toLowerCase();
  const levelLabelFromParam = getSingleParam(sp.level_label);

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
        },
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
    { p_user_id: user.id, p_deck_id: deckId }
  );

  const [{ data: deck, error: deckErr }, { data: aggregateRows, error: aggregateErr }] =
    await Promise.all([deckPromise, aggregatePromise]);

  if (deckErr || !deck) {
    return (
      <div className="pll-workspace" style={{ maxWidth: 1000, margin: "24px auto", padding: "0 16px" }}>
        <ResponsiveNavLink className="pll-back-link" href="/decks" style={{ textDecoration: "none", color: "inherit" }}>
          ← Back to My decks
        </ResponsiveNavLink>
        <h1 style={{ marginTop: 12 }}>Deck not found</h1>
        <pre>{JSON.stringify({ deckId, deckErr }, null, 2)}</pre>
      </div>
    );
  }

  let overallWordsReviewable = 0;
  let overallSentencesReviewable = 0;
  let overallWsReviewable = 0;
  let categoryOptionsByMode: Record<Mode, CategoryOption[]> = {
    words: [],
    sentences: [],
    ws: [],
  };

  if (!aggregateErr && (aggregateRows ?? []).length > 0) {
    const rows = (aggregateRows ?? []) as ReviewAggregateRow[];
    const overallRow = rows.find((r) => !String(r.category ?? "").trim());
    overallWordsReviewable = Number(overallRow?.words_reviewable ?? 0);
    overallSentencesReviewable = Number(overallRow?.sentences_reviewable ?? 0);
    overallWsReviewable = Number(overallRow?.ws_reviewable ?? 0);

    const categoryRows = rows
      .map((r) => ({
        category: String(r.category ?? "").trim(),
        words: Number(r.words_reviewable ?? 0),
        sentences: Number(r.sentences_reviewable ?? 0),
        ws: Number(r.ws_reviewable ?? 0),
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
          .eq("user_id", user.id)
          .eq("deck_id", deckId),
      ]);

    const pairs = (pairsErr ? [] : pairRows ?? []) as PairRow[];
    const userPairs = (userPairsErr ? [] : userPairRows ?? []) as UserPairRow[];
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

  const currentOptions = categoryOptionsByMode[mode] ?? [];
  const initialSelectedCategory =
    selectedCategoryFromUrl && currentOptions.some((c) => c.value === selectedCategoryFromUrl)
      ? selectedCategoryFromUrl
      : null;

  const reviewTotalsByMode: Record<Mode, number> = {
    words: overallWordsReviewable,
    sentences: overallSentencesReviewable,
    ws: overallWsReviewable,
  };

  const hasAny =
    reviewTotalsByMode.words + reviewTotalsByMode.sentences + reviewTotalsByMode.ws > 0;

  if (!hasAny) {
    return (
      <div className="pll-workspace" style={{ maxWidth: 1000, margin: "24px auto", padding: "0 16px" }}>
        <div
          className="pll-primary-card"
          style={{
            border: "1px solid var(--border)",
            borderRadius: 16,
            background: "var(--surface-solid)",
            color: "var(--foreground)",
            padding: 18,
            boxShadow: "var(--shadow)",
          }}
        >
          <div className="pll-card-inner" style={{ width: "100%", maxWidth: 920, margin: "0 auto" }}>
            <TrackedResponsiveNavLink
              className="pll-back-link"
              href={activeDeckHref}
              eventName="back_navigation_click"
              interactionTiming="back_navigation"
              eventParams={{
                source_page: "active_review",
                destination: activeDeckHref,
                flow: "active_review",
                mode,
                category: initialSelectedCategory ?? "all",
                deck_id: deckId,
              }}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              ← Back to {deck.name} Active Learning
            </TrackedResponsiveNavLink>

            <div style={{ marginTop: 20 }}>
              <h1
                style={{
                  marginBottom: 10,
                  fontSize: "clamp(2rem, 4.6vw, 2.125rem)",
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.15,
                }}
              >
                {deck.name} — Active Learning review
              </h1>

              <div
                style={{
                  marginTop: 28,
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  background: "var(--surface-muted)",
                  padding: 24,
                }}
              >
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    lineHeight: 1.2,
                  }}
                >
                  Nothing to review yet.
                </div>

                <div style={{ marginTop: 12, fontSize: 14, color: "var(--foreground-muted)" }}>
                  Master some items first in Active Learning.
                </div>

                <div style={{ marginTop: 24 }}>
                  <TrackedResponsiveNavLink
                    href={activeDeckHref}
                    eventName="back_navigation_click"
                    interactionTiming="back_navigation"
                    eventParams={{
                      source_page: "active_review_empty",
                      destination: activeDeckHref,
                      flow: "active_review",
                      mode,
                      category: initialSelectedCategory ?? "all",
                      deck_id: deckId,
                    }}
                    style={{
                      display: "inline-block",
                      padding: "10px 16px",
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "var(--surface-soft)",
                      textDecoration: "none",
                      color: "var(--foreground)",
                      fontWeight: 500,
                    }}
                  >
                    Go back
                  </TrackedResponsiveNavLink>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pll-workspace" style={{ maxWidth: 1000, margin: "24px auto", padding: "0 16px" }}>
      <div
        className="pll-primary-card"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 16,
          background: "var(--surface-solid)",
          color: "var(--foreground)",
          padding: 18,
          boxShadow: "var(--shadow)",
        }}
      >
        <div className="pll-card-inner" style={{ width: "100%", maxWidth: 920, margin: "0 auto" }}>
          <TrackedResponsiveNavLink
            className="pll-back-link"
            href={activeDeckHref}
            eventName="back_navigation_click"
            interactionTiming="back_navigation"
            eventParams={{
              source_page: "active_review",
              destination: activeDeckHref,
              flow: "active_review",
              mode,
              category: initialSelectedCategory ?? "all",
              deck_id: deckId,
            }}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            ← Back to {deck.name} Active Learning
          </TrackedResponsiveNavLink>

          <div style={{ marginTop: 20 }}>
            <h1
              style={{
                marginBottom: 10,
                fontSize: "clamp(2rem, 4.6vw, 2.125rem)",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                lineHeight: 1.15,
              }}
            >
              {deck.name} — Active Learning review
              {initialSelectedCategory ? ` · ${initialSelectedCategory}` : ""}
            </h1>

            <ActiveReviewDeckControls
              deckId={deckId}
              deckName={deck.name}
              targetLang={String(deck.target_lang).toLowerCase()}
              supportLang={String(deck.native_lang).toLowerCase()}
              level={String(deck.level || "").trim().toUpperCase() || "other"}
              mode={mode}
              backToDeckHref={activeDeckHref}
              initialSelectedCategory={initialSelectedCategory}
              categoryOptionsByMode={categoryOptionsByMode}
              reviewTotalsByMode={reviewTotalsByMode}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
