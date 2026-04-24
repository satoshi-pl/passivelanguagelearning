export const dynamic = "force-dynamic";
export const revalidate = 0;

import { normalizeCategoryParam } from "./lib/categories";
import { redirect } from "next/navigation";
import { hydrateCanonicalFirstAudioForPairs } from "@/lib/audio/hydrateCanonicalFirstAudio";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ResponsiveNavLink from "@/app/components/ResponsiveNavLink";
import TrackedResponsiveNavLink from "@/app/components/TrackedResponsiveNavLink";
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
const PRACTICE_INITIAL_CHUNK = 10;
const PRACTICE_APPEND_CHUNK = 20;
const PRACTICE_NO_LIMIT_PREVIEW_ROWS = 5;

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
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value) && value.length > 0) {
    return String(value[0] ?? "").trim();
  }
  return "";
}

function getInitialSessionBootstrapCount({
  source,
  mode,
  chosenN,
}: {
  source: Source;
  mode: LearnMode;
  chosenN: number;
}) {
  if (source === "favorites") {
    return chosenN > 0 ? Math.min(chosenN, PRACTICE_INITIAL_CHUNK) : PRACTICE_INITIAL_CHUNK;
  }

  if (source === "review") {
    return chosenN > 0 ? Math.min(chosenN, PRACTICE_INITIAL_CHUNK) : PRACTICE_INITIAL_CHUNK;
  }

  if (mode === "sentences") {
    return 1;
  }

  if (chosenN === 0) {
    return PRACTICE_NO_LIMIT_PREVIEW_ROWS;
  }

  return chosenN;
}

function suffixDashboard(label: string) {
  const t = (label || "").trim();
  if (!t) return "dashboard";
  if (t.toLowerCase() === "dashboard") return "Dashboard";
  return `${t} dashboard`;
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
  timing?: string | string[];
};

function nowMs() {
  return performance.now();
}

