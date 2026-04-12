"use client";

import type { UiCategory, PairRow, Stage } from "../lib/types";

type Props = {
  open: boolean;
  onClose(): void;

  reportCat: UiCategory;
  setReportCat(v: UiCategory): void;

  reportNote: string;
  setReportNote(v: string): void;

  reportBusy: boolean;
  reportThanks: boolean;

  onSubmit(): void;

  safeDeckId: string;

  // ✅ ADD THESE:
  reportTarget: { pair: PairRow | null; stage: Stage };
  isActive: boolean;
};

export default function ReportModal({
  open,
  onClose,
  reportCat,
  setReportCat,
  reportNote,
  setReportNote,
  reportBusy,
  reportThanks,
  onSubmit,
  safeDeckId,
  reportTarget,
  isActive,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <button className="absolute inset-0 bg-black/30" onClick={onClose} aria-label="Close" />

      <div className="relative max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-neutral-900">Report</div>
            <div className="mt-1 text-xs text-neutral-500">Report any issue (translation, audio, etc.).</div>
          </div>

          <button
            className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs hover:bg-neutral-50"
            onClick={onClose}
            type="button"
          >
            Esc
          </button>
        </div>

        <div className="mt-4 space-y-3 text-sm">
                      {/* ✅ What the user is reporting */}
          {reportTarget?.pair ? (() => {
            const pair = reportTarget.pair;
            const stage = reportTarget.stage;

            const left =
              stage === "word"
                ? (isActive ? pair.word_native : pair.word_target)
                : (isActive ? (pair.sentence_native ?? "") : (pair.sentence_target ?? ""));

            const right =
              stage === "word"
                ? (isActive ? pair.word_target : pair.word_native)
                : (isActive ? (pair.sentence_target ?? "") : (pair.sentence_native ?? ""));

            return (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
                  Reporting ({stage === "word" ? "Word" : "Sentence"})
                </div>
                <div className="mt-1 text-sm text-neutral-900">
                  <span className="font-medium">{left}</span>
                  {right ? <span className="text-neutral-500"> → </span> : null}
                  {right ? <span>{right}</span> : null}
                </div>
              </div>
            );
          })() : null}

          <div>
            <div className="text-xs text-neutral-500 mb-1">Category</div>
            <select
              value={reportCat}
              onChange={(e) => setReportCat(e.target.value as UiCategory)}
              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400"
            >
              <option>Sentence</option>
              <option>Translation</option>
              <option>Pronunciation/Audio</option>
              <option>Other</option>
            </select>
          </div>

          <div>
            <div className="text-xs text-neutral-500 mb-1">Feedback (optional)</div>
            <textarea
              value={reportNote}
              onChange={(e) => setReportNote(e.target.value.slice(0, 300))}
              rows={3}
              className="w-full rounded-xl border border-neutral-200 bg-white p-3 text-sm outline-none focus:border-neutral-400"
              placeholder="Optional note…"
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              className="text-xs text-neutral-500 underline hover:text-neutral-700"
              onClick={onClose}
              disabled={reportBusy}
              type="button"
            >
              Cancel
            </button>

            <button
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-60"
              onClick={onSubmit}
              disabled={reportBusy || !safeDeckId}
              type="button"
            >
              {reportThanks ? "Thanks!" : reportBusy ? "Submitting..." : "Submit"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
