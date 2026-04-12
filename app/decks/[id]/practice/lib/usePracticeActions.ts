"use client";

import { useRef } from "react";
import type { PairRow, ProgressMap, Stage, LearnMode, LearnStep } from "./types";
import { hasSentence } from "./learning";
import { useAudioController } from "./useAudioController";

type AudioController = ReturnType<typeof useAudioController>;
type ReviewDoneMap = Record<string, { word?: boolean; sentence?: boolean }>;

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

  // ✅ favourites sessions are "single-stage" even in ws review
  const isFavSession = safeDeckId === "favorites";

  // ✅ send last-reviewed ping for BOTH Hard and Easy
  const sendReviewPing = async () => {
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

    try {
      await fetch("/api/pair-review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pairId: currentPair.id,
          deckId: deckIdToSend,
          stage: currentStage,
          dir: dirToSend,
        }),
      });
    } catch {}
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

      if (wsSteps.length === 1) {
        setRevealed(false);
        audio.stop();
        const only = wsSteps[0];
        if (only) {
          setWsPos(0);
          setIdx(only.pairIndex);
          setLearnWsStage(only.stage);
        }
        return;
      }

      const cur = wsSteps[wsPos];
      if (!cur) return;

      const pairIndex = cur.pairIndex;

      const indices: number[] = [];
      for (let i = 0; i < wsSteps.length; i++) {
        if (wsSteps[i]?.pairIndex === pairIndex) indices.push(i);
      }
      if (!indices.length) return;

      const removedBeforeOrAt = indices.filter((i) => i <= wsPos).length;

      const nextSteps = wsSteps.slice();
      const block: LearnStep[] = [];
      for (let k = indices.length - 1; k >= 0; k--) {
        const removed = nextSteps.splice(indices[k], 1)[0];
        if (removed) block.unshift(removed);
      }

      block.sort((a, b) => (a.stage === "word" ? 0 : 1) - (b.stage === "word" ? 0 : 1));
      nextSteps.push(...block);

      let newPos = wsPos - removedBeforeOrAt;
      if (newPos < 0) newPos = 0;
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
    void sendReviewPing();

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

    // ✅ Easy counts as reviewed (updates last_reviewed_at)
    await sendReviewPing();

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
      const res = await fetch("/api/pair-progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pairId: args.currentPair.id,
          kind: args.currentStage === "word" ? "word" : "sentence",
          dir: isActive ? "active" : "passive",
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("pair-progress error:", (json as any)?.error || res.statusText);
        return;
      }

      setProgress((prev) => {
        const prevRow = prev[args.currentPair!.id] || {
          word_mastered: false,
          sentence_mastered: false,
        };
        const updatedRow =
          args.currentStage === "word"
            ? { ...prevRow, word_mastered: true }
            : { ...prevRow, sentence_mastered: true };
        return { ...prev, [args.currentPair!.id]: updatedRow };
      });

      // LEARN words/sentences: remove mastered item from learnQueue
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