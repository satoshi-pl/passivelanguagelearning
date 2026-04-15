export const dynamic = "force-dynamic";
export const revalidate = 0;

import { normalizeCategoryParam } from "./practice/lib/categories";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import PassiveDeckControls from "./PassiveDeckControls";

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
};

type UserPairRow = {
  pair_id: string;
  word_mastered_at: string | null;
  sentence_mastered_at: string | null;
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

type DeckDetailSearchParams = {
  mode?: string | string[];
  back?: string | string[];
  category?: string | string[];
};

export default async function DeckDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<DeckDetailSearchParams>;
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

  let decodedBack = "";
  try {
    decodedBack = backParam ? decodeURIComponent(backParam) : "";
  } catch {
    decodedBack = backParam || "";
  }

  const { data: deck, error: deckErr } = await supabase
    .from("decks")
    .select("id, name, target_lang, native_lang, level, created_at")
    .eq("id", deckId)
    .single();

  if (deckErr || !deck) {
    return (
      <div className="pll-workspace" style={{ maxWidth: 1040, margin: "24px auto", padding: "0 16px" }}>
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
      supabase.from("pairs").select("id, category").eq("deck_id", deckId),
      supabase
        .from("user_pairs")
        .select("pair_id, word_mastered_at, sentence_mastered_at")
        .eq("user_id", user.id)
        .eq("deck_id", deckId),
    ]);

  const pairs = (pairsErr ? [] : pairRows ?? []) as PairRow[];
  const userPairs = (userPairsErr ? [] : userPairRows ?? []) as UserPairRow[];

  const progressByPairId = new Map<string, UserPairRow>();
  for (const row of userPairs) {
    progressByPairId.set(row.pair_id, row);
  }

  let overallTotal = 0;
  let overallWordsMastered = 0;
  let overallSentencesMastered = 0;

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

  const categoryOptions: CategoryOption[] = Array.from(categoryTotals.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([value, count]) => ({
      value,
      label: `${value} (${count})`,
    }));

  const categoryProgressByValue: Record<string, CategoryProgressEntry> = {};
  for (const [category, total] of categoryTotals.entries()) {
    const wordsMastered = categoryWordsMastered.get(category) ?? 0;
    const sentencesMastered = categorySentencesMastered.get(category) ?? 0;

    categoryProgressByValue[category] = {
      words: {
        total,
        mastered: wordsMastered,
        pct: toPct(wordsMastered, total),
      },
      sentences: {
        total,
        mastered: sentencesMastered,
        pct: toPct(sentencesMastered, total),
      },
    };
  }

  const initialSelectedCategory =
    selectedCategoryFromUrl && categoryProgressByValue[selectedCategoryFromUrl]
      ? selectedCategoryFromUrl
      : null;

  const overallWordsProgress: Progress = {
    total: overallTotal,
    mastered: overallWordsMastered,
    pct: toPct(overallWordsMastered, overallTotal),
  };

  const overallSentencesProgress: Progress = {
    total: overallTotal,
    mastered: overallSentencesMastered,
    pct: toPct(overallSentencesMastered, overallTotal),
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

  const backToDecksHref = decodedBack || defaultDecksHref;

  return (
    <div className="pll-workspace" style={{ maxWidth: 1040, margin: "24px auto", padding: "0 16px" }}>
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
        <div className="pll-card-inner" style={{ width: "100%", maxWidth: 940, margin: "0 auto" }}>
          <Link href={backToDecksHref} style={{ textDecoration: "none", color: "inherit" }}>
            ← Back to My decks
          </Link>

          <div style={{ marginTop: 20 }}>
            <h1
              style={{
                margin: 0,
                fontSize: "clamp(2rem, 4.6vw, 2.125rem)",
                fontWeight: 900,
                letterSpacing: "-0.03em",
                lineHeight: 1.08,
              }}
            >
              {levelLabel
                ? `${targetLabel} ${levelLabel} - Passive Learning`
                : `${targetLabel} - Passive Learning`}
            </h1>

            <div style={{ marginTop: 8, color: "var(--foreground-muted)", fontSize: 15 }}>{nativeLabel}</div>

            <PassiveDeckControls
              deckId={deckId}
              mode={mode}
              backToDecksHref={backToDecksHref}
              initialSelectedCategory={initialSelectedCategory}
              categoryOptions={categoryOptions}
              overallWordsProgress={overallWordsProgress}
              overallSentencesProgress={overallSentencesProgress}
              categoryProgressByValue={categoryProgressByValue}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
