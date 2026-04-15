"use client";

import { useEffect, useRef, useState } from "react";
import ReportModal from "./ReportModal";
import { Card, CardContent } from "../../../../components/ui/Card";
import { Button } from "../../../../components/ui/Button";

import type { PairRow, Stage, UiCategory } from "../lib/types";

type ReportTarget = { pair: PairRow | null; stage: Stage };

type Props = {
  deckName: string;

  modeLabel: string;
  badge: string;

  isReview: boolean;
  isActive: boolean;

  revealed: boolean;
  busy: boolean;

  sessionPlanLabel: string;
  reviewRemaining: number;

  hasAudio: boolean;
  audioMuted: boolean;
  playbackRate: number;

  prompt: string;
  answer: string;

  isFavoritesSession: boolean;
  isFavourited: boolean;
  onAddFavourite(): Promise<"added" | "already" | "error">;
  onRemoveFavourite(): Promise<"removed" | "error">;

  onToggleMute(): void;
  onPlayAudio(): void;
  onTogglePlaybackRate(): void;

  onRevealOrNext(): void;
  onMastered(): void;

  onReviewHard(): void;
  onReviewEasy(): void;

  reportOpen: boolean;
  setReportOpen(v: boolean): void;
  reportCat: UiCategory;
  setReportCat(v: UiCategory): void;
  reportNote: string;
  setReportNote(v: string): void;
  reportBusy: boolean;
  reportThanks: boolean;
  submitReport(): void;
  safeDeckId: string;
  reportTarget: ReportTarget;
  debugAudio?: boolean;
  debugAudioStage?: Stage | null;
  debugAudioHasUrl?: boolean;
  /** Active Learning: brief message when play is tapped before reveal */
  audioGateHint?: string;
  sourceChipLabel?: string;
};

