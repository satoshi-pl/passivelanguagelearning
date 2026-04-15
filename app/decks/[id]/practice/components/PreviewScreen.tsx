"use client";

import React, { useMemo } from "react";
import type { PairRow, LearnMode, Stage, UiCategory } from "../lib/types";
import ReportModal from "./ReportModal";

type ReportTarget = { pair: PairRow | null; stage: Stage };

type Props = {
  deckName: string;
  finishHref: string;

  mode: LearnMode;
  isReview: boolean;
  isActive: boolean;

  targetLang: string;
  nativeLang: string;

  sessionPairs: PairRow[];
  previewWords: PairRow[];

  showTranslations: boolean;
  setShowTranslations: (v: boolean) => void;

  selectedPreviewId: string | null;
  setSelectedPreviewId: (id: string | null) => void;

  playingPreviewId: string | null;
  setPlayingPreviewId: (id: string | null) => void;

  playAllBusy: boolean;
  sessionPlanLabel: string;
  noLimitPreviewHint?: boolean;

  resolveAudioUrl: (raw?: string | null) => string;

  playbackRate: number;
  onTogglePlaybackRate: () => void;

  playAllPreviewWords: (rows: PairRow[]) => void;
  onRowPlay: (p: PairRow) => void;

  startPractice: () => void;

  reportOpen: boolean;
  setReportOpen: (v: boolean) => void;
  reportCat: UiCategory;
  setReportCat(v: UiCategory): void;
  reportNote: string;
  setReportNote: (v: string) => void;
  reportBusy: boolean;
  reportThanks: boolean;
  submitReport: () => void;
  safeDeckId: string;
  reportTarget: ReportTarget;
  onOpenReport: () => void;
};

type PreviewLikeRow = PairRow & {
  word_target?: string | null;
  word_target_text?: string | null;
  word_target_value?: string | null;
  word_target_raw?: string | null;
  word_target_word?: string | null;
  word_native?: string | null;
  word_native_text?: string | null;
  word_native_value?: string | null;
  word_native_raw?: string | null;
  word_native_word?: string | null;
  translation?: string | null;
  word_target_audio_url?: string | null;
};

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

function getWordTarget(p: PreviewLikeRow) {
  return (
    p.word_target ??
    p.word_target_text ??
    p.word_target_value ??
    p.word_target_raw ??
    p.word_target_word ??
    ""
  );
}

function getWordNative(p: PreviewLikeRow) {
  return (
    p.word_native ??
    p.word_native_text ??
    p.word_native_value ??
    p.word_native_raw ??
    p.word_native_word ??
    p.translation ??
    ""
  );
}

function getPreviewAudioRaw(p: PreviewLikeRow) {
  return p.word_target_audio_url ?? p.sentence_target_audio_url ?? null;
}

