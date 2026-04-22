"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PracticeStatusCard from "./components/PracticeStatusCard";
import PreviewScreen from "./components/PreviewScreen";
import PracticeScreen from "./components/PracticeScreen";
import { usePracticeReportContext } from "./lib/usePracticeReportContext";
import PracticeEmptyState from "./components/PracticeEmptyState";
import { getPracticeEmptyState } from "./lib/getPracticeEmptyState";
import { usePracticeKeyboard } from "./lib/usePracticeKeyboard";
import { useReportController } from "./lib/useReportController";
import { usePracticeFlow } from "./lib/usePracticeFlow";
import { usePracticeDerived } from "./lib/usePracticeDerived";
import { useSessionBuilder } from "./lib/useSessionBuilder";

import type { PairRow, ProgressMap, LearnMode } from "./lib/types";
import { normalizeMode } from "./lib/learning";
import { resolvePracticeAudioUrl } from "./lib/resolvePracticeAudioUrl";
import {
  consumeRouteInteractionTiming,
  emitInteractionTiming,
  startRouteInteractionTiming,
} from "@/lib/analytics/interactionTiming";
import { trackGaEvent } from "@/lib/analytics/ga";

const SUPABASE_PUBLIC_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

function resolveAudioUrl(raw?: string | null) {
  return resolvePracticeAudioUrl(raw, SUPABASE_PUBLIC_URL);
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

type Props = {
  deckId: string;
  deckName: string;
  targetLang: string;
  nativeLang: string;
  dir: "passive" | "active";
  pairs?: PairRow[];
  initialProgress?: ProgressMap;
  deckNameById?: Record<string, string>;
  deckLevelById?: Record<string, string | null>;
  chunkLoadConfig?: {
    enabled: boolean;
    initialOffset: number;
    chunkSize: number;
    maxPairs?: number;
    mode: LearnMode;
    dir: "passive" | "active";
    source: "learn" | "review";
    category?: string;
  };
  serverTiming?: {
    auth_user_lookup_ms: number;
    deck_lookup_ms: number;
    session_selection_rpc_ms: number;
    parallel_wait_ms: number;
    progress_map_build_ms: number;
    response_prep_ms: number;
    total_server_ms: number;
    dominant_stage: string;
    mode: LearnMode;
    dir: "passive" | "active";
    source: "learn" | "review" | "favorites";
    category: string;
    n: number;
    initial_rpc_n: number;
    offset: number;
    pairs_count: number;
  } | null;
};

type FavoritesListResponse = {
  error?: string;
  items?: Array<{
    pairId?: string;
    kind?: "word" | "sentence" | null;
  }>;
};

type FavoritesToggleResponse = {
  favorited?: boolean;
};

export default function PracticeClient({
  deckId,
  deckName,
  targetLang,
  nativeLang,
  dir,
  pairs = [],
  initialProgress = {},
  deckNameById = {},
  deckLevelById = {},
  chunkLoadConfig,
  serverTiming = null,
}: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  const mode: LearnMode = normalizeMode(sp.get("mode"));
  const debugAudio = sp.get("debugAudio") === "1";
  const dirParam = (sp.get("dir") ?? "").toLowerCase().trim();
  const isActiveFromUrl = dirParam === "active";

  const source = (sp.get("source") ?? "").toLowerCase().trim();
  const isReviewFromUrl = source === "review" || sp.get("review") === "1";
  const categoryParam = (sp.get("category") ?? "").trim();

  const backParam = sp.get("back") ?? "";
  const decodedBack = useMemo(() => backParam || "", [backParam]);

  const safeDeckId =
    typeof deckId === "string" && deckId && deckId !== "undefined" ? deckId : "";

  const withCategory = (href: string) => {
    if (!categoryParam) return href;
    const sep = href.includes("?") ? "&" : "?";
    return `${href}${sep}category=${encodeURIComponent(categoryParam)}`;
  };

  const isFavoritesSession = safeDeckId === "favorites" || source === "favorites";
  const isReview = isFavoritesSession ? true : isReviewFromUrl;
  const isActive = isFavoritesSession ? false : isActiveFromUrl;

  const backToDeckHref = safeDeckId
    ? withCategory(`/decks/${safeDeckId}?mode=${mode}`)
    : "/decks";

  const backToActiveHref = safeDeckId
    ? withCategory(`/decks/${safeDeckId}/active?mode=${mode}`)
    : "/decks";

  const favoritesFinishHref =
    targetLang && nativeLang
      ? withCategory(
          `/favorites/${encodeURIComponent(targetLang)}?support=${encodeURIComponent(
            nativeLang
          )}&mode=${mode}`
        )
      : "/decks";

  const defaultFinishHref = isFavoritesSession
    ? favoritesFinishHref
    : isActive
    ? backToActiveHref
    : backToDeckHref;

  const finishHref = decodedBack || defaultFinishHref;

  const sizes = [0, 5, 10, 15];
  const requestedN = Number(sp.get("n") ?? "10");
  const chosenN = sizes.includes(requestedN) ? requestedN : 10;
  const isNoLimitMode = chosenN === 0;

  const requestedO = Number(sp.get("o") ?? "0");
  const offset = Number.isFinite(requestedO) && requestedO >= 0 ? requestedO : 0;

  const safePairs: PairRow[] = Array.isArray(pairs) ? pairs : [];

  const report = useReportController({ safeDeckId, mode });

  const flow = usePracticeFlow({
    deckId,
    safeDeckId,
    mode,
    isReview,
    isActive,
    chosenN,
    offset,
    finishHref,
    pairs: safePairs,
    initialProgress: initialProgress || {},
    resolveAudioUrl,
    debugAudio,
  });

  const itemIsActive = useMemo(() => {
    if (!isFavoritesSession) return isActiveFromUrl;
    const d = String(flow.currentPair?.fav_dir ?? "").toLowerCase().trim();
    return d === "active";
  }, [isFavoritesSession, isActiveFromUrl, flow.currentPair]);

  useEffect(() => {
    if (!isFavoritesSession) return;
    if (flow.viewMode !== "preview") return;
    flow.startPractice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFavoritesSession, flow.viewMode]);

  const session = useSessionBuilder({
    sessionPairs: flow.sessionPairs,
    progress: flow.progress,
    mode,
    isReview,
    chosenN,
    offset,
    safePairs,
  });

  const rawPreviewRows = mode === "ws" ? flow.wsPreviewPairs : session.previewWords;
  const previewRows = isNoLimitMode ? rawPreviewRows.slice(0, 5) : rawPreviewRows;

  const derived = usePracticeDerived({
    mode,
    isActive: itemIsActive,
    isReview,
    currentPair: flow.currentPair,
    currentStage: flow.currentStage,
    queue: flow.queue,
    qPos: flow.qPos,
    resolveAudioUrl,
    deckNameById,
  });

  const sourceChipLabel = useMemo(() => {
    if (!isFavoritesSession) return "Favourites";

    const favDir = String((flow.currentPair as { fav_dir?: string | null } | null)?.fav_dir ?? "")
      .toLowerCase()
      .trim();
    const sourceLabel = favDir === "active" ? "Active Learning" : "Passive Learning";

    const deckId = String((flow.currentPair as { deck_id?: string | null } | null)?.deck_id ?? "").trim();
    const rawLevel = deckId ? String(deckLevelById[deckId] ?? "").trim().toUpperCase() : "";
    if (!rawLevel) return sourceLabel;

    return `${sourceLabel} ${rawLevel}`;
  }, [isFavoritesSession, flow.currentPair, deckLevelById]);

  const [chunkBusy, setChunkBusy] = useState(false);
  const [chunkHasMore, setChunkHasMore] = useState<boolean>(!!chunkLoadConfig?.enabled);
  const [nextChunkOffset, setNextChunkOffset] = useState<number>(() => {
    const base = chunkLoadConfig?.initialOffset ?? offset;
    return base + safePairs.length;
  });
  const audioEnrichQueuedRef = useRef<Set<string>>(new Set());
  const audioEnrichDoneRef = useRef<Set<string>>(new Set());
  const audioEnrichBusyRef = useRef(false);

  useEffect(() => {
    const base = chunkLoadConfig?.initialOffset ?? offset;
    setChunkHasMore(!!chunkLoadConfig?.enabled);
    setChunkBusy(false);
    setNextChunkOffset(base + safePairs.length);
    audioEnrichQueuedRef.current = new Set();
    audioEnrichDoneRef.current = new Set();
    audioEnrichBusyRef.current = false;
  }, [chunkLoadConfig, offset, safePairs.length]);

  const loadMoreSessionPairs = useCallback(async () => {
    if (!chunkLoadConfig?.enabled) return;
    if (chunkBusy) return;
    if (!chunkHasMore) return;
    if (!safeDeckId) return;

    const loadedFromBase = nextChunkOffset - (chunkLoadConfig.initialOffset ?? 0);
    if (chunkLoadConfig.maxPairs && loadedFromBase >= chunkLoadConfig.maxPairs) {
      setChunkHasMore(false);
      return;
    }

    const nextLimit = chunkLoadConfig.maxPairs
      ? Math.max(0, Math.min(chunkLoadConfig.chunkSize, chunkLoadConfig.maxPairs - loadedFromBase))
      : chunkLoadConfig.chunkSize;
    if (nextLimit <= 0) {
      setChunkHasMore(false);
      return;
    }

    setChunkBusy(true);
    try {
      const res = await fetch("/api/practice/session-chunk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deckId: safeDeckId,
          mode: chunkLoadConfig.mode,
          dir: chunkLoadConfig.dir,
          source: chunkLoadConfig.source,
          category: chunkLoadConfig.category,
          offset: nextChunkOffset,
          limit: nextLimit,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChunkHasMore(false);
        return;
      }

      const items = Array.isArray((json as { pairs?: PairRow[] }).pairs)
        ? ((json as { pairs: PairRow[] }).pairs as PairRow[])
        : [];
      const progressPatch =
        ((json as { progress?: ProgressMap }).progress as ProgressMap | undefined) || {};
      const hasMore = Boolean((json as { hasMore?: boolean }).hasMore);

      if (items.length > 0) {
        flow.appendSessionChunk(items, progressPatch);
        setNextChunkOffset((prev) => prev + items.length);
      }

      const loadedAfter = loadedFromBase + items.length;
      const reachedMaxPairs = !!chunkLoadConfig.maxPairs && loadedAfter >= chunkLoadConfig.maxPairs;
      setChunkHasMore(hasMore && items.length > 0 && !reachedMaxPairs);
    } catch {
      setChunkHasMore(false);
    } finally {
      setChunkBusy(false);
    }
  }, [chunkLoadConfig, chunkBusy, chunkHasMore, nextChunkOffset, safeDeckId, flow]);

  useEffect(() => {
    if (!chunkLoadConfig?.enabled) return;
    if (!chunkHasMore) return;
    if (chunkBusy) return;
    void loadMoreSessionPairs();
  }, [chunkLoadConfig, chunkHasMore, chunkBusy, loadMoreSessionPairs]);

  const flushAudioEnrichment = useCallback(async () => {
    if (audioEnrichBusyRef.current) return;
    if (audioEnrichQueuedRef.current.size === 0) return;

    const batch = Array.from(audioEnrichQueuedRef.current).slice(0, 24);
    if (batch.length === 0) return;

    audioEnrichBusyRef.current = true;
    for (const id of batch) audioEnrichQueuedRef.current.delete(id);

    try {
      const res = await fetch("/api/practice/hydrate-audio", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetLang,
          pairIds: batch,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) return;

      const items = Array.isArray((json as { items?: unknown[] }).items)
        ? ((json as { items: Array<{ id: string; word_target_audio_url?: string | null; sentence_target_audio_url?: string | null }> }).items)
        : [];

      if (items.length > 0) {
        const updates: Record<
          string,
          { word_target_audio_url?: string | null; sentence_target_audio_url?: string | null }
        > = {};

        for (const item of items) {
          const pairId = String(item.id || "").trim();
          if (!pairId) continue;
          updates[pairId] = {
            word_target_audio_url: item.word_target_audio_url ?? null,
            sentence_target_audio_url: item.sentence_target_audio_url ?? null,
          };
          audioEnrichDoneRef.current.add(pairId);
        }

        flow.mergeSessionAudioById(updates);
      }
    } catch {
      // Keep session usable even if enrichment fails.
    } finally {
      audioEnrichBusyRef.current = false;
      if (audioEnrichQueuedRef.current.size > 0) {
        void flushAudioEnrichment();
      }
    }
  }, [flow, targetLang]);

  useEffect(() => {
    if (!targetLang) return;
    if (flow.sessionPairs.length === 0) return;

    const orderedIds: string[] = [];
    const seen = new Set<string>();
    const currentId = flow.currentPair?.id ? String(flow.currentPair.id).trim() : "";
    if (currentId) {
      orderedIds.push(currentId);
      seen.add(currentId);
    }
    for (const pair of flow.sessionPairs) {
      const pairId = String(pair?.id || "").trim();
      if (!pairId || seen.has(pairId)) continue;
      seen.add(pairId);
      orderedIds.push(pairId);
    }

    let queued = false;
    for (const pairId of orderedIds) {
      if (audioEnrichDoneRef.current.has(pairId)) continue;
      if (audioEnrichQueuedRef.current.has(pairId)) continue;
      audioEnrichQueuedRef.current.add(pairId);
      queued = true;
    }

    if (queued) {
      void flushAudioEnrichment();
    }
  }, [flow.sessionPairs, flow.currentPair?.id, flushAudioEnrichment, targetLang]);

  useEffect(() => {
    if (!debugAudio) return;
    console.debug("[audio-debug]", "derived state", {
      stage: flow.currentStage ?? null,
      rawAudio: derived.rawAudio ?? null,
      resolvedUrl: resolveAudioUrl(derived.rawAudio ?? null) || null,
      hasAudio: derived.hasAudio,
      viewMode: flow.viewMode,
      deckId: flow.currentPair?.id ?? null,
    });
  }, [
    debugAudio,
    flow.currentStage,
    derived.rawAudio,
    derived.hasAudio,
    flow.viewMode,
    flow.currentPair?.id,
  ]);

  const sessionPairsLen = flow.sessionPairs.length;
  const learnQueueLen = flow.learnQueue.length;

  const enteredLearnPracticeRef = useRef(false);
  const skipNullStageRef = useRef<string>("");
  const nullStageCycleRef = useRef<Set<string>>(new Set());
  const wsAutoAdvanceKeyRef = useRef<string>("");
  const favouriteActionBusyRef = useRef(false);

  const [audioGateHint, setAudioGateHint] = useState("");
  const [pendingCardInteraction, setPendingCardInteraction] = useState<{
    interaction: "mastered" | "easy";
    startedAtMs: number;
    fromCardKey: string;
  } | null>(null);

  useEffect(() => {
    consumeRouteInteractionTiming();
  }, []);

  useEffect(() => {
    if (!serverTiming) return;
    let cancelled = false;
    let attempt = 0;
    const maxAttempts = 20;

    console.info("[start_practice_server_timing] payload received in PracticeClient", {
      hasPayload: !!serverTiming,
      keys: Object.keys(serverTiming),
      total_server_ms: serverTiming.total_server_ms,
      dominant_stage: serverTiming.dominant_stage,
    });

    const emitWhenGaReady = () => {
      if (cancelled) return;
      const w = window as Window & { gtag?: unknown; dataLayer?: unknown };
      const gtagReady = typeof w.gtag === "function";
      const dataLayerReady = Array.isArray(w.dataLayer);
      const gaReady = gtagReady || dataLayerReady;

      if (gaReady) {
        console.info("[start_practice_server_timing] GA ready detected", {
          gtagReady,
          dataLayerReady,
          attempt,
        });
        console.info("[start_practice_server_timing] sending event", {
          event: "start_practice_server_timing",
          total_server_ms: serverTiming.total_server_ms,
          dominant_stage: serverTiming.dominant_stage,
        });
        trackGaEvent("start_practice_server_timing", serverTiming);
        console.info("[start_practice_server_timing]", serverTiming);
        return;
      }

      attempt += 1;
      if (attempt >= maxAttempts) {
        console.warn("[start_practice_server_timing] GA not ready; event not sent after retries", {
          attempts: maxAttempts,
          gtagReady,
          dataLayerReady,
        });
        return;
      }

      window.setTimeout(emitWhenGaReady, 120);
    };

    emitWhenGaReady();
    return () => {
      cancelled = true;
    };
  }, [serverTiming]);

  const currentCardKey = useMemo(() => {
    if (!flow.currentPair || !flow.currentStage) return "";
    return `${flow.currentPair.id}|${flow.currentStage}`;
  }, [flow.currentPair?.id, flow.currentStage]);

  useEffect(() => {
    if (!pendingCardInteraction) return;
    if (!currentCardKey) return;
    if (currentCardKey === pendingCardInteraction.fromCardKey) return;

    emitInteractionTiming(pendingCardInteraction.interaction, pendingCardInteraction.startedAtMs, {
      mode,
      review: isReview ? 1 : 0,
    });
    setPendingCardInteraction(null);
  }, [pendingCardInteraction, currentCardKey, mode, isReview]);

  useEffect(() => {
    if (!audioGateHint) return;
    const t = window.setTimeout(() => setAudioGateHint(""), 2200);
    return () => window.clearTimeout(t);
  }, [audioGateHint]);

  useEffect(() => {
    if (flow.revealed) setAudioGateHint("");
  }, [flow.revealed]);

  const [favKeys, setFavKeys] = useState<Set<string>>(() => new Set());
  const [favLoaded, setFavLoaded] = useState(false);

  const favDir = useMemo(() => {
    if (isFavoritesSession) {
      const d = String(flow.currentPair?.fav_dir ?? "").toLowerCase().trim();
      if (d === "active" || d === "passive") return d;
      return "passive";
    }
    return isActiveFromUrl ? "active" : "passive";
  }, [isFavoritesSession, flow.currentPair, isActiveFromUrl]);

  const currentFavKey = useMemo(() => {
    if (!flow.currentPair || !flow.currentStage) return "";
    if (flow.currentStage !== "word" && flow.currentStage !== "sentence") return "";
    return `${flow.currentPair.id}|${flow.currentStage}`;
  }, [flow.currentPair?.id, flow.currentStage]);

  const isFavourited = !!(currentFavKey && favKeys.has(currentFavKey));

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setFavLoaded(false);
        const res = await fetch(
          `/api/favorites/list?target_lang=${encodeURIComponent(
            targetLang
          )}&native_lang=${encodeURIComponent(nativeLang)}`
        );
        const json = (await res.json().catch(() => ({}))) as FavoritesListResponse;
        if (!res.ok) throw new Error(json.error || "Failed to load favourites");

        const items = json.items ?? [];
        const next = new Set<string>();

        for (const it of items) {
          const pairId = String(it.pairId ?? "");
          const kind = it.kind === "word" || it.kind === "sentence" ? it.kind : "";
          if (!pairId || !kind) continue;
          next.add(`${pairId}|${kind}`);
        }

        if (!cancelled) {
          setFavKeys(next);
          setFavLoaded(true);
        }
      } catch {
        if (!cancelled) setFavLoaded(true);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [targetLang, nativeLang]);

  const favPairId = flow.currentPair?.id ?? "";
  const favKind =
    flow.currentStage === "word" || flow.currentStage === "sentence"
      ? flow.currentStage
      : "";

  const onAddFavourite = useCallback(async () => {
    if (!favPairId || !favKind) return "error" as const;

    const key = `${favPairId}|${favKind}`;
    if (favKeys.has(key)) return "already" as const;

    try {
      const res = await fetch("/api/favorites/toggle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pairId: favPairId,
          kind: favKind,
          dir: favDir,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as FavoritesToggleResponse;
      if (!res.ok) return "error" as const;

      if (json.favorited === true) {
        setFavKeys((prev) => {
          const next = new Set(prev);
          next.add(key);
          return next;
        });
        return "added" as const;
      }

      return "error" as const;
    } catch {
      return "error" as const;
    }
  }, [favKeys, favPairId, favKind, favDir]);

  const onRemoveFavourite = useCallback(async () => {
    if (!favPairId || !favKind) return "error" as const;

    const key = `${favPairId}|${favKind}`;

    try {
      const res = await fetch("/api/favorites/toggle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pairId: favPairId,
          kind: favKind,
          dir: favDir,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as FavoritesToggleResponse;
      if (!res.ok) return "error" as const;

      if (json.favorited === false) {
        setFavKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });

        if (isFavoritesSession && flow.viewMode === "practice") {
          flow.goNext((href) => router.replace(href));
        }

        return "removed" as const;
      }

      return "error" as const;
    } catch {
      return "error" as const;
    }
  }, [favPairId, favKind, favDir, isFavoritesSession, flow.viewMode, router, flow]);

  const onFavouriteKey = useCallback(() => {
    if (favouriteActionBusyRef.current) return "error" as const;

    favouriteActionBusyRef.current = true;
    const action = isFavoritesSession ? onRemoveFavourite : onAddFavourite;

    return Promise.resolve(action()).finally(() => {
      favouriteActionBusyRef.current = false;
    });
  }, [isFavoritesSession, onRemoveFavourite, onAddFavourite]);

  useEffect(() => {
    if (!flow.isFinishing) return;
    router.replace(finishHref);
  }, [flow.isFinishing, router, finishHref]);

  useEffect(() => {
    if (flow.viewMode !== "practice") {
      wsAutoAdvanceKeyRef.current = "";
      return;
    }
    if (isReview) return;
    if (mode !== "ws") return;
    if (flow.isFinishing) return;
    if (flow.busy) return;
    if (!flow.currentPair) return;

    if (flow.currentStage !== null) {
      wsAutoAdvanceKeyRef.current = "";
      return;
    }

    const key = `${flow.idx}|${flow.wsPos}|${flow.currentPair.id}|${flow.currentStage ?? "null"}`;
    if (wsAutoAdvanceKeyRef.current === key) return;
    wsAutoAdvanceKeyRef.current = key;

    flow.goNext((href) => router.replace(href));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    flow.viewMode,
    isReview,
    mode,
    flow.idx,
    flow.wsPos,
    flow.currentPair?.id,
    flow.currentStage,
    flow.busy,
    flow.isFinishing,
  ]);

  useEffect(() => {
    if (flow.viewMode !== "practice") {
      skipNullStageRef.current = "";
      nullStageCycleRef.current.clear();
      return;
    }
    if (isReview) return;
    if (mode !== "words" && mode !== "sentences") return;

    if (sessionPairsLen === 0) return;
    if (learnQueueLen === 0) return;
    if (!flow.currentPair) return;

    if (flow.currentStage !== null) {
      nullStageCycleRef.current.clear();
      return;
    }

    const key = `${flow.idx}|${flow.learnQPos}|${flow.currentPair.id}`;
    if (skipNullStageRef.current === key) return;

    // If we revisit the same null-stage slot in one practice segment,
    // we've cycled through queue items that are all non-actionable.
    if (nullStageCycleRef.current.has(key)) {
      flow.finishSession((href) => router.replace(href));
      return;
    }
    nullStageCycleRef.current.add(key);
    skipNullStageRef.current = key;

    flow.goNext((href) => router.replace(href));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    flow.viewMode,
    isReview,
    mode,
    flow.idx,
    flow.learnQPos,
    flow.currentPair?.id,
    flow.currentStage,
    sessionPairsLen,
    learnQueueLen,
  ]);

  useEffect(() => {
    if (flow.viewMode !== "practice") {
      enteredLearnPracticeRef.current = false;
      return;
    }
    if (isReview) return;
    if (mode !== "words" && mode !== "sentences") return;

    if (!enteredLearnPracticeRef.current) {
      enteredLearnPracticeRef.current = true;
      return;
    }

    if (sessionPairsLen === 0) return;

    if (learnQueueLen === 0) {
      flow.finishSession((href) => router.replace(href));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.viewMode, isReview, mode, sessionPairsLen, learnQueueLen]);

  const reportCtx = usePracticeReportContext({
    mode,
    viewMode: flow.viewMode,
    currentPair: flow.currentPair,
    currentStage: flow.currentStage,
    previewWords: previewRows,
    selectedPreviewId: flow.selectedPreviewId,
    sessionPairs: flow.sessionPairs,
    report,
  });

  usePracticeKeyboard({
    viewMode: flow.viewMode,
    isReview,
    isFavoritesSession,
    revealed: flow.revealed,
    reportOpen: report.reportOpen,
    mode,

    canPlayAllPreview:
      flow.viewMode === "preview" &&
      (mode === "words" || (mode === "ws" && (previewRows?.length ?? 0) > 0)),

    onStartPractice: flow.startPractice,
    onPlayAllPreview: () => void flow.playAllPreviewWords(previewRows),

    onAddFavourite: onFavouriteKey,

    onHideTranslations: () => flow.setShowTranslations(false),
    onShowTranslations: () => flow.setShowTranslations(true),

    onReveal: () => flow.setRevealed(true),
    onNext: () => flow.goNext((href) => router.replace(href)),
    onDefer: () => flow.deferCurrent((href) => router.replace(href)),
    onMarkDone: () => void flow.markDone((href) => router.replace(href)),

    onReviewHard: () => flow.markReviewHard((href) => router.replace(href)),
    onReviewEasy: () => void flow.markReviewEasy((href) => router.replace(href)),

    onOpenReport: reportCtx.openReportFromContext,
    onCloseReport: report.closeReport,

    onPlayCurrent: () => {
      if (flow.viewMode === "practice" && itemIsActive && !flow.revealed) {
        setAudioGateHint("Reveal translation first");
        return;
      }
      flow.audio.enable();
      flow.audio.setMuted(false);
      flow.playCurrent();
    },

    onToggleMute: () => {
      flow.audio.enable();
      flow.audio.toggleMute();
      flow.audio.stop();
    },
    onTogglePlaybackRate: () => flow.audio.togglePlaybackRate(),

    deps: [
      flow.busy,
      flow.idx,
      itemIsActive,
      flow.revealed,
      flow.viewMode,
      flow.qPos,
      flow.queue,
      flow.wsPos,
      flow.wsSteps,
      previewRows,
      flow.learnQueue,
      flow.learnQPos,
      currentFavKey,
      isFavourited,
      isFavoritesSession,
      favLoaded,
    ],
  });

  const audioEl = <audio ref={flow.audio.audioRef} preload="auto" playsInline />;

  const emptyState = getPracticeEmptyState({
    hasSessionPairs: flow.sessionPairs.length > 0,
    categoryParam,
    isFavoritesSession,
    isReview,
    isActive: itemIsActive,
  });
  
    if (emptyState) {
    return (
      <>
        {audioEl}
        <PracticeEmptyState
          title={emptyState.title}
          text={emptyState.text}
          onBack={() => {
            startRouteInteractionTiming("back_navigation", finishHref, {
              source_page: "practice_empty_state",
              destination: finishHref,
              flow: isFavoritesSession
                ? "favorites"
                : isReview
                  ? (itemIsActive ? "active_review" : "passive_review")
                  : (itemIsActive ? "active_learning" : "passive_learning"),
              mode,
              category: categoryParam || "all",
            });
            router.replace(finishHref);
          }}
        />
      </>
    );
  }

  if (flow.viewMode === "preview") {
    return (
      <>
        {audioEl}
        <PreviewScreen
          deckName={deckName}
          finishHref={finishHref}
          mode={mode}
          isReview={isReview}
          isActive={itemIsActive}
          targetLang={targetLang}
          nativeLang={nativeLang}
          sessionPairs={flow.sessionPairs}
          previewWords={previewRows}
          noLimitPreviewHint={isNoLimitMode}
          showTranslations={flow.showTranslations}
          setShowTranslations={flow.setShowTranslations}
          selectedPreviewId={flow.selectedPreviewId}
          setSelectedPreviewId={flow.setSelectedPreviewId}
          playingPreviewId={flow.playingPreviewId}
          setPlayingPreviewId={flow.setPlayingPreviewId}
          playAllBusy={flow.playAllBusy}
          sessionPlanLabel={session.sessionPlanLabel}
          resolveAudioUrl={resolveAudioUrl}
          playbackRate={flow.audio.playbackRate}
          onTogglePlaybackRate={() => flow.audio.togglePlaybackRate()}
          playAllPreviewWords={(rows) => void flow.playAllPreviewWords(rows)}
          onRowPlay={flow.onPreviewRowPlay}
          startPractice={flow.startPractice}
          reportOpen={report.reportOpen}
          setReportOpen={report.setReportOpen}
          reportCat={report.reportCat}
          setReportCat={report.setReportCat}
          reportNote={report.reportNote}
          setReportNote={report.setReportNote}
          reportBusy={report.reportBusy}
          reportThanks={report.reportThanks}
          submitReport={() => void report.submitReport()}
          safeDeckId={safeDeckId}
          reportTarget={report.reportTarget}
          onOpenReport={reportCtx.openReportFromContext}
        />
      </>
    );
  }

    if (flow.isFinishing) return <>{audioEl}</>;

  if (!flow.currentPair || flow.currentStage === null) {
    return (
      <>
        {audioEl}
        <PracticeStatusCard />
      </>
    );
  }

  return (
    <>
      {audioEl}
      <PracticeScreen
        deckName={deckName}
        modeLabel={derived.modeLabel}
        badge={derived.badge}
        isReview={isReview}
        isActive={itemIsActive}
        revealed={flow.revealed}
        busy={flow.busy}
        sessionPlanLabel={session.sessionPlanLabel}
        reviewRemaining={derived.reviewRemaining}
        hasAudio={derived.hasAudio}
        audioMuted={flow.audio.muted}
        playbackRate={flow.audio.playbackRate}
        onTogglePlaybackRate={() => flow.audio.togglePlaybackRate()}
        prompt={derived.prompt}
        answer={derived.answer}
        isFavoritesSession={isFavoritesSession}
        isFavourited={isFavourited}
        onAddFavourite={onAddFavourite}
        onRemoveFavourite={onRemoveFavourite}
        onToggleMute={() => {
          flow.audio.enable();
          flow.audio.toggleMute();
          flow.audio.stop();
        }}
        onPlayAudio={() => {
          if (flow.viewMode === "practice" && itemIsActive && !flow.revealed) {
            setAudioGateHint("Reveal translation first");
            return;
          }
          if (debugAudio) {
            console.debug("[audio-debug]", "Play button handler fired", {
              stage: flow.currentStage ?? null,
              rawAudio: derived.rawAudio ?? null,
              resolvedUrl: resolveAudioUrl(derived.rawAudio ?? null) || null,
              hasAudio: derived.hasAudio,
            });
          }
          flow.audio.enable();
          flow.audio.setMuted(false);
          void flow.audio.play(derived.rawAudio);
        }}
        audioGateHint={audioGateHint}
        onRevealOrNext={() => {
          flow.audio.enable();
          if (isReview) {
            if (!flow.revealed) flow.setRevealed(true);
            return;
          }
          if (!flow.revealed) flow.setRevealed(true);
          else flow.goNext((href) => router.replace(href));
        }}
        onMastered={async () => {
          flow.audio.enable();
          setPendingCardInteraction({
            interaction: "mastered",
            startedAtMs: performance.now(),
            fromCardKey: currentCardKey,
          });
          // markDone already advances learnQueue / idx or finishes the session for
          // words/sentences learn — do not call goNext again (stale closure would double-advance).
          await flow.markDone((href) => router.replace(href));
        }}
        onReviewHard={() => flow.markReviewHard((href) => router.replace(href))}
        onReviewEasy={() => {
          setPendingCardInteraction({
            interaction: "easy",
            startedAtMs: performance.now(),
            fromCardKey: currentCardKey,
          });
          void flow.markReviewEasy((href) => router.replace(href));
        }}
        reportOpen={report.reportOpen}
        setReportOpen={report.setReportOpen}
        reportCat={report.reportCat}
        setReportCat={report.setReportCat}
        reportNote={report.reportNote}
        setReportNote={report.setReportNote}
        reportBusy={report.reportBusy}
        reportThanks={report.reportThanks}
        submitReport={() => void report.submitReport()}
        safeDeckId={safeDeckId}
        reportTarget={report.reportTarget}
        debugAudio={debugAudio}
        debugAudioStage={flow.currentStage}
        debugAudioHasUrl={!!resolveAudioUrl(derived.rawAudio ?? null)}
        sourceChipLabel={sourceChipLabel}
      />
    </>
  );
}