export default function PracticeScreen(props: Props) {
  const {
    modeLabel,
    badge,
    isReview,
    isActive,
    revealed,
    busy,
    sessionPlanLabel,
    reviewRemaining,
    hasAudio,
    playbackRate,
    onTogglePlaybackRate,
    audioMuted,
    prompt,
    answer,
    isFavoritesSession,
    isFavourited,
    onAddFavourite,
    onRemoveFavourite,
    onToggleMute,
    onPlayAudio,
    onRevealOrNext,
    onMastered,
    onReviewHard,
    onReviewEasy,
    reportOpen,
    setReportOpen,
    reportCat,
    setReportCat,
    reportNote,
    setReportNote,
    reportBusy,
    reportThanks,
    submitReport,
    safeDeckId,
    reportTarget,
    debugAudio = false,
    debugAudioStage = null,
    debugAudioHasUrl = false,
    audioGateHint = "",
    sourceChipLabel = "Favourites",
  } = props;

  const [favBusy, setFavBusy] = useState(false);
  const [favFlash, setFavFlash] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const helpWrapRef = useRef<HTMLDivElement | null>(null);
  const playbackRateLabel = `${playbackRate.toFixed(1)}x`;

  useEffect(() => {
    if (!favFlash) return;
    const t = window.setTimeout(() => setFavFlash(""), 1800);
    return () => window.clearTimeout(t);
  }, [favFlash]);

  useEffect(() => {
    if (!helpOpen) return;
    const onDown = (e: MouseEvent) => {
      const el = helpWrapRef.current;
      if (!el?.contains(e.target as Node)) setHelpOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHelpOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [helpOpen]);

  const favLabel = favFlash
    ? favFlash
    : isFavoritesSession
      ? "Remove from favourites"
      : isFavourited
        ? "Added to favourites"
        : "Add to favourites";

  /** Filled gold star: in-list remove, already saved, or brief success / already flash */
  const favVisualFilled =
    isFavoritesSession ||
    isFavourited ||
    favFlash === "Added to favourites" ||
    favFlash === "Already in your favourites";
  const speedAria = `Change speed (${playbackRateLabel})`;
  const reviewSecondaryLabel = isFavoritesSession ? "Still learning" : "Hard";
  const reviewPrimaryLabel = isFavoritesSession ? "Mastered" : "Easy";
  const audioControlLabel = audioMuted ? "Audio Off" : "Audio On";

  const onFavClick = async () => {
    if (favBusy) return;
    setFavBusy(true);

    try {
      if (isFavoritesSession) {
        const res = await onRemoveFavourite();
        setFavFlash(res === "removed" ? "Removed!" : "Couldn't remove");
        return;
      }

      if (isFavourited) {
        setFavFlash("Already in your favourites");
        return;
      }

      const res = await onAddFavourite();
      if (res === "added") setFavFlash("Added to favourites");
      else if (res === "already") setFavFlash("Already in your favourites");
      else setFavFlash("Couldn't add");
    } finally {
      setFavBusy(false);
    }
  };

  return (
    <div className="pll-workspace mx-auto max-w-5xl xl:max-w-6xl space-y-2 px-4 sm:space-y-4 sm:px-6 md:space-y-5">
      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        reportCat={reportCat}
        setReportCat={setReportCat}
        reportNote={reportNote}
        setReportNote={setReportNote}
        reportBusy={reportBusy}
        reportThanks={reportThanks}
        onSubmit={submitReport}
        safeDeckId={safeDeckId}
        reportTarget={reportTarget}
        isActive={isActive}
      />

      <div className="space-y-1.5 sm:space-y-2">
        <div className="hidden text-sm text-neutral-500 sm:block lg:hidden">
          {isReview ? (
            <>
              Remaining: <b>{reviewRemaining}</b> • Mode: <b>{modeLabel}</b>
              {!isFavoritesSession ? (
                <>
                  {" "}
                  • Now: <b>{badge}</b>
                </>
              ) : null}
              {" "}
              • <b>{isActive ? "Active Learning review" : "Passive Learning review"}</b>
              {isFavoritesSession ? (
                <>
                  {" "}
                  • <b>Favourites</b>
                </>
              ) : null}
            </>
          ) : (
            <>
              Set: <b>{sessionPlanLabel}</b> • Mode: <b>{modeLabel}</b>
              {!isFavoritesSession ? (
                <>
                  {" "}
                  • Now: <b>{badge}</b>
                </>
              ) : null}
              {isActive ? (
                <>
                  {" "}
                  • <b>Active</b>
                </>
              ) : null}
            </>
          )}
        </div>

        <div className="practice-top-strip hidden lg:flex">
          <div className="practice-status-strip">
            {isReview ? (
              <>
                <span className="practice-status-chip">
                  Remaining <b>{reviewRemaining}</b>
                </span>
                <span className="practice-status-chip">
                  Mode <b>{modeLabel}</b>
                </span>
                {isFavoritesSession ? (
                  <span className="practice-status-chip">
                    Source <b>{sourceChipLabel}</b>
                  </span>
                ) : null}
              </>
            ) : (
              <span className="practice-status-chip">
                Mode <b>{modeLabel}</b>
              </span>
            )}
          </div>

          <div className="practice-desktop-icon-controls hidden flex-wrap items-center justify-end gap-2 lg:flex">
            <button
              type="button"
              onClick={onFavClick}
              disabled={favBusy}
              className={`practice-inline-control ${favVisualFilled ? "practice-inline-control--active" : ""}`}
              title={
                isFavoritesSession
                  ? "Remove from favourites · F"
                  : favVisualFilled
                    ? "Added to favourites · F"
                    : "Add to favourites · F"
              }
              aria-label={
                isFavoritesSession
                  ? "Remove from favourites (F)"
                  : favVisualFilled
                    ? "Added to favourites (F)"
                    : "Add to favourites (F)"
              }
            >
              <span aria-hidden="true" className="practice-inline-control__icon">
                {favVisualFilled ? "★" : "☆"}
              </span>
              <span className="practice-inline-control__text">{favLabel}</span>
              <span className="practice-inline-control__shortcut" aria-hidden="true">
                • F
              </span>
            </button>

            <button
              type="button"
              onClick={onTogglePlaybackRate}
              className="practice-icon-control practice-icon-control--speed"
              title={`Change speed · V (${playbackRateLabel})`}
              aria-label={`${speedAria} (V)`}
            >
              <span aria-hidden="true" className="practice-icon-control__speed-content">
                <span className="practice-icon-control__glyph">▶</span>
                <span className="practice-icon-control__speed-text">{playbackRateLabel}</span>
              </span>
              <span className="practice-icon-control__shortcut" aria-hidden="true">
                V
              </span>
            </button>

            <button
              type="button"
              onClick={onPlayAudio}
              className="practice-icon-control practice-icon-control--play"
              title="Play audio · A"
              aria-label="Play audio (A)"
            >
              <span aria-hidden="true" className="practice-icon-control__play-text">
                Play · A
              </span>
            </button>

            <button
              type="button"
              onClick={onToggleMute}
              className="practice-inline-control"
              title={`Audio on/off · M (${audioMuted ? "currently off" : "currently on"})`}
              aria-label={`Audio on/off (M), currently ${audioMuted ? "off" : "on"}`}
              aria-pressed={!audioMuted}
            >
              <span aria-hidden="true" className="practice-inline-control__icon">
                {audioMuted ? "🔇" : "🔊"}
              </span>
              <span className="practice-inline-control__text">{audioControlLabel}</span>
              <span className="practice-inline-control__shortcut" aria-hidden="true">
                • M
              </span>
            </button>

            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="practice-icon-control practice-icon-control--report"
              title="Report · R"
              aria-label="Report an issue (R)"
            >
              <span aria-hidden="true" className="practice-icon-control__glyph">
                ⚑
              </span>
              <span className="practice-icon-control__shortcut" aria-hidden="true">
                R
              </span>
            </button>
          </div>
        </div>

        <div className="text-[11px] leading-snug text-neutral-500 sm:hidden">
          {isReview ? (
            <>
              <b>{reviewRemaining}</b> left · {modeLabel}
              {!isFavoritesSession ? (
                <>
                  {" "}
                  · {badge}
                </>
              ) : null}
              {` · ${isActive ? "Active Learning review" : "Passive Learning review"}`}
              {isFavoritesSession ? " · Fav" : ""}
            </>
          ) : (
            <>
              <b>{sessionPlanLabel}</b> · {modeLabel}
              {!isFavoritesSession ? (
                <>
                  {" "}
                  · {badge}
                </>
              ) : null}
              {isActive ? " · Active" : ""}
            </>
          )}
        </div>

        <div ref={helpWrapRef} className="relative flex flex-wrap items-center justify-end gap-1 sm:hidden">
          <button
            type="button"
            onClick={onFavClick}
            disabled={favBusy}
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg shadow-sm active:scale-[0.98] disabled:opacity-50 ${
              favVisualFilled
                ? "border border-amber-500/50 bg-amber-500/15 text-amber-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-amber-500/25"
                : "border border-[var(--border-strong)] bg-[var(--surface-solid)] text-[var(--foreground-muted)] hover:border-[var(--border)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
            }`}
            title={isFavoritesSession ? "Remove from favourites (F)" : "Add to favourites (F)"}
            aria-label={isFavoritesSession ? "Remove from favourites" : "Add to favourites"}
          >
            <span aria-hidden="true">{favVisualFilled ? "★" : "☆"}</span>
          </button>
          <button
            type="button"
            onClick={onTogglePlaybackRate}
            className="inline-flex h-10 min-w-[2.75rem] shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-1.5 text-xs font-semibold tabular-nums text-[var(--foreground)] shadow-sm hover:bg-[var(--surface-muted)] active:scale-[0.98]"
            title="Toggle audio speed"
            aria-label={`Audio speed ${playbackRate.toFixed(1)} times`}
          >
            {playbackRateLabel.replace("x", "×")}
          </button>
          <button
            type="button"
            onClick={onPlayAudio}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] text-base text-[var(--foreground)] shadow-sm hover:bg-[var(--surface-muted)] active:scale-[0.98]"
            title={!hasAudio ? "Play audio (A)" : "Play audio (A)"}
            aria-label="Play audio"
          >
            <span aria-hidden="true">▶</span>
          </button>
          <button
            type="button"
            onClick={onToggleMute}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] text-base shadow-sm hover:bg-[var(--surface-muted)] active:scale-[0.98]"
            title={audioMuted ? "Unmute (M)" : "Mute (M)"}
            aria-label={audioMuted ? "Unmute" : "Mute"}
            aria-pressed={!audioMuted}
          >
            <span aria-hidden="true">{audioMuted ? "🔇" : "🔊"}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setHelpOpen(false);
              setReportOpen(true);
            }}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--report-soft-border)] bg-[var(--report-soft-bg)] text-base font-bold text-[var(--report-soft-text)] shadow-sm hover:opacity-95 active:scale-[0.98]"
            title="Report an issue (R)"
            aria-label="Report an issue"
          >
            <span aria-hidden="true">!</span>
          </button>
          <button
            type="button"
            onClick={() => setHelpOpen((o) => !o)}
            aria-expanded={helpOpen}
            aria-controls="pll-practice-toolbar-help"
            aria-label="Toolbar icons explained"
            title="What the toolbar does"
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-semibold italic leading-none shadow-sm active:scale-[0.98] ${
              helpOpen
                ? "border-[var(--border-strong)] bg-[var(--surface-muted)] text-[var(--foreground)]"
                : "border-[var(--border)] bg-[var(--surface-solid)] text-[var(--foreground-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
            }`}
          >
            i
          </button>
          {helpOpen ? (
            <div
              id="pll-practice-toolbar-help"
              role="region"
              aria-label="Toolbar icons"
              className="absolute right-0 top-[calc(100%+6px)] z-40 w-[min(17.5rem,calc(100vw-2rem))] rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2.5 text-left shadow-[0_8px_28px_rgba(0,0,0,0.28)]"
            >
              <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--foreground-muted)]">
                Toolbar
              </p>
              <ul className="mt-1.5 list-none space-y-1 text-[11px] leading-snug text-[var(--foreground)]">
                <li>Add to favourites</li>
                <li>Audio speed</li>
                <li>Play audio</li>
                <li>Audio on/off</li>
                <li className="text-[var(--report-soft-text)]">Report error</li>
              </ul>
              <p className="mt-2 border-t border-[var(--border)] pt-2 text-[10px] leading-snug text-[var(--foreground-muted)]">
                {isReview
                  ? revealed
                    ? `Bottom: ${reviewSecondaryLabel} · ${reviewPrimaryLabel}`
                    : "Bottom: Reveal"
                  : revealed
                    ? "Bottom: Still learning · Mastered"
                    : "Bottom: Reveal"}
              </p>
            </div>
          ) : null}
          {favFlash ? (
            <p
              className="pointer-events-none absolute right-0 top-[calc(100%+6px)] z-50 max-w-[min(100%,14rem)] rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-2.5 py-1 text-center text-[11px] font-semibold leading-tight text-[var(--foreground)] shadow-md"
              role="status"
              aria-live="polite"
            >
              <span
                className={
                  favFlash === "Added to favourites" || favFlash === "Removed!"
                    ? "text-amber-400"
                    : favFlash === "Couldn't add" || favFlash === "Couldn't remove"
                      ? "text-[var(--report-soft-text)]"
                      : "text-[var(--foreground-muted)]"
                }
              >
                {favFlash}
              </span>
            </p>
          ) : null}
        </div>

        {audioGateHint ? (
          <p
            role="status"
            aria-live="polite"
            className="text-center text-[11px] font-medium leading-tight text-[var(--foreground-muted)] sm:hidden"
          >
            {audioGateHint}
          </p>
        ) : null}

        <div className="practice-desktop-text-controls hidden flex-wrap items-stretch justify-start gap-2 sm:flex sm:justify-end">
          <button
            type="button"
            onClick={onFavClick}
            disabled={favBusy}
            className={`practice-inline-control ${favVisualFilled ? "practice-inline-control--active" : ""}`}
            title={isFavoritesSession ? "Remove from favourites (F)" : "Add to favourites (F)"}
          >
            <span
              aria-hidden="true"
              className="practice-inline-control__icon"
            >
              {favVisualFilled ? "★" : "☆"}
            </span>
            <span className="practice-inline-control__text">{favLabel}</span>
            <span className="practice-inline-control__shortcut">• F</span>
          </button>

          <button
            type="button"
            onClick={onTogglePlaybackRate}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs hover:bg-neutral-50"
            title="Toggle audio speed"
          >
            {playbackRateLabel} <span className="text-neutral-400">• V</span>
          </button>

          <button
            type="button"
            onClick={onPlayAudio}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs hover:bg-neutral-50"
            title={!hasAudio ? "Try play audio (A)" : "Play audio (A)"}
          >
            {audioMuted ? "Unmute + Play" : "Play"} <span className="text-neutral-400">• A</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            className="practice-inline-control"
            title="Mute/unmute (M)"
            aria-pressed={!audioMuted}
          >
            <span aria-hidden="true" className="practice-inline-control__icon">
              {audioMuted ? "🔇" : "🔊"}
            </span>
            <span className="practice-inline-control__text">{audioControlLabel}</span>
            <span className="practice-inline-control__shortcut">• M</span>
          </button>

          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100"
            title="Report an issue (R)"
          >
            Report <span className="text-rose-400">• R</span>
          </button>
        </div>

        {audioGateHint ? (
          <p
            role="status"
            aria-live="polite"
            className="hidden text-center text-[11px] font-medium leading-tight text-[var(--foreground-muted)] sm:block"
          >
            {audioGateHint}
          </p>
        ) : null}
      </div>

      <Card className="practice-shell border-neutral-200">
        <CardContent className="space-y-4 px-4 pb-6 pt-3 sm:space-y-5 sm:px-6 sm:pt-0 lg:px-7 lg:pb-7">
          <div
            className="practice-prompt-card max-sm:mb-2 rounded-2xl border border-neutral-200 bg-white px-4 py-6 sm:px-8 sm:py-10 lg:px-10 lg:py-12"
          >
            <div className="text-center text-[1.65rem] font-semibold leading-tight tracking-tight sm:text-[2.25rem]">
              {prompt}
            </div>

            {revealed ? (
              <div className="learning-translation practice-translation-field mt-6 rounded-xl border border-neutral-200 bg-neutral-50 px-5 py-5 text-center text-lg">
                {answer}
              </div>
            ) : null}
          </div>

          {debugAudio && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              debugAudio: stage={debugAudioStage ?? "null"} | hasAudio={String(hasAudio)} | urlExists=
              {String(debugAudioHasUrl)}
            </div>
          )}

          {isReview ? (
            <>
              {/* Review actions: in-flow on sm+ (no Back — use header / browser to leave) */}
              {!revealed ? (
                <div className="hidden gap-2 sm:flex sm:flex-row sm:flex-wrap">
                  <Button onClick={onRevealOrNext} disabled={busy} className="practice-reveal-button practice-decision-button w-full sm:w-auto" variant="secondary">
                    Reveal translation <span className="practice-shortcut-hint">0 / 1</span>
                  </Button>
                </div>
              ) : (
                <div className="hidden gap-2 sm:flex sm:flex-row sm:flex-wrap">
                  <Button onClick={onReviewHard} disabled={busy} className="practice-decision-button practice-choice-secondary w-full sm:w-auto" variant="secondary">
                    {reviewSecondaryLabel} <span className="practice-shortcut-hint">0</span>
                  </Button>
                  <Button onClick={onReviewEasy} disabled={busy} className="practice-decision-button practice-choice-primary w-full sm:w-auto">
                    {reviewPrimaryLabel} <span className="practice-shortcut-hint">1</span>
                  </Button>
                </div>
              )}

              {/* Review actions: fixed bottom bar on mobile only (matches learn) */}
              <div
                className="fixed inset-x-0 bottom-0 z-30 sm:hidden"
                role="region"
                aria-label="Practice answer"
              >
                <div
                  className="border-t border-[var(--border)] bg-[var(--surface-solid)] px-4 pt-3 shadow-[0_-6px_24px_rgba(15,23,42,0.1)]"
                  style={{
                    paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
                  }}
                >
                  {!revealed ? (
                    <Button
                      type="button"
                      onClick={onRevealOrNext}
                      disabled={busy}
                      variant="secondary"
                      size="lg"
                      className="h-12 w-full text-base font-semibold"
                    >
                      Reveal translation
                    </Button>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        onClick={onReviewHard}
                        disabled={busy}
                        variant="secondary"
                        size="lg"
                        className="h-12 w-full text-base font-semibold"
                      >
                        {reviewSecondaryLabel}
                      </Button>
                      <Button
                        type="button"
                        onClick={onReviewEasy}
                        disabled={busy}
                        size="lg"
                        className="h-12 w-full text-base font-semibold"
                      >
                        {reviewPrimaryLabel}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Learn actions: in-flow on sm+ (desktop / tablet unchanged) */}
              <div className="hidden gap-2 sm:flex sm:flex-row sm:flex-wrap">
                <Button onClick={onRevealOrNext} disabled={busy} className="practice-reveal-button practice-decision-button practice-choice-secondary w-full sm:w-auto" variant="secondary">
                  {revealed ? "Still learning" : "Reveal translation"} <span className="practice-shortcut-hint">0 / S</span>
                </Button>

                {revealed ? (
                  <Button onClick={onMastered} disabled={busy} className="practice-decision-button practice-choice-primary w-full sm:w-auto">
                    {busy ? "Saving..." : "Mastered"} <span className="practice-shortcut-hint">1 / D</span>
                  </Button>
                ) : null}
              </div>

              {/* Learn actions: fixed bottom bar on mobile only */}
              <div
                className="fixed inset-x-0 bottom-0 z-30 sm:hidden"
                role="region"
                aria-label="Practice answer"
              >
                <div
                  className="border-t border-[var(--border)] bg-[var(--surface-solid)] px-4 pt-3 shadow-[0_-6px_24px_rgba(15,23,42,0.1)]"
                  style={{
                    paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
                  }}
                >
                  {!revealed ? (
                    <Button
                      type="button"
                      onClick={onRevealOrNext}
                      disabled={busy}
                      variant="secondary"
                      size="lg"
                      className="h-12 w-full text-base font-semibold"
                    >
                      Reveal translation
                    </Button>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        onClick={onRevealOrNext}
                        disabled={busy}
                        variant="secondary"
                        size="lg"
                        className="h-12 w-full text-base font-semibold"
                      >
                        Still learning
                      </Button>
                      <Button
                        type="button"
                        onClick={onMastered}
                        disabled={busy}
                        size="lg"
                        className="h-12 w-full text-base font-semibold"
                      >
                        {busy ? "Saving..." : "Mastered"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          <details className="preview-shortcuts hidden sm:block">
            <summary className="preview-shortcuts__summary">
              Keyboard shortcuts
            </summary>
            <div className="preview-shortcuts__list">
              {isReview ? (
                !revealed ? (
                  <div className="preview-shortcuts__item">
                    <b>0</b> / <b>1</b> — Reveal translation
                  </div>
                ) : (
                  <>
                    <div className="preview-shortcuts__item">
                      <b>0</b> — {reviewSecondaryLabel}
                    </div>
                    <div className="preview-shortcuts__item">
                      <b>1</b> — {reviewPrimaryLabel}
                    </div>
                  </>
                )
              ) : (
                <>
                  <div className="preview-shortcuts__item">
                    <b>0 / S</b> — {revealed ? "Still learning" : "Reveal translation"}
                  </div>
                  <div className="preview-shortcuts__item">
                    <b>1 / D</b> — Mastered
                  </div>
                </>
              )}
              <div className="preview-shortcuts__item">
                <b>V</b> — Change speed
              </div>
              <div className="preview-shortcuts__item">
                <b>A</b> — Play audio
              </div>
              <div className="preview-shortcuts__item">
                <b>M</b> — Toggle audio
              </div>
              <div className="preview-shortcuts__item">
                <b>F</b> — {isFavoritesSession ? "Remove from favourites" : "Add to favourites"}
              </div>
              <div className="preview-shortcuts__item">
                <b>R</b> — Report
              </div>
            </div>
          </details>

          {/* In-flow reserve: fixed bottom bar (learn + review) + gap so card never sits under the bar */}
          <div
            className="block shrink-0 sm:hidden"
            aria-hidden="true"
            style={{
              minHeight:
                "calc(0.75rem + 3rem + max(0.75rem, env(safe-area-inset-bottom, 0px)) + 1.25rem)",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
