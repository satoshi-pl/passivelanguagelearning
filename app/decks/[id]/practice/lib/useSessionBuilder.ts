"use client";

import { useMemo } from "react";
import type { PairRow, ProgressMap, LearnMode, LearnStep } from "./types";
import {
  hasSentence,
  getPendingStage,
  buildWsSteps,
  buildWsSessionPairs,
  getPr,
} from "./learning";

// Fisher–Yates shuffle
function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Args = {
  safePairs: PairRow[];
  progress: ProgressMap;

  mode: LearnMode;
  isReview: boolean;

  chosenN: number;
  offset: number;

  sessionPairs: PairRow[];
};

export function buildSessionPairs(args: Omit<Args, "sessionPairs">) {
  const { safePairs, progress, mode, isReview, chosenN, offset } = args;

  // ============================
  // ✅ REVIEW MODE (DON'T TOUCH)
  // ============================
  if (isReview) {
    let eligible = safePairs;
    if (mode === "sentences") eligible = eligible.filter((p) => hasSentence(p));

    if (eligible.length === 0) return [];

    const shuffled = shuffle(eligible);
    const start = Math.min(offset, shuffled.length);
    return shuffled.slice(start, start + chosenN);
  }

  // ============================
  // ✅ LEARN MODE
  // ============================

  // WORDS learn:
  // Prefer words from pairs where the sentence is already mastered (so you "complete" pairs).
  if (mode === "words") {
    const pending = safePairs.filter(
      (p) => getPendingStage(p, progress, "words") === "word"
    );
    if (pending.length === 0) return [];

    const sentenceMasteredFirst = pending.filter(
      (p) => hasSentence(p) && getPr(p, progress).sentence_mastered
    );
    const rest = pending.filter(
      (p) => !(hasSentence(p) && getPr(p, progress).sentence_mastered)
    );

    const eligible = [...sentenceMasteredFirst, ...rest];

    const start = Math.min(offset, eligible.length);
    return eligible.slice(start, start + chosenN);
  }

  // SENTENCES learn:
  // Prefer sentences from pairs where the word is already mastered (so you "complete" pairs).
  if (mode === "sentences") {
    const pending = safePairs.filter(
      (p) => hasSentence(p) && getPendingStage(p, progress, "sentences") === "sentence"
    );
    if (pending.length === 0) return [];

    const wordMasteredFirst = pending.filter((p) => getPr(p, progress).word_mastered);
    const rest = pending.filter((p) => !getPr(p, progress).word_mastered);

    const eligible = [...wordMasteredFirst, ...rest];

    const start = Math.min(offset, eligible.length);
    return eligible.slice(start, start + chosenN);
  }

  // ✅ ws learn: prioritize FULL pending pairs first (word + sentence pending),
  // then replenish with word-only, then sentence-only.
  return buildWsSessionPairs({
    all: safePairs,
    prMap: progress,
    offset,
    chosenN,
  });
}

export function useSessionBuilder(args: Args) {
  const { sessionPairs, progress, mode, isReview } = args;

  // ✅ WS planned steps (so preview “planned” is accurate)
  const wsPlannedSteps: LearnStep[] = useMemo(() => {
    if (isReview) return [];
    if (mode !== "ws") return [];
    return buildWsSteps(sessionPairs, progress);
  }, [isReview, mode, sessionPairs, progress]);

  // ✅ Preview table content
  // - WORDS mode: unchanged
  // - WS mode: show ONLY pairs that will actually have a WORD step
  const previewWords: PairRow[] = useMemo(() => {
    if (isReview) return sessionPairs;

    if (mode === "words") {
      return sessionPairs.filter(
        (p) => getPendingStage(p, progress, mode) === "word"
      );
    }

    if (mode === "ws") {
      return sessionPairs.filter(
        (p) => getPendingStage(p, progress, "ws") === "word"
      );
    }

    // sentences mode doesn't use the words preview table
    return [];
  }, [sessionPairs, progress, mode, isReview]);

  const wsPlannedWordCount = useMemo(() => {
    if (mode !== "ws" || isReview) return 0;
    return wsPlannedSteps.filter((s) => s.stage === "word").length;
  }, [mode, isReview, wsPlannedSteps]);

  const wsPlannedSentenceCount = useMemo(() => {
    if (mode !== "ws" || isReview) return 0;
    return wsPlannedSteps.filter((s) => s.stage === "sentence").length;
  }, [mode, isReview, wsPlannedSteps]);

  const sessionPlanLabel = useMemo(() => {
    if (isReview) {
      if (mode === "words") return `Words: ${sessionPairs.length}`;
      if (mode === "sentences") return `Sentences: ${sessionPairs.length}`;
      return `Items: ${sessionPairs.length}`;
    }

    if (mode === "ws") {
      return `Pairs: ${sessionPairs.length} • Words: ${wsPlannedWordCount} • Sentences: ${wsPlannedSentenceCount}`;
    }

    const w = sessionPairs.filter(
      (p) => getPendingStage(p, progress, mode) === "word"
    ).length;
    const s = sessionPairs.filter(
      (p) => getPendingStage(p, progress, mode) === "sentence"
    ).length;

    if (mode === "words") return `Words: ${w}`;
    if (mode === "sentences") return `Sentences: ${s}`;
    return `Words: ${w} • Sentences: ${s}`;
  }, [
    isReview,
    mode,
    sessionPairs,
    progress,
    wsPlannedWordCount,
    wsPlannedSentenceCount,
  ]);

  return {
    previewWords,
    wsPlannedSteps,
    sessionPlanLabel,
    wsPlannedWordCount,
    wsPlannedSentenceCount,
  };
}