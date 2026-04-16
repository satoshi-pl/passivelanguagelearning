"use client";

import { useEffect, useMemo } from "react";
import { createKeyHandler } from "./keyboard";
import type { LearnMode } from "./types";

type Args = {
  viewMode: "preview" | "practice";
  isReview: boolean;
  isFavoritesSession: boolean;
  revealed: boolean;
  reportOpen: boolean;

  // kept for compatibility with your call-sites
  mode: LearnMode;

  canPlayAllPreview: boolean;

  // actions
  onStartPractice(): void;
  onPlayAllPreview(): void;

  onHideTranslations(): void;
  onShowTranslations(): void;

  onReveal(): void;
  onNext(): void;
  onDefer(): void;
  onMarkDone(): void;

  // ✅ Favourites (supports add OR remove depending on session)
  onAddFavourite():
    | Promise<"added" | "already" | "removed" | "error">
    | "added"
    | "already"
    | "removed"
    | "error";

  onReviewHard(): void;
  onReviewEasy(): void;

  onOpenReport(): void;
  onCloseReport(): void;

  onPlayCurrent(): void;
  onToggleMute(): void;
  onTogglePlaybackRate(): void;

  deps: any[];
};

export function usePracticeKeyboard(args: Args) {
  const {
    viewMode,
    isReview,
    isFavoritesSession,
    revealed,
    reportOpen,
    canPlayAllPreview,

    onStartPractice,
    onPlayAllPreview,

    onHideTranslations,
    onShowTranslations,

    onReveal,
    onNext,
    onDefer,
    onMarkDone,

    onAddFavourite,

    onReviewHard,
    onReviewEasy,

    onOpenReport,
    onCloseReport,

    onPlayCurrent,
    onToggleMute,
    onTogglePlaybackRate,

    deps,
  } = args;

  // ✅ Never spread a variable-length array into a hook dep list.
  const depsKey = useMemo(() => JSON.stringify(deps ?? []), [deps]);

  useEffect(() => {
    const onKey = createKeyHandler({
      viewMode,
      isReview,
      isFavoritesSession,
      revealed,
      reportOpen,
      canPlayAllPreview,

      onStartPractice,
      onPlayAllPreview,

      onHideTranslations,
      onShowTranslations,

      onReveal,
      onNext,
      onDefer,
      onMarkDone,

      onAddFavourite,

      onReviewHard,
      onReviewEasy,

      onOpenReport,
      onCloseReport,

      onPlayCurrent,
      onToggleMute,
      onTogglePlaybackRate,
    });

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    viewMode,
    isReview,
    isFavoritesSession,
    revealed,
    reportOpen,
    canPlayAllPreview,
    onAddFavourite, // ✅ keep handler current
    depsKey,
  ]);
}