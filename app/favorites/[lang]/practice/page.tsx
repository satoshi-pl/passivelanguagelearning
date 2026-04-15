export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
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

  fav_dir?: "active" | "passive" | string | null;
  fav_kind?: "word" | "sentence" | string | null;
};

type PairAudioRow = {
  id: string;
  word_target_audio_url: string | null;
  sentence_target_audio_url: string | null;
};

async function hydrateMissingAudioForPairs(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  pairs: PairRow[]
) {
  if (!pairs.length) return pairs;

  const missingAudioRows = pairs.filter(
    (p) => !p.word_target_audio_url && !p.sentence_target_audio_url
  );
  if (!missingAudioRows.length) return pairs;

  const ids = Array.from(new Set(missingAudioRows.map((p) => p.id).filter(Boolean)));
  if (!ids.length) return pairs;

  const { data, error } = await supabase
    .from("pairs")
    .select("id, word_target_audio_url, sentence_target_audio_url")
    .in("id", ids);

  if (error || !data?.length) return pairs;

  const audioByPairId = new Map<string, PairAudioRow>();
  for (const row of data as PairAudioRow[]) {
    audioByPairId.set(row.id, row);
  }

  return pairs.map((p) => {
    if (p.word_target_audio_url || p.sentence_target_audio_url) return p;
    const audio = audioByPairId.get(p.id);
    if (!audio) return p;
    return {
      ...p,
      word_target_audio_url: audio.word_target_audio_url,
      sentence_target_audio_url: audio.sentence_target_audio_url,
    };
  });
}

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
        <Link href="/decks" style={{ textDecoration: "none", color: "inherit" }}>
          ← Back to My decks
        </Link>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:mt-3">Favourites</h1>
        <pre className="mt-3 overflow-auto text-sm">{JSON.stringify(supportDecksErr, null, 2)}</pre>
      </div>
    );
  }

  const supportOptions = Array.from(
    new Set(
      (supportDecks ?? [])
        .map((row) => String((row as any).native_lang ?? "").toLowerCase().trim())
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
        <Link href={pageHref} style={{ textDecoration: "none", color: "inherit" }}>
          ← Back to {langName(targetLang)} favourites
        </Link>
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

  const pairs = await hydrateMissingAudioForPairs(
    supabase,
    (sessionPairs || []) as PairRow[]
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
  if (deckIds.length > 0) {
    const { data: deckRows, error: deckErr } = await supabase
      .from("decks")
      .select("id, name")
      .in("id", deckIds);

    if (!deckErr) {
      for (const d of deckRows ?? []) {
        const id = String((d as any).id ?? "").trim();
        const name = String((d as any).name ?? "").trim();
        if (id && name) deckNameById[id] = name;
      }
    }
  }

  return (
    <div className="pll-workspace mx-auto max-w-[920px] px-4 pt-2 pb-8 sm:px-6 md:pt-10 md:pb-10">
      <div className="mb-2 sm:mb-4 md:mb-4">
        <Link href={finishHref} style={{ textDecoration: "none", color: "inherit" }}>
          ← Back to {langName(targetLang)} favourites
        </Link>

        <h1 className="mt-1 text-[1.65rem] font-black leading-tight tracking-tight sm:mt-2 sm:text-3xl md:mt-2">
          {langName(targetLang)} - Favourites
        </h1>

        <div className="mt-1 text-[15px] text-neutral-600 sm:mt-1.5">
          {langName(selectedSupport)}
        </div>
      </div>

      <PracticeClient
  deckId={"favorites"}
  deckName={`${langName(targetLang)} - Favourites`}
  targetLang={targetLang}
  nativeLang={selectedSupport}
  dir="passive"
  pairs={pairs as any}
  initialProgress={progressMap as any}
  deckNameById={deckNameById}
/>
    </div>
  );
}