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
    mode: LearnMode;
    dir: "passive" | "active";
    source: "learn" | "review";
    category?: string;
  };
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
    const d = String((flow.currentPair as any)?.fav_dir ?? "").toLowerCase().trim();
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

  useEffect(() => {
    const base = chunkLoadConfig?.initialOffset ?? offset;
    setChunkHasMore(!!chunkLoadConfig?.enabled);
    setChunkBusy(false);
    setNextChunkOffset(base + safePairs.length);
  }, [chunkLoadConfig, offset, safePairs.length]);

  const loadMoreSessionPairs = useCallback(async () => {
    if (!chunkLoadConfig?.enabled) return;
    if (chunkBusy) return;
    if (!chunkHasMore) return;
    if (!safeDeckId) return;

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
          limit: chunkLoadConfig.chunkSize,
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

      setChunkHasMore(hasMore && items.length > 0);
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
      const d = String((flow.currentPair as any)?.fav_dir ?? "").toLowerCase().trim();
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
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((json as any)?.error || "Failed to load favourites");

        const items = (json as any)?.items ?? [];
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

      const json = await res.json().catch(() => ({}));
      if (!res.ok) return "error" as const;

      if ((json as any)?.favorited === true) {
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

      const json = await res.json().catch(() => ({}));
      if (!res.ok) return "error" as const;

      if ((json as any)?.favorited === false) {
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
          onBack={() => router.replace(finishHref)}
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
          // markDone already advances learnQueue / idx or finishes the session for
          // words/sentences learn — do not call goNext again (stale closure would double-advance).
          await flow.markDone((href) => router.replace(href));
        }}
        onReviewHard={() => flow.markReviewHard((href) => router.replace(href))}
        onReviewEasy={() => void flow.markReviewEasy((href) => router.replace(href))}
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