function createReviewShuffleSeed() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export default async function DeckPracticePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<DeckPracticeSearchParams>;
}) {
  const requestStartedAtMs = nowMs();
  const stageMs: {
    auth_user_lookup_ms: number;
    deck_lookup_ms: number;
    session_selection_rpc_ms: number;
    parallel_wait_ms: number;
    progress_map_build_ms: number;
    response_prep_ms: number;
    total_server_ms: number;
  } = {
    auth_user_lookup_ms: 0,
    deck_lookup_ms: 0,
    session_selection_rpc_ms: 0,
    parallel_wait_ms: 0,
    progress_map_build_ms: 0,
    response_prep_ms: 0,
    total_server_ms: 0,
  };

  const supabase = await createSupabaseServerClient();

  const authStartedAtMs = nowMs();
  const { data: userData } = await supabase.auth.getUser();
  stageMs.auth_user_lookup_ms = nowMs() - authStartedAtMs;
  const user = userData.user;
  if (!user) redirect("/login");

  const { id } = await params;
  const deckId = id;

  const sp = (await searchParams) ?? {};
  const mode = normalizeMode(sp.mode);
  const dir = normalizeDir(sp.dir);
  const source = normalizeSource(sp.source);
  const reviewShuffleSeed = source === "review" ? createReviewShuffleSeed() : undefined;
  const selectedCategory = normalizeCategoryParam(sp.category);
  const timingDebug = getSingleParam(sp.timing) === "1";

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
  const initialRpcN = getInitialSessionBootstrapCount({ source, mode, chosenN });
  const rpcN = initialRpcN;

  const requestedO = Number(sp.o ?? "0");
  const offset = Number.isFinite(requestedO) && requestedO >= 0 ? requestedO : 0;

  const targetLang = getSingleParam(sp.target_lang).toLowerCase();
  const supportLang = getSingleParam(sp.native_lang || sp.support).toLowerCase();

  if (source === "favorites" && (!targetLang || !supportLang)) {
    redirect("/decks");
  }

  const backParam = getSingleParam(sp.back);

  const deckPromise = (async () => {
    const startedAtMs = nowMs();
    const result = await supabase
      .from("decks")
      .select("id, name, target_lang, native_lang, created_at")
      .eq("id", deckId)
      .single();
    stageMs.deck_lookup_ms = nowMs() - startedAtMs;
    return result;
  })();

  const sessionPromise = (async () => {
    const startedAtMs = nowMs();
    const result =
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
    stageMs.session_selection_rpc_ms = nowMs() - startedAtMs;
    return result;
  })();

  const parallelStartedAtMs = nowMs();
  const [{ data: deck, error: deckErr }, { data: sessionPairs, error: sessionErr }] =
    await Promise.all([deckPromise, sessionPromise]);
  stageMs.parallel_wait_ms = nowMs() - parallelStartedAtMs;

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
          <TrackedResponsiveNavLink
            href={backHref}
            className="pll-back-link text-sm text-neutral-600 hover:underline"
            eventName="back_navigation_click"
            interactionTiming="back_navigation"
            eventParams={{
              source_page: "practice",
              destination: backHref,
              flow: source === "review" ? `${dir}_review` : dir === "active" ? "active_learning" : "passive_learning",
              mode,
              category: selectedCategory || "all",
              deck_id: deckId,
            }}
          >
            {sessionErrorBackText}
          </TrackedResponsiveNavLink>

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

  // Match chunk/dictionary entry semantics: resolve inherited audio from
  // canonical template metadata only on the initial payload.
  const pairs = await hydrateCanonicalFirstAudioForPairs(
    supabase,
    ((sessionPairs || []) as PairRow[])
  );

  const progressBuildStartedAtMs = nowMs();
  const progressMap: Record<string, { word_mastered: boolean; sentence_mastered: boolean }> = {};
  for (const p of pairs) {
    const w = dir === "active" ? !!p.word_active_mastered_at : !!p.word_mastered_at;
    const s = dir === "active" ? !!p.sentence_active_mastered_at : !!p.sentence_mastered_at;

    progressMap[p.id] = {
      word_mastered: w,
      sentence_mastered: s,
    };
  }
  stageMs.progress_map_build_ms = nowMs() - progressBuildStartedAtMs;

  const responsePrepStartedAtMs = nowMs();

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

  stageMs.response_prep_ms = nowMs() - responsePrepStartedAtMs;
  stageMs.total_server_ms = nowMs() - requestStartedAtMs;

  const dominantStage = (
    [
      ["auth_user_lookup", stageMs.auth_user_lookup_ms],
      ["deck_lookup", stageMs.deck_lookup_ms],
      ["session_selection_rpc", stageMs.session_selection_rpc_ms],
      ["parallel_wait", stageMs.parallel_wait_ms],
      ["progress_map_build", stageMs.progress_map_build_ms],
      ["response_prep", stageMs.response_prep_ms],
    ] as const
  ).reduce((max, current) => (current[1] > max[1] ? current : max))[0];

  const serverTimingPayload = timingDebug
    ? {
        ...stageMs,
        dominant_stage: dominantStage,
        mode,
        dir,
        source,
        category: selectedCategory || "all",
        n: chosenN,
        initial_rpc_n: rpcN,
        offset,
        pairs_count: pairs.length,
      }
    : null;

  if (timingDebug) {
    console.info("[start_practice_server_timing] payload created on server", serverTimingPayload);
  }

  return (
    <Container>
      <div className="pll-workspace mx-auto max-w-5xl lg:max-w-6xl px-1 sm:px-0">
        <div className="mb-1 sm:mb-4 md:mb-5">
          <div className="flex items-center gap-2">
            <TrackedResponsiveNavLink
              href={backHref}
              className="pll-back-link text-[11px] font-medium text-neutral-600 hover:underline sm:text-sm"
              title={backText}
              eventName="back_navigation_click"
              interactionTiming="back_navigation"
              eventParams={{
                source_page: "practice",
                destination: backHref,
                flow: source === "review" ? `${dir}_review` : dir === "active" ? "active_learning" : "passive_learning",
                mode,
                category: selectedCategory || "all",
                deck_id: deckId,
              }}
            >
              <span className="sm:hidden">← Back</span>
              <span className="hidden sm:inline">{backText}</span>
            </TrackedResponsiveNavLink>
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
          reviewShuffleSeed={reviewShuffleSeed}
          chunkLoadConfig={{
            enabled: source !== "favorites" && (chosenN === 0 || chosenN > initialRpcN),
            initialOffset: offset,
            chunkSize: PRACTICE_APPEND_CHUNK,
            mode,
            dir,
            source: source === "review" ? "review" : "learn",
            category: selectedCategory ?? undefined,
            maxPairs: chosenN > 0 ? chosenN : undefined,
          }}
          serverTiming={serverTimingPayload}
        />
      </div>
    </Container>
  );
}
