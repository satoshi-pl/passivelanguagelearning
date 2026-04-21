export const dynamic = "force-dynamic";
export const revalidate = 0;

import { normalizeCategoryParam } from "./lib/categories";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hydrateCanonicalFirstAudioForPairs } from "@/lib/audio/hydrateCanonicalFirstAudio";
import ResponsiveNavLink from "@/app/components/ResponsiveNavLink";
import PracticeClient from "./PracticeClient";
import { Container } from "../../../components/Container";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/Card";

type PairRow = {
  id: string;
  deck_id: string;
  word_target: string;
  word_native: string;
  sentence_target: string | null;
  sentence_native: string | null;
  created_at: string;

  word_target_audio_url?: string | null;
  sentence_target_audio_url?: string | null;

  word_mastered_at?: string | null;
  sentence_mastered_at?: string | null;

  word_active_mastered_at?: string | null;
  sentence_active_mastered_at?: string | null;

  fav_kind?: "word" | "sentence" | null;
  fav_dir?: "active" | "passive" | null;
};

type LearnMode = "words" | "ws" | "sentences";
type Dir = "passive" | "active";
type Source = "learn" | "review" | "favorites";
const INITIAL_NO_LIMIT_CHUNK = 30;

function normalizeMode(raw: unknown): LearnMode {
  const v = String(raw ?? "").toLowerCase().trim();
  if (v === "words" || v === "ws" || v === "sentences") return v;
  return "ws";
}

function normalizeDir(raw: unknown): Dir {
  const v = String(raw ?? "").toLowerCase().trim();
  return v === "active" ? "active" : "passive";
}

function normalizeSource(raw: unknown): Source {
  const v = String(raw ?? "").toLowerCase().trim();
  if (v === "favorites") return "favorites";
  if (v === "review") return "review";
  return "learn";
}

function getSingleParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function suffixDashboard(label: string) {
  const t = (label || "").trim();
  if (!t) return "dashboard";
  if (t.toLowerCase() === "dashboard") return "Dashboard";
  return `${t} dashboard`;
}