export default function PreviewScreen(props: Props) {
  const {
    mode,
    isActive,
    targetLang,
    nativeLang,
    previewWords,
    showTranslations,
    setShowTranslations,
    selectedPreviewId,
    setSelectedPreviewId,
    playingPreviewId,
    playAllBusy,
    sessionPlanLabel,
    noLimitPreviewHint = false,
    resolveAudioUrl,
    playbackRate,
    onTogglePlaybackRate,
    playAllPreviewWords,
    onRowPlay,
    startPractice,
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
  } = props;

  const targetLangLabel = langName(targetLang);
  const nativeLangLabel = langName(nativeLang);

  const previewLeftHeader = isActive ? nativeLangLabel : targetLangLabel;
  const previewRightHeader = isActive ? targetLangLabel : nativeLangLabel;
  const previewDirectionLabel = `${previewLeftHeader} → ${previewRightHeader}`;

  const showWordsTable = mode === "words" || (mode === "ws" && (previewWords?.length ?? 0) > 0);

  const plannedCountLabel = useMemo(() => {
    const n = previewWords?.length ?? 0;

    if (mode === "ws") {
      if (n === 0) return "Planned: Sentences only";
      return `Planned: Words: ${n} • Then sentences`;
    }

    if (mode === "words") return `Planned: Words: ${n}`;

    return sessionPlanLabel || "";
  }, [mode, previewWords?.length, sessionPlanLabel]);
  const playbackRateLabel = `${playbackRate.toFixed(1)}x`;

  return (
    <>
      <div className="pll-workspace mx-auto max-w-5xl xl:max-w-6xl px-4 pt-1 pb-4 sm:px-6 sm:pt-4 sm:pb-6 md:py-6">
        <div className="preview-shell rounded-2xl border border-black/5 bg-white/80 p-4 shadow-sm backdrop-blur sm:p-6 lg:p-7">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="md:hidden text-sm opacity-70">{plannedCountLabel}</div>
              <div className="preview-meta-strip hidden md:flex">
                <span className="preview-meta-chip">{plannedCountLabel}</span>
              </div>
              {noLimitPreviewHint ? (
                <div className="md:hidden mt-1 text-xs opacity-60">Preview: first 5 items</div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-stretch gap-2 lg:justify-end">
              {showWordsTable && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowTranslations(!showTranslations)}
                    className="preview-control-button preview-control-button--text min-h-11 rounded-xl border border-black/10 px-3 py-2 text-sm hover:bg-black/5"
                    title={
                      showTranslations
                        ? "Hide translation (H)"
                        : "Show translation (S)"
                    }
                  >
                    <span className="md:hidden">{showTranslations ? "Hide translation" : "Show translation"}</span>
                    <span className="preview-control-inline hidden md:inline">
                      <span aria-hidden="true" className="preview-control-inline__icon">
                        {showTranslations ? "🙈" : "👁"}
                      </span>
                      <span>{showTranslations ? "Hide translation" : "Show translation"}</span>
                      <span className="preview-control-shortcut"> • {showTranslations ? "H" : "S"}</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={onTogglePlaybackRate}
                    className="preview-control-button preview-control-button--speed min-h-11 rounded-xl border border-black/10 px-3 py-2 text-sm hover:bg-black/5"
                    title="Change speed (V)"
                  >
                    <span className="md:hidden">{playbackRateLabel}</span>
                    <span className="preview-control-speed-text hidden md:inline">
                      {playbackRateLabel}
                      <span className="preview-control-shortcut"> • V</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      playAllPreviewWords(previewWords);
                    }}
                    disabled={playAllBusy || previewWords.length === 0}
                    className="preview-control-button preview-control-button--playall min-h-11 rounded-xl border border-black/10 px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50"
                    title="Play all (A)"
                  >
                    <span className="md:hidden">{playAllBusy ? "Playing..." : "Play all"}</span>
                    <span className="preview-control-inline hidden md:inline">
                      <span aria-hidden="true" className="preview-control-inline__icon">▶</span>
                      <span>{playAllBusy ? "Playing..." : "Play all"}</span>
                      <span className="preview-control-shortcut"> • A</span>
                    </span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={startPractice}
                className="min-h-11 rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-black/90"
                title="Start practice (Enter)"
              >
                <span className="md:hidden">Start practice</span>
                <span className="hidden md:inline">
                  Start practice
                  <span className="preview-control-shortcut preview-control-shortcut--on-dark"> • Enter</span>
                </span>
              </button>
            </div>
          </div>

          {showWordsTable && (
            <div className="mt-5">
              {isActive && (
                <div className="learning-support-text mb-3 text-sm opacity-75 md:hidden">
                  Active direction: {previewDirectionLabel}
                </div>
              )}

              <WordsPreviewTable
                rows={previewWords}
                isActive={isActive}
                showTranslations={showTranslations}
                selectedPreviewId={selectedPreviewId}
                playingPreviewId={playingPreviewId}
                resolveAudioUrl={resolveAudioUrl}
                leftHeader={previewLeftHeader}
                rightHeader={previewRightHeader}
                onSelect={(p) => setSelectedPreviewId(p.id)}
                onPlay={onRowPlay}
              />
            </div>
          )}

          <details className="preview-shortcuts mt-4 hidden md:block">
            <summary className="preview-shortcuts__summary">
              Keyboard shortcuts
            </summary>
            <div className="preview-shortcuts__list">
              <div className="preview-shortcuts__item">
                <b>Enter</b> — Start practice
              </div>
              <div className="preview-shortcuts__item">
                <b>A</b> — Play all
              </div>
              <div className="preview-shortcuts__item">
                <b>H</b> — Hide translation
              </div>
              <div className="preview-shortcuts__item">
                <b>S</b> — Show translation
              </div>
              <div className="preview-shortcuts__item">
                <b>V</b> — Change speed
              </div>
              <div className="preview-shortcuts__item">
                <b>R</b> — Report
              </div>
            </div>
          </details>
        </div>
      </div>

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
    </>
  );
}

