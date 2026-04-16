import type { ViewMode } from "./types";

function isTypingTarget(el: EventTarget | null) {
  const node = el as HTMLElement | null;
  if (!node) return false;
  const tag = (node.tagName || "").toLowerCase();
  return tag === "input" || tag === "textarea" || (node as any).isContentEditable;
}

type KeyboardArgs = {
  viewMode: ViewMode;
  isReview: boolean;
  isFavoritesSession: boolean;
  revealed: boolean;
  reportOpen: boolean;

  // only true in word/ws preview (where the table exists)
  canPlayAllPreview: boolean;

  // actions
  onStartPractice(): void;

  onReveal(): void;
  onNext(): void;
  onDefer(): void;
  onMarkDone(): void;

  // ✅ favourites (add OR remove depending on session)
  onAddFavourite():
    | ("added" | "already" | "removed" | "error")
    | Promise<"added" | "already" | "removed" | "error">;

  onReviewHard(): void;
  onReviewEasy(): void;

  onHideTranslations(): void;
  onShowTranslations(): void;

  onOpenReport(): void;
  onCloseReport(): void;

  onPlayAllPreview(): void;
  onPlayCurrent(): void;

  onToggleMute(): void;
  onTogglePlaybackRate(): void;
};

export function createKeyHandler(args: KeyboardArgs) {
  return function onKey(e: KeyboardEvent) {
    if (isTypingTarget(e.target)) return;

    const k = (e.key || "").toLowerCase();
    const code = e.code || "";

    const is0 = code === "Digit0" || code === "Numpad0";
    const is1 = code === "Digit1" || code === "Numpad1";

    // ESC closes report modal
    if (k === "escape" && args.reportOpen) {
      e.preventDefault();
      args.onCloseReport();
      return;
    }

    // R = report
    if (k === "r") {
      e.preventDefault();
      args.onOpenReport();
      return;
    }

    // ✅ F = add/remove favourites
    if (k === "f") {
      e.preventDefault();
      if (e.repeat) return;
      void args.onAddFavourite();
      return;
    }

    // A = play audio
    if (k === "a") {
      e.preventDefault();
      if (args.viewMode === "preview") {
        if (args.canPlayAllPreview) args.onPlayAllPreview();
        return;
      }
      args.onPlayCurrent();
      return;
    }

    // M = mute toggle
    if (k === "m") {
      e.preventDefault();
      args.onToggleMute();
      return;
    }

    // V = playback speed cycle
    if (k === "v") {
      e.preventDefault();
      args.onTogglePlaybackRate();
      return;
    }

    // ===== REVIEW MODE =====
    if (args.isReview && args.viewMode === "practice") {
      const isReviewSecondary = is0 || (args.isFavoritesSession && k === "s");
      const isReviewPrimary = is1 || (args.isFavoritesSession && k === "d");

      if (isReviewSecondary) {
        e.preventDefault();
        if (!args.revealed) args.onReveal();
        else args.onReviewHard();
        return;
      }
      if (isReviewPrimary) {
        e.preventDefault();
        if (!args.revealed) args.onReveal();
        else args.onReviewEasy();
        return;
      }
      return;
    }

    // ===== PREVIEW MODE =====
    if (args.viewMode === "preview") {
      if (k === "enter") {
        e.preventDefault();
        args.onStartPractice();
        return;
      }
      if (k === "h") {
        e.preventDefault();
        args.onHideTranslations();
        return;
      }
      if (k === "s") {
        e.preventDefault();
        args.onShowTranslations();
        return;
      }
      return;
    }

    // ===== LEARN MODE (practice only) =====
    // 0 = reveal / defer-to-end
    if (is0) {
      e.preventDefault();
      if (!args.revealed) args.onReveal();
      else args.onDefer();
      return;
    }

    // s = reveal / next
    if (k === "s") {
      e.preventDefault();
      if (!args.revealed) args.onReveal();
      else args.onNext();
      return;
    }

    // 1 = mastered
    if (is1) {
      e.preventDefault();
      args.onMarkDone();
      return;
    }

    // d = mastered (desktop-friendly primary)
    if (k === "d") {
      e.preventDefault();
      args.onMarkDone();
      return;
    }
  };
}
