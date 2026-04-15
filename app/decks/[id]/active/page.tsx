export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeCategoryParam } from "../practice/lib/categories";
import ActiveDeckControls from "./ActiveDeckControls";

type Mode = "words" | "ws" | "sentences";

type Progress = {
  total: number;
  mastered: number;
  pct: number;
};

type CategoryOption = {
  value: string;
  label: string;
};

type CategoryProgressEntry = {
  words: Progress;
  sentences: Progress;
};

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

function normalizeMode(raw: unknown): Mode {
  const v = (typeof raw === "string" ? raw : "").toLowerCase().trim();
  if (v === "words" || v === "ws" || v === "sentences") return v;
  return "ws";
}

function getSingleParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function toPct(mastered: number, total: number) {
  return total > 0 ? Math.round((mastered / total) * 100) : 0;
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

function hasSentence(pair: PairRow) {
  return !!pair.sentence_target?.trim() && !!pair.sentence_native?.trim();
}

function inc(map: Map<string, number>, key: string, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

type ActiveSearchParams = {
  mode?: string | string[];
  back?: string | string[];
  category?: string | string[];
};

export default async function DeckActivePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<ActiveSearchParams>;
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

  const { data: deck, error: deckErr } = await supabase
    .from("decks")
    .select("id, name, target_lang, native_lang, level, created_at")
    .eq("id", deckId)
    .single();

  if (deckErr || !deck) {
    return (
      <div className="pll-workspace" style={{ maxWidth: 1000, margin: "24px auto", padding: "0 16px" }}>
        <Link href="/decks" style={{ textDecoration: "none", color: "inherit" }}>
          ← Back to My decks
        </Link>
        <h1 style={{ marginTop: 12 }}>Deck not found</h1>
        <pre>{JSON.stringify({ deckId, deckErr }, null, 2)}</pre>
      </div>
    );
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
        .eq("user_id", user.id)
        .eq("deck_id", deckId),
    ]);

  const pairs = (pairsErr ? [] : pairRows ?? []) as PairRow[];
  const userPairs = (userPairsErr ? [] : userPairRows ?? []) as UserPairRow[];

  const progressByPairId = new Map<string, UserPairRow>();
  for (const row of userPairs) {
    progressByPairId.set(row.pair_id, row);
  }

  let overallWordsTotal = 0;
  let overallWordsDone = 0;
  let overallWordsPending = 0;

  let overallSentencesTotal = 0;
  let overallSentencesDone = 0;
  let overallSentencesPending = 0;

  let overallWsPendingPairs = 0;

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

  const categoryProgressByValue: Record<string, CategoryProgressEntry> = {};
  for (const category of allCategories) {
    const wordsTotal = categoryWordsTotal.get(category) ?? 0;
    const wordsDone = categoryWordsDone.get(category) ?? 0;

    const sentencesTotal = categorySentencesTotal.get(category) ?? 0;
    const sentencesDone = categorySentencesDone.get(category) ?? 0;

    categoryProgressByValue[category] = {
      words: {
        total: wordsTotal,
        mastered: wordsDone,
        pct: toPct(wordsDone, wordsTotal),
      },
      sentences: {
        total: sentencesTotal,
        mastered: sentencesDone,
        pct: toPct(sentencesDone, sentencesTotal),
      },
    };
  }

  const categoryOptionsByMode: Record<Mode, CategoryOption[]> = {
    words: allCategories
      .filter((category) => (categoryWordsPending.get(category) ?? 0) > 0)
      .map((category) => ({
        value: category,
        label: `${category} (${categoryWordsTotal.get(category) ?? 0})`,
      })),

    sentences: allCategories
      .filter((category) => (categorySentencesPending.get(category) ?? 0) > 0)
      .map((category) => ({
        value: category,
        label: `${category} (${categorySentencesTotal.get(category) ?? 0})`,
      })),

    ws: allCategories
      .filter((category) => (categoryWsPendingPairs.get(category) ?? 0) > 0)
      .map((category) => ({
        value: category,
        label: `${category} (${categoryWsTotalPairs.get(category) ?? 0})`,
      })),
  };

  const currentOptions = categoryOptionsByMode[mode] ?? [];
  const initialSelectedCategory =
    selectedCategoryFromUrl && currentOptions.some((c) => c.value === selectedCategoryFromUrl)
      ? selectedCategoryFromUrl
      : null;

  const overallWordsProgress: Progress = {
    total: overallWordsTotal,
    mastered: overallWordsDone,
    pct: toPct(overallWordsDone, overallWordsTotal),
  };

  const overallSentencesProgress: Progress = {
    total: overallSentencesTotal,
    mastered: overallSentencesDone,
    pct: toPct(overallSentencesDone, overallSentencesTotal),
  };

  const pendingTotalsByMode: Record<Mode, number> = {
    words: overallWordsPending,
    sentences: overallSentencesPending,
    ws: overallWsPendingPairs,
  };

  const targetLabel = langName(deck.target_lang);
  const nativeLabel = langName(deck.native_lang);
  const levelLabel = String(deck.level || "").toUpperCase().trim();

  const levelParam =
    String(deck.level || "").trim().toUpperCase() ||
    "other";
  const defaultDecksHref = `/decks?target=${String(deck.target_lang).toLowerCase()}&support=${String(
    deck.native_lang
  ).toLowerCase()}&level=${encodeURIComponent(levelParam)}`;

  const backToDecksHref =
    backParam && backParam.startsWith("/") ? backParam : defaultDecksHref;

  const isBackToActive = backParam.startsWith(`/decks/${deckId}/active`);
  const isBackToPassive = backParam.startsWith(`/decks/${deckId}`) && !isBackToActive;

  const backLabel = isBackToActive
    ? `← Back to ${deck.name} Active Learning`
    : isBackToPassive
      ? `← Back to ${deck.name} Passive Learning`
      : "← Back to My decks";

  return (
    <div className="pll-workspace" style={{ maxWidth: 1040, margin: "24px auto", padding: "0 16px" }}>
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 16,
          background: "var(--surface-solid)",
          color: "var(--foreground)",
          padding: 18,
          boxShadow: "var(--shadow)",
        }}
      >
        <div className="pll-card-inner" style={{ width: "100%", maxWidth: 940, margin: "0 auto" }}>
          <Link href={backToDecksHref} style={{ textDecoration: "none", color: "inherit" }}>
            {backLabel}
          </Link>

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
              {levelLabel
                ? `${targetLabel} ${levelLabel} — Active Learning`
                : `${targetLabel} — Active Learning`}
            </h1>

            <div style={{ marginTop: 2, color: "var(--foreground-muted)", fontSize: 15 }}>{nativeLabel}</div>

            <ActiveDeckControls
              deckId={deckId}
              mode={mode}
              backToDecksHref={backToDecksHref}
              initialSelectedCategory={initialSelectedCategory}
              categoryOptionsByMode={categoryOptionsByMode}
              overallWordsProgress={overallWordsProgress}
              overallSentencesProgress={overallSentencesProgress}
              categoryProgressByValue={categoryProgressByValue}
              pendingTotalsByMode={pendingTotalsByMode}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