async function hydrateAudioForPairs(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  pairs: PairRow[],
  targetLang: string
) {
  return hydrateCanonicalFirstAudioForPairs(supabase, pairs, targetLang);
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

type DeckPracticeSearchParams = {
  mode?: string | string[];
  dir?: string | string[]; 
  source?: string | string[];
  n?: string | string[];
  o?: string | string[];
  back?: string | string[];
  target_lang?: string | string[];
  native_lang?: string | string[];
  support?: string | string[];
  category?: string | string[];
};

export default async function DeckPracticePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<DeckPracticeSearchParams>;
}) {
  const supabase = await createSupabaseServerClient();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) redirect("/login");

  const { id } = await params;
  const deckId = id;

  const sp = (await searchParams) ?? {};
  const mode = normalizeMode(sp.mode);
  const dir = normalizeDir(sp.dir);
  const source = normalizeSource(sp.source);
  const selectedCategory = normalizeCategoryParam(sp.category);

  const shouldUsePassiveReviewCategoryRpc =
    !!selectedCategory && source === "review" && dir === "passive";

  const shouldUseActiveReviewCategoryRpc =
    !!selectedCategory && source === "review" && dir === "active";

  const shouldUsePassiveCategoryRpc =
    !!selectedCategory && source === "learn" && dir === "passive";

  const shouldUseActiveCategoryRpc =
    !!selectedCategory && source === "learn" && dir === "active";

  const sizes = [0, 5, 10, 15];
  const requestedN = Number(sp.n ?? "10");
  const chosenN = sizes.includes(requestedN) ? requestedN : 10;
  const rpcN = chosenN === 0 ? INITIAL_NO_LIMIT_CHUNK : chosenN;

  const requestedO = Number(sp.o ?? "0");
  const offset = Number.isFinite(requestedO) && requestedO >= 0 ? requestedO : 0;

  const targetLang = getSingleParam(sp.target_lang).toLowerCase();
  const supportLang = getSingleParam(sp.native_lang || sp.support).toLowerCase();

  if (source === "favorites" && (!targetLang || !supportLang)) {
    redirect("/decks");
  }

  const backParam = getSingleParam(sp.back);

  const { data: deck, error: deckErr } = await supabase
    .from("decks")
    .select("id, name, target_lang, native_lang, created_at")
    .eq("id", deckId)
    .single();

  if (deckErr || !deck) {
    return (
      <Container>
        <div className="pll-workspace mx-auto max-w-3xl lg:max-w-4xl">
          <ResponsiveNavLink href="/decks" className="pll-back-link text-sm text-neutral-600 hover:underline">
            ← Back to My decks
          </ResponsiveNavLink>

          <div className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Deck not found</CardTitle>
                <CardDescription>We couldn’t load this deck.</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="overflow-auto rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700">
                  {JSON.stringify({ deckId, deckErr }, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </div>
        </div>
      </Container>
    );
  }

  const withCategory = (href: string) => {
    if (!selectedCategory) return href;
    const sep = href.includes("?") ? "&" : "?";
    return `${href}${sep}category=${encodeURIComponent(selectedCategory)}`;
  };

  const fallbackBackHref =
    source === "favorites"
      ? `/favorites/${encodeURIComponent(targetLang)}?support=${encodeURIComponent(
          supportLang
        )}&mode=${mode}`
      : source === "review"
      ? dir === "active"
        ? withCategory(`/decks/${deckId}/active/review?mode=${mode}`)
        : withCategory(`/decks/${deckId}/review?mode=${mode}`)
      : dir === "active"
      ? withCategory(`/decks/${deckId}/active?mode=${mode}`)
      : withCategory(`/decks/${deckId}?mode=${mode}`);

  const backHref =
    backParam && backParam.startsWith("/") ? backParam : fallbackBackHref;

  const { data: sessionPairs, error: sessionErr } =
    source === "favorites"
      ? await supabase.rpc("get_favorites_session_pairs", {
          p_user_id: user.id,
          p_target_lang: targetLang,
          p_native_lang: supportLang,
          p_mode: mode,
          p_n: rpcN,
          p_offset: offset,
        })
      : shouldUsePassiveReviewCategoryRpc
      ? await supabase.rpc("get_passive_review_session_pairs_by_category", {
          p_user_id: user.id,
          p_deck_id: deckId,
          p_mode: mode,
          p_n: rpcN,
          p_offset: offset,
          p_category: selectedCategory,
        })
      : shouldUseActiveReviewCategoryRpc
      ? await supabase.rpc("get_active_review_session_pairs_by_category", {
          p_user_id: user.id,
          p_deck_id: deckId,
          p_mode: mode,
          p_n: rpcN,
          p_offset: offset,
          p_category: selectedCategory,
        })
      : shouldUsePassiveCategoryRpc
      ? await supabase.rpc("get_passive_session_pairs_by_category", {
          p_user_id: user.id,
          p_deck_id: deckId,
          p_mode: mode,
          p_n: rpcN,
          p_offset: offset,
          p_category: selectedCategory,
        })
      : shouldUseActiveCategoryRpc
      ? await supabase.rpc("get_active_session_pairs_by_category", {
          p_user_id: user.id,
          p_deck_id: deckId,
          p_mode: mode,
          p_n: rpcN,
          p_offset: offset,
          p_category: selectedCategory,
        })
      : await supabase.rpc("get_session_pairs", {
          p_user_id: user.id,
          p_deck_id: deckId,
          p_mode: mode,
          p_n: rpcN,
          p_offset: offset,
          p_dir: dir,
          p_source: source,
        });

  if (sessionErr) {
    const sessionErrorBackText =
      source === "favorites"
        ? `← Back to ${langName(targetLang)} · ${langName(supportLang)} Favourites`
        : `← Back to ${deck.name} ${suffixDashboard(
            source === "review"
              ? dir === "active"
                ? "Active Learning review"
                : "Passive Learning review"
              : dir === "active"
              ? "Active Learning"
              : "Dashboard"
          )}`;

    return (
      <Container>
        <div className="pll-workspace mx-auto max-w-3xl lg:max-w-4xl">
          <ResponsiveNavLink href={backHref} className="pll-back-link text-sm text-neutral-600 hover:underline">
            {sessionErrorBackText}
          </ResponsiveNavLink>

          <div className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Failed to load practice set</CardTitle>
                <CardDescription>There was a problem fetching session pairs.</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="overflow-auto rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {JSON.stringify(sessionErr, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </div>
        </div>
      </Container>
    );
  }

  const pairs = await hydrateAudioForPairs(
    supabase,
    (sessionPairs || []) as PairRow[],
    deck.target_lang
  );

  const progressMap: Record<string, { word_mastered: boolean; sentence_mastered: boolean }> = {};
  for (const p of pairs) {
    const w = dir === "active" ? !!p.word_active_mastered_at : !!p.word_mastered_at;
    const s = dir === "active" ? !!p.sentence_active_mastered_at : !!p.sentence_mastered_at;

    progressMap[p.id] = {
      word_mastered: w,
      sentence_mastered: s,
    };
  }

  const pageModeLabel =
    source === "favorites"
      ? "Favourites"
      : source === "review"
      ? dir === "active"
        ? "Active Learning review"
        : "Passive Learning review"
      : dir === "active"
      ? "Active Learning"
      : "Passive Learning";

  const backLabel =
    source === "favorites"
      ? `${langName(targetLang)} · ${langName(supportLang)} Favourites`
      : source === "review"
      ? dir === "active"
        ? "Active Learning review"
        : "Passive Learning review"
      : dir === "active"
      ? "Active Learning"
      : "Dashboard";

  const backText =
    source === "favorites"
      ? `← Back to ${backLabel}`
      : `← Back to ${deck.name} ${suffixDashboard(backLabel)}`;

  return (
    <Container>
      <div className="pll-workspace mx-auto max-w-5xl lg:max-w-6xl px-1 sm:px-0">
        <div className="mb-1 sm:mb-4 md:mb-5">
          <div className="flex items-center gap-2">
            <ResponsiveNavLink
              href={backHref}
              className="pll-back-link text-[11px] font-medium text-neutral-600 hover:underline sm:text-sm"
              title={backText}
            >
              <span className="sm:hidden">← Back</span>
              <span className="hidden sm:inline">{backText}</span>
            </ResponsiveNavLink>
          </div>

          <h1 className="mt-0.5 text-base font-bold leading-snug tracking-tight text-neutral-900 sm:mt-2 sm:text-2xl sm:font-semibold md:mt-3 md:text-3xl">
            <span className="sm:hidden">
              {deck.name}
            </span>
            <span className="hidden sm:inline">
              {`${deck.name} — ${pageModeLabel}${selectedCategory ? ` · ${selectedCategory}` : ""}`}
            </span>
          </h1>
        </div>

        <PracticeClient
          deckId={deckId}
          deckName={deck.name}
          targetLang={deck.target_lang}
          nativeLang={deck.native_lang}
          dir={dir}
          pairs={pairs}
          initialProgress={progressMap}
          chunkLoadConfig={{
            enabled: chosenN === 0 && source !== "favorites",
            initialOffset: offset,
            chunkSize: INITIAL_NO_LIMIT_CHUNK,
            mode,
            dir,
            source: source === "review" ? "review" : "learn",
            category: selectedCategory,
          }}
        />
      </div>
    </Container>
  );
}
