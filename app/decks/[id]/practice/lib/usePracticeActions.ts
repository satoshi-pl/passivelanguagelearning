"use client";

import { useRef } from "react";
import type { PairRow, ProgressMap, Stage, LearnMode, LearnStep } from "./types";
import { hasSentence } from "./learning";
import { useAudioController } from "./useAudioController";

type AudioController = ReturnType<typeof useAudioController>;
type ReviewDoneMap = Record<string, { word?: boolean; sentence?: boolean }>;
const WS_REINSERT_DISTANCE = 5;

type Args = {
  // core flags
  mode: LearnMode;
  isReview: boolean;
  isActive: boolean;
  safeDeckId: string;
  finishHref: string;

  // state (read)
  revealed: boolean;
  busy: boolean;

  qPos: number;
  queue: number[];

  wsPos: number;
  wsSteps: LearnStep[];

  sessionPairs: PairRow[];
  currentPair: PairRow | null;
  currentStage: Stage | null;

  // learn queue (words/sentences)
  learnQueue: number[];
  learnQPos: number;
  setLearnQueue: React.Dispatch<React.SetStateAction<number[]>>;
  setLearnQPos: (v: number) => void;

  // refs used by the review logic
  reviewRepeatCountRef: React.MutableRefObject<Record<string, number>>;
  reviewRepeatStageRef: React.MutableRefObject<Record<string, Stage>>;
  reviewRepeatSingleRef: React.MutableRefObject<Record<string, boolean>>;
  reviewDoneRef: React.MutableRefObject<ReviewDoneMap>;

  // learn linear refs (kept for UI/compat)
  learnPosRef: React.MutableRefObject<number>;
  sessionPairsRef: React.MutableRefObject<PairRow[]>;

  // setters
  setRevealed: (v: boolean) => void;
  setBusy: (v: boolean) => void;
  setIsFinishing: (v: boolean) => void;

  setQPos: (v: number) => void;
  setIdx: (v: number) => void;
  setQueue: React.Dispatch<React.SetStateAction<number[]>>;

  // ✅ WS setters
  setWsPos: (v: number) => void;
  setWsSteps: React.Dispatch<React.SetStateAction<LearnStep[]>>;
  setLearnWsStage: (v: Stage) => void;
  setReviewStage: (v: Stage) => void;

  setLearnPos: (v: number) => void;

  setProgress: React.Dispatch<React.SetStateAction<ProgressMap>>;

  // audio
  audio: AudioController;
};

