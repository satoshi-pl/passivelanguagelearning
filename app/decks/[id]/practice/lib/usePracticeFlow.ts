"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAudioController } from "./useAudioController";
import { usePracticeActions } from "./usePracticeActions";
import { usePreviewAudio } from "./usePreviewAudio";

import type {
  PairRow,
  ProgressMap,
  Stage,
  ViewMode,
  LearnMode,
  LearnStep,
} from "./types";
import { hasSentence, getPr, getPendingStage, buildWsSteps } from "./learning";

import { buildSessionPairs } from "./useSessionBuilder";

type Args = {
  deckId: string;
  safeDeckId: string;

  mode: LearnMode;
  isReview: boolean;
  isActive: boolean;

  chosenN: number;
  offset: number;

  finishHref: string;

  pairs: PairRow[];
  initialProgress: ProgressMap;

  resolveAudioUrl: (raw?: string | null) => string;
  debugAudio?: boolean;
};

export function usePracticeFlow({
  deckId,
  safeDeckId,
  mode,
  isReview,
  isActive,
  chosenN,
  offset,
  finishHref,
  pairs,
  initialProgress,
  resolveAudioUrl,
  debugAudio = false,
}: Args) {
  // ✅ detect favourites session (used to lock WS review to fav_kind)
  const isFavoritesSession = safeDeckId === "favorites" || deckId === "favorites";

  // =========================
  // STATE
  // =========================
  const [progress, setProgress] = useState<ProgressMap>(initialProgress || {});
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);

  const [sessionPairs, setSessionPairs] = useState<PairRow[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("preview");

  const [showTranslations, setShowTranslations] = useState(true);

  // REVIEW queue (indices into sessionPairs)
  const [queue, setQueue] = useState<number[]>([]);
  const [qPos, setQPos] = useState(0);
  const [idx, setIdx] = useState(0);

  // LEARN words/sentences: linear position through sessionPairs (kept for UI/compat)
  const [learnPos, setLearnPos] = useState(0);
  const learnPosRef = useRef(0);
  useEffect(() => {
    learnPosRef.current = learnPos;
  }, [learnPos]);

  // ✅ LEARN queue (indices into sessionPairs) — used for defer-to-end
  const [learnQueue, setLearnQueue] = useState<number[]>([]);
  const [learnQPos, setLearnQPos] = useState(0);

  const sessionPairsRef = useRef<PairRow[]>([]);
  useEffect(() => {
    sessionPairsRef.current = sessionPairs;
  }, [sessionPairs]);

  // Review repetition counters (per pair id)
  const reviewRepeatCountRef = useRef<Record<string, number>>({});
  const reviewRepeatStageRef = useRef<Record<string, Stage>>({});
  const reviewRepeatSingleRef = useRef<Record<string, boolean>>({});
  const reviewDoneRef = useRef<Record<string, { word?: boolean; sentence?: boolean }>>({});

  // Prevent end-of-session flicker
  const [isFinishing, setIsFinishing] = useState(false);

  // Learn WS steps
  const [learnWsStage, setLearnWsStage] = useState<Stage>("word");
  const [wsSteps, setWsSteps] = useState<LearnStep[]>([]);
  const [wsPos, setWsPos] = useState(0);

  // Review-only stage override
  const [reviewStage, setReviewStage] = useState<Stage>("word");

  // =========================
  // AUDIO
  // =========================
  const audio = useAudioController(resolveAudioUrl, debugAudio);
  const previewAudio = usePreviewAudio(audio, debugAudio);

  // keep audio in a ref so effects don't depend on unstable object identity
  const audioRef = useRef(audio);
  useEffect(() => {
    audioRef.current = audio;
  }, [audio]);

  // =========================
  // SESSION BUILD (guarded to avoid infinite loops)
  // =========================
  const lastBuildKeyRef = useRef<string>("");

  useEffect(() => {
    const buildKey = `${deckId}|${mode}|${isReview}|${chosenN}|${offset}|${pairs.length}`;
    if (lastBuildKeyRef.current === buildKey) return;
    lastBuildKeyRef.current = buildKey;

    // hard reset session-local state
    setRevealed(false);
    setShowTranslations(true);

    // review queue
    setQueue([]);
    setQPos(0);
    setIdx(0);

    // learn linear + learn queue
    setLearnPos(0);
    learnPosRef.current = 0;
    setLearnQueue([]);
    setLearnQPos(0);

    setViewMode("preview");

    // audio stop + reset preview UI
    audioRef.current.stop();
    previewAudio.resetPreviewAudioState();

    // reset review repeats per new session build
    reviewRepeatCountRef.current = {};
    reviewRepeatStageRef.current = {};
    reviewRepeatSingleRef.current = {};
    reviewDoneRef.current = {};

    // reset stages
    setReviewStage(mode === "sentences" ? "sentence" : "word");
    setLearnWsStage("word");

    // reset ws learn steps
    setWsSteps([]);
    setWsPos(0);

    // reset finishing flag
    setIsFinishing(false);

    // rebuild session
    const slice = buildSessionPairs({
      safePairs: pairs,
      progress,
      mode,
      isReview,
      chosenN,
      offset,
    });

    setSessionPairs(slice);
    setViewMode("preview");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId, mode, isReview, chosenN, offset, pairs.length]);

  // =========================
  // WS: effective mode + preview sizing
  // =========================
  const wsRemaining = useMemo(() => {
    if (isReview) return { words: 0, sentences: 0, wordIdx: [] as number[] };
    if (mode !== "ws") return { words: 0, sentences: 0, wordIdx: [] as number[] };

    const wordIdx: number[] = [];
    let words = 0;
    let sentences = 0;

    for (let i = 0; i < sessionPairs.length; i++) {
      const p = sessionPairs[i];
      if (!p) continue;
      const pr = getPr(p, progress);

      if (!pr.word_mastered) {
        words++;
        wordIdx.push(i);
      }
      if (hasSentence(p) && !pr.sentence_mastered) {
        sentences++;
      }
    }

    return { words, sentences, wordIdx };
  }, [isReview, mode, sessionPairs, progress]);

  const wsEffectiveMode = useMemo<LearnMode>(() => {
    if (mode !== "ws" || isReview) return mode;
    if (wsRemaining.words === 0) return "sentences";
    if (wsRemaining.sentences === 0) return "words";
    return "ws";
  }, [mode, isReview, wsRemaining.words, wsRemaining.sentences]);

  // In WS preview, preview WORDS only, capped to remaining words
  const wsPreviewCount = useMemo(() => {
    if (mode !== "ws" || isReview) return 0;
    if (wsEffectiveMode === "sentences") return 0; // skip preview entirely
    if (chosenN <= 0) return Math.min(5, wsRemaining.words);
    return Math.min(chosenN, wsRemaining.words);
  }, [mode, isReview, wsEffectiveMode, chosenN, wsRemaining.words]);

  // The actual rows to show in WS preview (pending words only)
  const wsPreviewPairs = useMemo<PairRow[]>(() => {
    if (mode !== "ws" || isReview) return [];
    if (wsPreviewCount <= 0) return [];
    const takeIdx = wsRemaining.wordIdx.slice(0, wsPreviewCount);
    return takeIdx.map((i) => sessionPairs[i]).filter(Boolean) as PairRow[];
  }, [mode, isReview, wsPreviewCount, wsRemaining.wordIdx, sessionPairs]);

  // =========================
  // WS init helper
  // (must be declared before effects/callbacks that use it)
  // =========================
  const initWsPractice = useCallback(() => {
    const steps = buildWsSteps(sessionPairsRef.current, progress);

    setWsSteps(steps);
    setWsPos(0);

    const first = steps[0];
    if (!first) {
      setIsFinishing(true);
      return false;
    }

    setIdx(first.pairIndex);
    setLearnWsStage(first.stage);
    setRevealed(false);
    audioRef.current.stop();
    return true;
  }, [progress]);

  // =========================
  // ENTER PRACTICE (auto)
  // =========================

  // Sentence-only LEARN: go directly into practice
  useEffect(() => {
    if (isReview) return;
    if (mode !== "sentences") return;
    if (sessionPairs.length === 0) return;
    if (viewMode !== "preview") return;

    audioRef.current.enable();
    audioRef.current.stop();
    setRevealed(false);
    setViewMode("practice");
  }, [isReview, mode, sessionPairs.length, viewMode]);

  // WS LEARN: if no WORDS remain, behave like sentence-only learn (skip preview)
  useEffect(() => {
    if (isReview) return;
    if (mode !== "ws") return;
    if (wsEffectiveMode !== "sentences") return;
    if (sessionPairs.length === 0) return;
    if (viewMode !== "preview") return;

    audioRef.current.enable();
    audioRef.current.stop();

    // ✅ init WS state BEFORE entering practice so we don't render null-stage
    const ok = initWsPractice();
    if (!ok) return;

    setViewMode("practice");
  }, [isReview, mode, wsEffectiveMode, sessionPairs.length, viewMode, initWsPractice]);

  // Review spec: starts immediately, no preview
  useEffect(() => {
    if (!isReview) return;
    if (sessionPairs.length === 0) return;
    if (viewMode !== "preview") return;

    audioRef.current.enable();
    setRevealed(false);
    setViewMode("practice");
  }, [isReview, sessionPairs.length, viewMode]);

  // =========================
  // QUEUES init when practice starts
  // =========================
  useEffect(() => {
    if (viewMode !== "practice") return;

    // REVIEW: random queue
    if (isReview) {
      const indices = sessionPairs.map((_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }

      setQueue(indices);
      setQPos(0);

      const firstIdx = indices[0] ?? 0;
      setIdx(firstIdx);
      setRevealed(false);
      audioRef.current.stop();

      if (mode === "sentences") setReviewStage("sentence");
      else if (mode === "words") setReviewStage("word");
      else {
        const firstPair = sessionPairs[firstIdx];
        const forced = firstPair ? reviewRepeatStageRef.current[firstPair.id] : undefined;
        if (forced === "sentence" && firstPair && hasSentence(firstPair)) setReviewStage("sentence");
        else setReviewStage("word");
      }
      return;
    }

    // ✅ LEARN words/sentences: initialize learnQueue (build ONCE per practice entry)
    if (!isReview && (mode === "words" || mode === "sentences")) {
      if (learnQueue.length > 0) return;

      const indices = sessionPairs
        .map((_, i) => i)
        .filter((i) => {
          const p = sessionPairs[i];
          return p ? getPendingStage(p, progress, mode) !== null : false;
        });

      setLearnQueue(indices);
      setLearnQPos(0);

      const firstIdx = indices[0] ?? 0;
      setIdx(firstIdx);

      setLearnPos(0);
      learnPosRef.current = 0;

      setRevealed(false);
      audioRef.current.stop();
      return;
    }

    // WS learn is initialized via startPractice() or WS skip-preview effect
  }, [viewMode, sessionPairs, progress, isReview, mode, learnQueue.length]);

  const currentPair = sessionPairs[idx] || null;

  const currentStage: Stage | null = useMemo(() => {
    if (!currentPair) return null;

    // ✅ FAVOURITES REVIEW OVERRIDE:
    // In favourites review sessions, each row represents ONE favourited item.
    // So we lock the stage to fav_kind and never show the "other half".
    if (isReview && isFavoritesSession) {
      const k = String((currentPair as any)?.fav_kind ?? "").toLowerCase().trim();
      if (k === "word") return "word";
      if (k === "sentence") {
        // safety: if sentence missing, fall back to word
        return hasSentence(currentPair) ? "sentence" : "word";
      }
      // fallback if fav_kind missing
      return hasSentence(currentPair) ? "sentence" : "word";
    }

    // REVIEW
    if (isReview) {
      if (mode === "sentences") return "sentence";
      if (mode === "words") return "word";
      if (reviewStage === "sentence" && !hasSentence(currentPair)) return "word";
      return reviewStage;
    }

    // LEARN ws
    if (mode === "ws") {
      const pr = getPr(currentPair, progress);

      if (learnWsStage === "word") {
        if (pr.word_mastered) return null;
        return "word";
      }

      // sentence
      if (!hasSentence(currentPair)) {
        if (!pr.word_mastered) return "word";
        return null;
      }
      if (pr.sentence_mastered) return null;
      return "sentence";
    }

    // LEARN words/sentences
    return getPendingStage(currentPair, progress, mode);
  }, [currentPair, isReview, isFavoritesSession, progress, mode, reviewStage, learnWsStage]);

  // stable play that does NOT depend on `audio` identity
  const playCurrent = useCallback(() => {
    if (!currentPair || !currentStage) return;
    audioRef.current.enable();
    const raw =
      currentStage === "word"
        ? currentPair.word_target_audio_url ?? currentPair.sentence_target_audio_url
        : currentPair.sentence_target_audio_url ?? currentPair.word_target_audio_url;
    void audioRef.current.play(raw);
  }, [currentPair?.id, currentStage]);

  // =========================
  // AUTOPLAY (practice mode)
  // =========================
  const lastAutoPlayKeyRef = useRef<string>("");

  useEffect(() => {
    if (viewMode !== "practice") {
      lastAutoPlayKeyRef.current = "";
      return;
    }
    if (isFinishing) return;
    if (busy) return;
    if (!currentPair || !currentStage) return;

    // ✅ effective active for favourites sessions (per item)
    const isFavSession = safeDeckId === "favorites" || deckId === "favorites";
    const effectiveIsActive = isFavSession
      ? String((currentPair as any)?.fav_dir ?? "").toLowerCase().trim() === "active"
      : isActive;

    // Passive: play BEFORE reveal
    // Active:  play AFTER reveal
    const shouldPlay = effectiveIsActive ? revealed : !revealed;
    if (!shouldPlay) return;

    const key = `${currentPair.id}|${currentStage}|${effectiveIsActive ? "active" : "passive"}|${
      revealed ? "revealed" : "hidden"
    }`;
    if (lastAutoPlayKeyRef.current === key) return;
    lastAutoPlayKeyRef.current = key;

    playCurrent();
  }, [
    viewMode,
    isFinishing,
    busy,
    revealed,
    currentPair?.id,
    currentStage,
    playCurrent,
    isActive,
    safeDeckId,
    deckId,
  ]);

  // extracted actions
  const actions = usePracticeActions({
    mode,
    isReview,
    isActive,
    safeDeckId,
    finishHref,

    revealed,
    busy,
    qPos,
    queue,
    wsPos,
    wsSteps,
    sessionPairs,
    currentPair,
    currentStage,

    // ✅ learn queue
    learnQueue,
    learnQPos,
    setLearnQueue,
    setLearnQPos,

    reviewRepeatCountRef,
    reviewRepeatStageRef,
    reviewRepeatSingleRef,
    reviewDoneRef,

    learnPosRef,
    sessionPairsRef,

    setRevealed,
    setBusy,
    setIsFinishing,

    setQPos,
    setIdx,
    setQueue,

    setWsPos,
    setWsSteps,
    setLearnWsStage,
    setReviewStage,

    setLearnPos,
    setProgress,

    audio,
  });

  const startPractice = useCallback(() => {
    audioRef.current.stop();
    previewAudio.resetPreviewAudioState();
    audioRef.current.enable();
    setRevealed(false);

    // ✅ WS learn: init step queue BEFORE entering practice
    if (!isReview && mode === "ws") {
      const ok = initWsPractice();
      if (!ok) return;
    }

    setViewMode("practice");
  }, [previewAudio, isReview, mode, initWsPractice]);

  return {
    // core
    progress,
    setProgress,

    sessionPairs,
    viewMode,
    setViewMode,

    // practice position
    idx,
    setIdx,
    qPos,
    queue,
    wsPos,
    wsSteps,

    // ✅ learn queue position (useful if needed)
    learnQueue,
    learnQPos,

    // ✅ WS effective mode + preview data
    wsEffectiveMode,
    wsPreviewCount,
    wsPreviewPairs,

    // flags
    revealed,
    setRevealed,
    busy,
    isFinishing,

    // current
    currentPair,
    currentStage,

    // preview UI
    showTranslations,
    setShowTranslations,

    // preview audio (from hook)
    selectedPreviewId: previewAudio.selectedPreviewId,
    setSelectedPreviewId: previewAudio.setSelectedPreviewId,
    playingPreviewId: previewAudio.playingPreviewId,
    setPlayingPreviewId: previewAudio.setPlayingPreviewId,
    playAllBusy: previewAudio.playAllBusy,
    onPreviewRowPlay: previewAudio.onPreviewRowPlay,
    playAllPreviewWords: previewAudio.playAllPreviewWords,

    // audio
    audio,
    playCurrent,

    // actions
    startPractice,

    // navigation / marking
    finishSession: actions.finishSession,
    goNext: actions.goNext,
    deferCurrent: actions.deferCurrent,
    markDone: actions.markDone,
    markReviewHard: actions.markReviewHard,
    markReviewEasy: actions.markReviewEasy,
  };
}