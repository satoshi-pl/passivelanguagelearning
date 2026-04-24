export const dynamic = "force-dynamic";
export const revalidate = 0;

import ResponsiveNavLink from "@/app/components/ResponsiveNavLink";
import TrackedResponsiveNavLink from "@/app/components/TrackedResponsiveNavLink";
import { hydrateCanonicalFirstAudioForPairs } from "@/lib/audio/hydrateCanonicalFirstAudio";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import PracticeClient from "../../../decks/[id]/practice/PracticeClient";

type LearnMode = "words" | "ws" | "sentences";

type PairRow = {
  id: string;
  deck_id: string;
  word_target: string;
  word_native: string;
  sentence_target: string | null;
  sentence_native: string | null;
  created_at: string;

  word_mastered_at?: string | null;
  sentence_mastered_at?: string | null;
  word_active_mastered_at?: string | null;
  sentence_active_mastered_at?: string | null;

  word_target_audio_url?: string | null;
  sentence_target_audio_url?: string | null;

  fav_dir?: "active" | "passive" | null;
  fav_kind?: "word" | "sentence" | null;
};

type SupportDeckRow = {
  native_lang: string | null;
};

type DeckLookupRow = {
  id: string;
  name: string | null;
  level: string | null;
};

function normalizeMode(raw: unknown): LearnMode {
  const v = String(raw ?? "").toLowerCase().trim();
  if (v === "words" || v === "ws" || v === "sentences") return v;
  return "ws";
}

function normalizeCategoryParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function getSingleParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function createReviewShuffleSeed() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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
  category,
}: {
  target: string;
  support: string;
  mode?: LearnMode;
  category?: string;
}) {
  const qs = new URLSearchParams();

  if (support) qs.set("support", support);
  if (mode) qs.set("mode", mode);
  if (category) qs.set("category", category);

  const s = qs.toString();
  return s ? `/favorites/${target}?${s}` : `/favorites/${target}`;
}

function buildFavoritesPracticeHref({
  target,
  support,
  mode,
  n,
  o,
  back,
  category,
}: {
  target: string;
  support: string;
  mode: LearnMode;
  n: number;
  o: number;
  back?: string;
  category?: string;
}) {
  const qs = new URLSearchParams();

  qs.set("support", support);
  qs.set("mode", mode);
  qs.set("n", String(n));
  qs.set("o", String(o));
  if (back) qs.set("back", back);
  if (category) qs.set("category", category);

  return `/favorites/${target}/practice?${qs.toString()}`;
}

