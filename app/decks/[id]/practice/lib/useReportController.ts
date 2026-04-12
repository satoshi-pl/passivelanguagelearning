"use client";

import { useCallback, useState } from "react";
import type { PairRow, Stage, UiCategory, LearnMode } from "./types";
import { uiCategoryToIssueType } from "./report";

export type ReportTarget = { pair: PairRow | null; stage: Stage };

type Args = {
  safeDeckId: string;
  mode: LearnMode;
};

export function useReportController({ safeDeckId, mode }: Args) {
  const [reportOpen, setReportOpen] = useState(false);
  const [reportCat, setReportCat] = useState<UiCategory>("Translation");
  const [reportNote, setReportNote] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportThanks, setReportThanks] = useState(false);

  const [reportTarget, setReportTarget] = useState<ReportTarget>({
    pair: null,
    stage: "word",
  });

  const openReport = useCallback((pair: PairRow | null, stage: Stage) => {
    if (!pair) return;
    setReportTarget({ pair, stage });
    setReportCat("Translation");
    setReportNote("");
    setReportThanks(false);
    setReportOpen(true);
  }, []);

  const closeReport = useCallback(() => setReportOpen(false), []);

  const submitReport = useCallback(async () => {
    if (!safeDeckId) return;
    if (!reportTarget.pair) return;
    if (reportBusy) return;

    const pair = reportTarget.pair;
    const stage = reportTarget.stage;

    const promptText = stage === "word" ? pair.word_target : pair.sentence_target || "";
    const answerText = stage === "word" ? pair.word_native : pair.sentence_native || "";
    const audioRaw = stage === "word" ? pair.word_target_audio_url : pair.sentence_target_audio_url;

    const issueType = uiCategoryToIssueType(reportCat);

    setReportBusy(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deckId: safeDeckId,
          pairId: pair.id,
          mode,
          stage,
          issueType,
          note: reportNote.trim(),
          promptText,
          answerText,
          audioRaw: audioRaw ?? null,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("report error:", json?.error || res.statusText);
        return;
      }

      setReportThanks(true);
      setTimeout(() => setReportOpen(false), 650);
    } finally {
      setReportBusy(false);
    }
  }, [safeDeckId, mode, reportTarget, reportCat, reportNote, reportBusy]);

  return {
    // state
    reportOpen,
    setReportOpen,
    reportCat,
    setReportCat,
    reportNote,
    setReportNote,
    reportBusy,
    reportThanks,
    reportTarget,

    // actions
    openReport,
    closeReport,
    submitReport,
  };
}