export function usePracticeActions(args: Args) {
  const {
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

    learnQueue,
    learnQPos,
    setLearnQueue,
    setLearnQPos,

    reviewRepeatCountRef,
    reviewRepeatStageRef,
    reviewRepeatSingleRef,
    reviewDoneRef,

    learnPosRef,

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
  } = args;

  const finishingRef = useRef(false);
  const wsDeferredSentenceRef = useRef<Record<string, boolean>>({});

  // ✅ favourites sessions are "single-stage" even in ws review
  const isFavSession = safeDeckId === "favorites";

  const persistRequestWithRetry = async ({
    endpoint,
    body,
    label,
  }: {
    endpoint: string;
    body: Record<string, unknown>;
    label: string;
  }) => {
    let lastError = "";

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });

        if (res.ok) return;

        const json = await res.json().catch(() => ({}));
        lastError = String((json as { error?: unknown })?.error || res.statusText || "unknown error");
      } catch (error) {
        lastError = error instanceof Error ? error.message : "network error";
      }

      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    }

    console.error(`${label} background save failed:`, { endpoint, body, error: lastError });
  };

  const queueReviewPing = () => {
    if (!currentPair || !currentStage) return;

    const deckIdToSend = isFavSession
      ? String((currentPair as any)?.deck_id ?? "")
      : safeDeckId;

    const dirToSend = isFavSession
      ? (String((currentPair as any)?.fav_dir ?? "").toLowerCase().trim() === "active"
          ? "active"
          : "passive")
      : (isActive ? "active" : "passive");

    if (!deckIdToSend) return;

    void persistRequestWithRetry({
      endpoint: "/api/pair-review",
      body: {
        pairId: currentPair.id,
        deckId: deckIdToSend,
        stage: currentStage,
        dir: dirToSend,
      },
      label: "pair-review",
    });
  };

  const persistPairProgress = ({
    pairId,
    kind,
    dir,
  }: {
    pairId: string;
    kind: "word" | "sentence";
    dir: "passive" | "active";
  }) => {
    void persistRequestWithRetry({
      endpoint: "/api/pair-progress",
      body: { pairId, kind, dir },
      label: "pair-progress",
    });
  };

  const finishSession = async (routerReplace: (href: string) => void) => {
    if (finishingRef.current) return;
    finishingRef.current = true;

    setIsFinishing(true);
    audio.stop();
    await new Promise((r) => setTimeout(r, 150));
    routerReplace(finishHref);
  };

  const goNextReview = (routerReplace: (href: string) => void) => {
    setRevealed(false);
    audio.stop();

    // ✅ In normal ws review, we might show sentence after word.
    // ❗ In favourites ws review, do NOT do that (single-stage items).
    if (!isFavSession && mode === "ws" && currentPair) {
      const pairId = currentPair.id;
      const forced = reviewRepeatStageRef.current[pairId];
      const single = reviewRepeatSingleRef.current[pairId];

      const shouldSuppressAutoSentence =
        single && forced === "word" && currentStage === "word";
      const sentenceAlreadyDone = !!reviewDoneRef.current[pairId]?.sentence;

      if (!shouldSuppressAutoSentence) {
        if (currentStage === "word" && hasSentence(currentPair) && !sentenceAlreadyDone) {
          setReviewStage("sentence");
          return;
        }
      }

      setReviewStage("word");
    } else if (mode === "ws") {
      setReviewStage("word");
    }

    const nextPos = qPos + 1;
    if (nextPos >= queue.length) {
      void finishSession(routerReplace);
      return;
    }

    const nextIdx = queue[nextPos];
    const nextPair = sessionPairs[nextIdx];

    if (mode === "sentences") setReviewStage("sentence");
    else if (mode === "words") setReviewStage("word");
    else {
      const forced = nextPair ? reviewRepeatStageRef.current[nextPair.id] : undefined;
      if (!isFavSession && forced === "sentence" && nextPair && hasSentence(nextPair)) setReviewStage("sentence");
      else setReviewStage("word");
    }

    setQPos(nextPos);
    setIdx(nextIdx);
  };

  // helper: advance within LEARN queue (wraps, never finishes)
  const advanceLearn = () => {
    if (!learnQueue.length) return;

    const nextPos = learnQueue.length === 1 ? 0 : (learnQPos + 1) % learnQueue.length;
    const nextIdx = learnQueue[nextPos] ?? 0;

    setLearnQPos(nextPos);
    learnPosRef.current = nextPos;
    setLearnPos(nextPos);
    setIdx(nextIdx);

    setRevealed(false);
    audio.stop();
  };

  const goNext = (routerReplace: (href: string) => void) => {
    setRevealed(false);
    audio.stop();

    if (isReview) {
      goNextReview(routerReplace);
      return;
    }

    // LEARN ws
    if (mode === "ws") {
      const nextPos = wsPos + 1;

      if (nextPos < wsSteps.length) {
        const step = wsSteps[nextPos];
        setWsPos(nextPos);
        setIdx(step.pairIndex);
        setLearnWsStage(step.stage);
        return;
      }

      void finishSession(routerReplace);
      return;
    }

    // LEARN words/sentences
    if (mode === "words" || mode === "sentences") {
      if (!learnQueue.length) {
        void finishSession(routerReplace);
        return;
      }
      advanceLearn();
      return;
    }

    void finishSession(routerReplace);
  };

  // ✅ defer current item to end
  const deferCurrent = (_routerReplace: (href: string) => void) => {
    if (isReview) return;

    if (!revealed) {
      setRevealed(true);
      return;
    }

    // ✅ WS LEARN: defer the WHOLE PAIR to the end
    if (mode === "ws") {
      if (!wsSteps.length) return;

      const cur = wsSteps[wsPos];
      if (!cur) return;

      const nextSteps = wsSteps.slice();
      const [removedStep] = nextSteps.splice(wsPos, 1);
      if (!removedStep) return;

      if (removedStep.stage === "word" && currentPair) {
        let removedSentence = false;
        for (let i = nextSteps.length - 1; i >= 0; i--) {
          const step = nextSteps[i];
          if (step?.pairIndex === removedStep.pairIndex && step.stage === "sentence") {
            nextSteps.splice(i, 1);
            removedSentence = true;
          }
        }
        if (removedSentence) {
          wsDeferredSentenceRef.current[currentPair.id] = true;
        }
      }

      const insertPos = Math.min(wsPos + WS_REINSERT_DISTANCE, nextSteps.length);
      nextSteps.splice(insertPos, 0, removedStep);

      let newPos = wsPos;
      if (newPos >= nextSteps.length) newPos = 0;

      const next = nextSteps[newPos];

      setWsSteps(nextSteps);
      setWsPos(newPos);

      setRevealed(false);
      audio.stop();

      if (next) {
        setIdx(next.pairIndex);
        setLearnWsStage(next.stage);
      }
      return;
    }

    // ✅ LEARN words/sentences: defer current item to end of learnQueue
    if (mode !== "words" && mode !== "sentences") return;

    const q = learnQueue;
    if (!q.length) return;

    if (q.length === 1) {
      setRevealed(false);
      audio.stop();
      setIdx(q[0] ?? 0);
      setLearnQPos(0);
      learnPosRef.current = 0;
      setLearnPos(0);
      return;
    }

    const curPos = learnQPos;
    if (curPos < 0 || curPos >= q.length) return;

    const newQueue = q.slice();
    const [removed] = newQueue.splice(curPos, 1);
    newQueue.push(removed);

    const newPos = curPos >= newQueue.length ? 0 : curPos;
    const nextIdx = newQueue[newPos] ?? 0;

    setLearnQueue(newQueue);
    setLearnQPos(newPos);

    learnPosRef.current = newPos;
    setLearnPos(newPos);

    setRevealed(false);
    audio.stop();
    setIdx(nextIdx);
  };

  const markReviewHard = (routerReplace: (href: string) => void) => {
    if (!isReview) return;
    if (!currentPair) return;

    if (!revealed) {
      setRevealed(true);
      return;
    }

    // ✅ Hard counts as reviewed too (updates last_reviewed_at)
    queueReviewPing();

    // ✅ disable ws word->sentence chaining in favourites
    if (isFavSession && mode === "ws") {
      goNextReview(routerReplace);
      return;
    }

    if (mode === "ws" && currentStage === "word" && hasSentence(currentPair)) {
      const pairId = currentPair.id;

      reviewRepeatStageRef.current[pairId] = "word";
      reviewRepeatSingleRef.current[pairId] = true;

      const currentRepeats = reviewRepeatCountRef.current[pairId] ?? 0;
      const MAX_EXTRA_REPEATS = 2;
      const canRepeat = currentRepeats < MAX_EXTRA_REPEATS;

      const nextPos = qPos + 1;

      if (canRepeat) {
        reviewRepeatCountRef.current[pairId] = currentRepeats + 1;
        setQueue((prev) => {
          const alreadyLater = prev.slice(nextPos).includes(args.sessionPairs.indexOf(currentPair));
          if (alreadyLater) return prev;
          const curIdx = prev[args.qPos] ?? args.sessionPairs.indexOf(currentPair);
          return [...prev, curIdx];
        });
      }

      setReviewStage("sentence");
      setRevealed(false);
      audio.stop();
      return;
    }

    const pairId = currentPair.id;

    if (mode === "ws" && currentStage === "sentence") {
      reviewRepeatStageRef.current[pairId] = "sentence";
      reviewRepeatSingleRef.current[pairId] = true;
    }

    const currentRepeats = reviewRepeatCountRef.current[pairId] ?? 0;
    const MAX_EXTRA_REPEATS = 2;
    const canRepeat = currentRepeats < MAX_EXTRA_REPEATS;

    const nextPos = qPos + 1;

    if (canRepeat) {
      reviewRepeatCountRef.current[pairId] = currentRepeats + 1;
      setQueue((prev) => {
        const curIdx = prev[qPos] ?? 0;
        const alreadyLater = prev.slice(nextPos).includes(curIdx);
        if (alreadyLater) return prev;
        return [...prev, curIdx];
      });
    }

    if (!canRepeat && nextPos >= queue.length) {
      void finishSession(routerReplace);
      return;
    }

    if (mode === "ws") setReviewStage("word");

    if (nextPos < queue.length) {
      setQPos(nextPos);
      setIdx(queue[nextPos]);
    } else {
      setQPos(nextPos);
      setIdx(queue[nextPos] ?? (queue[qPos] ?? 0));
    }

    setRevealed(false);
    audio.stop();
  };

  const markReviewEasy = async (routerReplace: (href: string) => void) => {
    if (!isReview) return;

    if (!revealed) {
      setRevealed(true);
      return;
    }

    if (currentPair && currentStage) {
      const pid = currentPair.id;
      reviewDoneRef.current[pid] = {
        ...(reviewDoneRef.current[pid] || {}),
        [currentStage]: true,
      };
    }

    // ✅ Easy counts as reviewed too; persist in background so UI can advance instantly
    queueReviewPing();

    // ✅ disable ws word->sentence chaining in favourites
    if (isFavSession && mode === "ws") {
      goNextReview(routerReplace);
      return;
    }

    if (mode === "ws" && currentPair && currentStage === "word" && hasSentence(currentPair)) {
      const pid = currentPair.id;
      const forced = reviewRepeatStageRef.current[pid];
      const single = reviewRepeatSingleRef.current[pid];
      const suppress = single && forced === "word";
      const sentenceAlreadyDone = !!reviewDoneRef.current[pid]?.sentence;

      if (!suppress && !sentenceAlreadyDone) {
        setReviewStage("sentence");
        setRevealed(false);
        audio.stop();
        return;
      }
    }

    goNextReview(routerReplace);
  };

  const markDone = async (routerReplace: (href: string) => void) => {
    if (!args.currentPair || !args.currentStage) return;
    if (busy) return;
    if (!revealed) return;

    setBusy(true);
    try {
      const pairId = args.currentPair.id;
      const kind = args.currentStage === "word" ? "word" : "sentence";
      const dir = isActive ? "active" : "passive";

      persistPairProgress({ pairId, kind, dir });

      setProgress((prev) => {
        const prevRow = prev[pairId] || {
          word_mastered: false,
          sentence_mastered: false,
        };
        const updatedRow =
          kind === "word"
            ? { ...prevRow, word_mastered: true }
            : { ...prevRow, sentence_mastered: true };
        return { ...prev, [pairId]: updatedRow };
      });

      // LEARN words/sentences: remove mastered item from learnQueue
      if (!isReview && mode === "ws" && args.currentStage === "word" && currentPair) {
        const pairId = currentPair.id;
        const pairIndex =
          wsSteps[wsPos]?.pairIndex ??
          args.sessionPairs.findIndex((p) => p.id === pairId);

        const hadDeferredSentence = !!wsDeferredSentenceRef.current[pairId];
        const hasUpcomingSentence =
          pairIndex >= 0 &&
          wsSteps.some(
            (step, i) => i > wsPos && step.pairIndex === pairIndex && step.stage === "sentence"
          );
        const shouldShowSentenceNow =
          pairIndex >= 0 &&
          hasSentence(currentPair) &&
          (hadDeferredSentence || hasUpcomingSentence);

        if (shouldShowSentenceNow) {
          if (hadDeferredSentence) delete wsDeferredSentenceRef.current[pairId];

          const withoutSentence = wsSteps.filter(
            (step, i) => !(i > wsPos && step.pairIndex === pairIndex && step.stage === "sentence")
          );
          const insertAt = Math.min(wsPos + 1, withoutSentence.length);
          const nextSteps = withoutSentence.slice();
          nextSteps.splice(insertAt, 0, { pairIndex, stage: "sentence" });

          setWsSteps(nextSteps);
          setWsPos(insertAt);
          setIdx(pairIndex);
          setLearnWsStage("sentence");
          setRevealed(false);
          audio.stop();
          return;
        }
      }

      if (!isReview && (mode === "words" || mode === "sentences")) {
        const q = learnQueue;
        if (!q.length) {
          void finishSession(routerReplace);
          return;
        }

        const curPos = learnQPos;
        const newQueue = q.slice();
        newQueue.splice(curPos, 1);

        if (newQueue.length === 0) {
          void finishSession(routerReplace);
          return;
        }

        const newPos = curPos >= newQueue.length ? 0 : curPos;
        const nextIdx = newQueue[newPos] ?? 0;

        setLearnQueue(newQueue);
        setLearnQPos(newPos);

        learnPosRef.current = newPos;
        setLearnPos(newPos);

        setRevealed(false);
        audio.stop();
        setIdx(nextIdx);
        return;
      }

      goNext(routerReplace);
    } finally {
      setBusy(false);
    }
  };

  return {
    finishSession,
    goNext,
    goNextReview,
    deferCurrent,
    markDone,
    markReviewHard,
    markReviewEasy,
  };
}