export default async function FavoritesPracticePage({
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
  const selectedCategory = normalizeCategoryParam(sp.category);

  const requestedSupport = getSingleParam(sp.support).toLowerCase();

  const sizes = [5, 10, 15, 20];
  const requestedN = Number(sp.n ?? "10");
  const chosenN = sizes.includes(requestedN) ? requestedN : 10;

  const requestedO = Number(sp.o ?? "0");
  const offset = Number.isFinite(requestedO) && requestedO >= 0 ? requestedO : 0;

  // Find valid support languages for this target
  const { data: supportDecks, error: supportDecksErr } = await supabase
    .from("decks")
    .select("native_lang")
    .eq("target_lang", targetLang);

  if (supportDecksErr) {
    return (
      <div className="pll-workspace mx-auto max-w-[920px] px-4 pt-2 pb-8 sm:px-6 md:pt-10 md:pb-10">
        <ResponsiveNavLink className="pll-back-link" href="/decks" style={{ textDecoration: "none", color: "inherit" }}>
          ← Back to My decks
        </ResponsiveNavLink>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:mt-3">Favourites</h1>
        <pre className="mt-3 overflow-auto text-sm">{JSON.stringify(supportDecksErr, null, 2)}</pre>
      </div>
    );
  }

  const supportOptions = Array.from(
    new Set(
      ((supportDecks ?? []) as SupportDeckRow[])
        .map((row) => String(row.native_lang ?? "").toLowerCase().trim())
        .filter(Boolean)
    )
  ).sort((a, b) => langName(a).localeCompare(langName(b)));

  if (supportOptions.length === 0) {
    redirect("/decks");
  }

  const selectedSupport = supportOptions.includes(requestedSupport)
    ? requestedSupport
    : supportOptions[0];

  const pageHref = buildFavoritesHref({
    target: targetLang,
    support: selectedSupport,
    mode,
    category: selectedCategory || undefined,
  });

  const requestedBack = getSingleParam(sp.back);
  const finishHref = requestedBack ? decodeURIComponent(requestedBack) : pageHref;

  // Normalize missing/invalid support in URL
  if (requestedSupport !== selectedSupport) {
    const normalizedBack = pageHref;
    redirect(
      buildFavoritesPracticeHref({
        target: targetLang,
        support: selectedSupport,
        mode,
        n: chosenN,
        o: offset,
        back: normalizedBack,
        category: selectedCategory || undefined,
      })
    );
  }

  const { data: sessionPairs, error } = selectedCategory
    ? await supabase.rpc("get_favorites_session_pairs_by_category", {
        p_user_id: user.id,
        p_target_lang: targetLang,
        p_native_lang: selectedSupport,
        p_mode: mode,
        p_n: chosenN,
        p_offset: offset,
        p_category: selectedCategory,
      })
    : await supabase.rpc("get_favorites_session_pairs", {
        p_user_id: user.id,
        p_target_lang: targetLang,
        p_native_lang: selectedSupport,
        p_mode: mode,
        p_n: chosenN,
        p_offset: offset,
      });

  if (error) {
    return (
      <div className="pll-workspace mx-auto max-w-[920px] px-4 pt-2 pb-8 sm:px-6 md:pt-10 md:pb-10">
        <ResponsiveNavLink className="pll-back-link" href={pageHref} style={{ textDecoration: "none", color: "inherit" }}>
          ← Back to {langName(targetLang)} favourites
        </ResponsiveNavLink>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:mt-3">
          {langName(targetLang)} - Favourites
        </h1>
        <div className="mt-1 text-[15px] text-neutral-600 sm:mt-1.5">
          {langName(selectedSupport)}
        </div>
        <div className="mt-2 text-sm text-neutral-500">Couldn’t load favourites practice set.</div>
        <pre className="mt-3 overflow-auto text-sm">{JSON.stringify(error, null, 2)}</pre>
      </div>
    );
  }

  const pairs = await hydrateCanonicalFirstAudioForPairs(
    supabase,
    ((sessionPairs || []) as PairRow[])
  );

  const progressMap: Record<string, { word_mastered: boolean; sentence_mastered: boolean }> = {};
  for (const p of pairs) {
    progressMap[p.id] = {
      word_mastered: !!p.word_mastered_at || !!p.word_active_mastered_at,
      sentence_mastered: !!p.sentence_mastered_at || !!p.sentence_active_mastered_at,
    };
  }

  const deckIds = Array.from(
    new Set(pairs.map((p) => String(p.deck_id ?? "").trim()).filter(Boolean))
  );

  const deckNameById: Record<string, string> = {};
  const deckLevelById: Record<string, string | null> = {};
  if (deckIds.length > 0) {
    const { data: deckRows, error: deckErr } = await supabase
      .from("decks")
      .select("id, name, level")
      .in("id", deckIds);

    if (!deckErr) {
      for (const d of (deckRows ?? []) as DeckLookupRow[]) {
        const id = String(d.id ?? "").trim();
        const name = String(d.name ?? "").trim();
        if (id && name) deckNameById[id] = name;
        if (id) {
          const level = String(d.level ?? "").trim();
          deckLevelById[id] = level || null;
        }
      }
    }
  }

  return (
    <div className="pll-workspace mx-auto max-w-[920px] px-4 pt-2 pb-8 sm:px-6 md:pt-10 md:pb-10">
      <div className="mb-2 sm:mb-4 md:mb-4">
        <TrackedResponsiveNavLink
          className="pll-back-link"
          href={finishHref}
          eventName="back_navigation_click"
          interactionTiming="back_navigation"
          eventParams={{
            source_page: "favorites_practice",
            destination: finishHref,
            flow: "favorites",
            mode,
            category: selectedCategory || "all",
          }}
          style={{ textDecoration: "none", color: "inherit" }}
        >
          ← Back to {langName(targetLang)} favourites
        </TrackedResponsiveNavLink>

        <h1 className="mt-1 text-[1.65rem] font-black leading-tight tracking-tight sm:mt-2 sm:text-3xl md:mt-2">
          {langName(targetLang)} - Favourites
        </h1>

        <div className="mt-1 text-[15px] text-neutral-600 sm:mt-1.5">
          {langName(selectedSupport)}
        </div>
      </div>

      <PracticeClient
        deckId="favorites"
        deckName={`${langName(targetLang)} - Favourites`}
        targetLang={targetLang}
        nativeLang={selectedSupport}
        dir="passive"
        pairs={pairs}
        initialProgress={progressMap}
        reviewShuffleSeed={createReviewShuffleSeed()}
        deckNameById={deckNameById}
        deckLevelById={deckLevelById}
      />
    </div>
  );
}