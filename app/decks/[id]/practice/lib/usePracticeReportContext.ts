"use client";

import { useCallback } from "react";
import type { PairRow, LearnMode, Stage } from "./types";

type ReportApi = {
  openReport: (pair: PairRow | null, stage: Stage) => void;
};

type Args = {
  mode: LearnMode;
  viewMode: "preview" | "practice";

  // practice context
  currentPair: PairRow | null;
  currentStage: Stage | null;

  // preview context
  previewWords: PairRow[];
  selectedPreviewId: string | null;
  sessionPairs: PairRow[];

  report: ReportApi;
};

export function usePracticeReportContext({
  mode,
  viewMode,
  currentPair,
  currentStage,
  previewWords,
  selectedPreviewId,
  sessionPairs,
  report,
}: Args) {
  const getPreviewReportPair = useCallback((): PairRow | null => {
    // report from preview only makes sense in word mode (as per your spec)
    if (mode !== "words") return null;

    const bySelected = selectedPreviewId
      ? previewWords.find((x) => x.id === selectedPreviewId) ?? null
      : null;

    return bySelected ?? previewWords[0] ?? sessionPairs[0] ?? null;
  }, [mode, selectedPreviewId, previewWords, sessionPairs]);

  const openReportFromContext = useCallback(() => {
    if (viewMode === "preview") {
      report.openReport(getPreviewReportPair(), "word");
      return;
    }

    report.openReport(currentPair, (currentStage ?? "word") as Stage);
  }, [viewMode, report, getPreviewReportPair, currentPair, currentStage]);

  return { openReportFromContext };
}
