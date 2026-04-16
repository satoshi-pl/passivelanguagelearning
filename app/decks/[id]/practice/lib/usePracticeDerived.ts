// lib/usePracticeDerived.ts
"use client";

import { useMemo } from "react";
import type { PairRow, Stage, LearnMode } from "./types";
import { pickAudioRaw } from "./audioRaw";

type Args = {
  mode: LearnMode;
  isActive: boolean;
  isReview: boolean;

  currentPair: PairRow | null;
  currentStage: Stage | null;

  queue: number[];
  qPos: number;

  resolveAudioUrl: (raw?: string | null) => string;

  // deck lookup (used mainly for favourites sessions spanning multiple decks)
  deckNameById?: Record<string, string>;
};

export function usePracticeDerived({
  mode,
  isActive,
  isReview,
  currentPair,
  currentStage,
  queue,
  qPos,
  resolveAudioUrl,
  deckNameById = {},
}: Args) {
  const prompt = useMemo(() => {
    if (!currentPair || !currentStage) return "";
    if (currentStage === "word") return isActive ? currentPair.word_native : currentPair.word_target;
    return isActive ? currentPair.sentence_native || "" : currentPair.sentence_target || "";
  }, [currentPair, currentStage, isActive]);

  const answer = useMemo(() => {
    if (!currentPair || !currentStage) return "";
    if (currentStage === "word") return isActive ? currentPair.word_target : currentPair.word_native;
    return isActive ? currentPair.sentence_target || "" : currentPair.sentence_native || "";
  }, [currentPair, currentStage, isActive]);

  const badge = useMemo(() => {
    if (!currentStage) return "";

    const base = currentStage === "word" ? "Word" : "Sentence";

    // Detect favourites context from row shape (fav_kind/fav_dir come from favourites RPC)
    const favKind = String((currentPair as any)?.fav_kind ?? "").toLowerCase().trim();
    const favDir = String((currentPair as any)?.fav_dir ?? "").toLowerCase().trim();
    const isFavRow = favKind === "word" || favKind === "sentence";

    // ✅ Robust deck id extraction (some codepaths may use deckId instead of deck_id)
    const deckId =
      String((currentPair as any)?.deck_id ?? "").trim() ||
      String((currentPair as any)?.deckId ?? "").trim();

    const deckLabel = deckId && deckNameById[deckId] ? String(deckNameById[deckId]) : "";

    if (!isFavRow) return base;

    let dirLabel = "";
    if (favDir === "active") dirLabel = "Active";
    else if (favDir === "passive") dirLabel = "Passive";

    const favBase = currentStage === "word" ? "⭐ Fav word" : "⭐ Fav sentence";

    const parts: string[] = [favBase];
    if (dirLabel) parts.push(`(${dirLabel})`);
    if (deckLabel) parts.push(`• ${deckLabel}`);

    return parts.join(" ");
  }, [currentStage, currentPair, deckNameById]);

  const modeLabel = useMemo(() => {
    return mode === "words"
      ? "Words"
      : mode === "sentences"
      ? "Sentences"
      : "Words + Sentences";
  }, [mode]);

  const rawAudio = useMemo(() => {
    if (!currentPair || !currentStage) return null;
    if (currentStage === "word") {
      // Some datasets only have sentence audio; keep play enabled in that case.
      return pickAudioRaw(currentPair.word_target_audio_url, currentPair.sentence_target_audio_url);
    }
    // Some datasets only have word audio; keep play enabled in that case.
    return pickAudioRaw(currentPair.sentence_target_audio_url, currentPair.word_target_audio_url);
  }, [currentPair, currentStage]);

  const hasAudio = useMemo(() => {
    return !!resolveAudioUrl(rawAudio ?? null);
  }, [rawAudio, resolveAudioUrl]);

  const reviewRemaining = useMemo(() => {
    return isReview ? Math.max(queue.length - qPos, 0) : 0;
  }, [isReview, queue.length, qPos]);

  return {
    prompt,
    answer,
    badge,
    modeLabel,
    rawAudio,
    hasAudio,
    reviewRemaining,
  };
}