function WordsPreviewTable({
  rows,
  isActive,
  showTranslations,
  selectedPreviewId,
  playingPreviewId,
  resolveAudioUrl,
  leftHeader,
  rightHeader,
  onSelect,
  onPlay,
}: {
  rows: PairRow[];
  isActive: boolean;
  showTranslations: boolean;
  selectedPreviewId: string | null;
  playingPreviewId: string | null;
  resolveAudioUrl: (raw?: string | null) => string;
  leftHeader: string;
  rightHeader: string;
  onSelect: (p: PairRow) => void;
  onPlay: (p: PairRow) => void;
}) {
  return (
    <>
      <div className="preview-mobile-list space-y-3 md:hidden">
        {rows.map((p) => {
          const row = p as PreviewLikeRow;
          const isSelected = selectedPreviewId === p.id;
          const isPlaying = playingPreviewId === p.id;
          const target = getWordTarget(row);
          const native = getWordNative(row);
          const leftValue = isActive ? native : target;
          const rightValue = isActive ? target : native;
          const url = resolveAudioUrl(getPreviewAudioRaw(row));
          const hasAudio = !!url;

          return (
            <div
              key={p.id}
              onClick={() => onSelect(p)}
              className={[
                "preview-mobile-card rounded-2xl border border-black/10 p-4",
                isSelected ? "preview-mobile-card--selected" : "preview-mobile-card--base",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="break-words text-base font-semibold">{leftValue || "—"}</div>

                  {showTranslations ? (
                    <>
                      <div className="learning-translation mt-3 break-words text-sm opacity-80">{rightValue || "—"}</div>
                    </>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlay(p);
                  }}
                  disabled={!hasAudio}
                  className={[
                    "min-h-11 min-w-11 rounded-xl px-3 py-2 text-xs font-semibold",
                    hasAudio ? "bg-black text-white hover:bg-black/90" : "bg-black/10 text-black/40",
                  ].join(" ")}
                  title={hasAudio ? "Play" : "No audio"}
                >
                  {isPlaying ? "..." : "▶"}
                </button>
              </div>
            </div>
          );
        })}

        {rows.length === 0 && (
          <div className="preview-mobile-empty preview-mobile-empty--base rounded-2xl border border-black/10 px-4 py-6 text-sm opacity-60">No items in this set.</div>
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-black/10 md:block">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="preview-table-head">
            <tr>
              <th className="w-[52%] px-4 py-3 text-left font-semibold">{leftHeader}</th>
              <th className="w-[40%] px-4 py-3 text-left font-semibold">{showTranslations ? rightHeader : ""}</th>
              <th className="w-[8%] px-4 py-3 text-right font-semibold">Audio</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const row = p as PreviewLikeRow;
              const isSelected = selectedPreviewId === p.id;
              const isPlaying = playingPreviewId === p.id;

              const target = getWordTarget(row);
              const native = getWordNative(row);
              const leftValue = isActive ? native : target;
              const rightValue = isActive ? target : native;

              const url = resolveAudioUrl(getPreviewAudioRaw(row));
              const hasAudio = !!url;

              return (
                <tr
                  key={p.id}
                  onClick={() => onSelect(p)}
                  className={[
                    "cursor-pointer border-t border-black/5",
                    isSelected ? "bg-black/5" : "hover:bg-black/3",
                  ].join(" ")}
                >
                  <td className="px-4 py-3">
                    <div className="preview-table-word font-semibold">{leftValue || "—"}</div>
                  </td>

                  <td className="px-4 py-3">
                    {showTranslations ? <div className="learning-translation opacity-80">{rightValue || "—"}</div> : null}
                  </td>

                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlay(p);
                      }}
                      disabled={!hasAudio}
                      className={[
                        "inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold",
                        hasAudio ? "bg-black text-white hover:bg-black/90" : "bg-black/10 text-black/40",
                      ].join(" ")}
                      title={hasAudio ? "Play" : "No audio"}
                    >
                      {isPlaying ? "..." : "▶"}
                    </button>
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td className="px-4 py-6 opacity-60" colSpan={3}>
                  No items in this set.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
