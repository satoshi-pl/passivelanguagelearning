"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Mode = "words" | "ws" | "sentences";

type Progress = {
  total: number;
  mastered: number;
  pct: number;
};

type CategoryOption = {
  value: string;
  label: string;
};

type CategoryProgressEntry = {
  words: Progress;
  sentences: Progress;
};

type Props = {
  deckId: string;
  mode: Mode;
  backToDecksHref: string;
  initialSelectedCategory: string | null;
  categoryOptionsByMode: Record<Mode, CategoryOption[]>;
  overallWordsProgress: Progress;
  overallSentencesProgress: Progress;
  categoryProgressByValue: Record<string, CategoryProgressEntry>;
  pendingTotalsByMode: Record<Mode, number>;
};

function ProgressBar({ label, pr }: { label: string; pr: Progress }) {
  return (
    <div className="entry-progress-row">
      <span className="entry-progress-row__label">{label}</span>
      <div className="entry-progress-row__track-wrap">
        <div className="entry-progress-row__track">
          <div className="entry-progress-row__fill" style={{ width: `${pr.pct}%` }} />
        </div>
      </div>
      <span className="entry-progress-row__stats">
        {pr.mastered}/{pr.total} · <b>{pr.pct}%</b>
      </span>
    </div>
  );
}

export default function ActiveDeckControls({
  deckId,
  mode,
  backToDecksHref,
  initialSelectedCategory,
  categoryOptionsByMode,
  overallWordsProgress,
  overallSentencesProgress,
  categoryProgressByValue,
  pendingTotalsByMode,
}: Props) {
  const storageKey = `pll:deck:${deckId}:active-category`;
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialSelectedCategory);

  const currentCategoryOptions = useMemo(() => categoryOptionsByMode[mode] ?? [], [categoryOptionsByMode, mode]);
  const currentModePending = pendingTotalsByMode[mode] ?? 0;

  const sessionSizes = [
    { value: 5, label: "Active 5" },
    { value: 10, label: "Active 10" },
    { value: 15, label: "Active 15" },
    { value: 0, label: "No limit" },
  ];

  const buildActivePageHref = useCallback((nextMode: Mode, nextCategory: string | null) => {
    const qs = new URLSearchParams();
    qs.set("mode", nextMode);
    qs.set("back", backToDecksHref);

    if (nextCategory) {
      qs.set("category", nextCategory);
    }

    return `/decks/${deckId}/active?${qs.toString()}`;
  }, [backToDecksHref, deckId]);

  const buildDashboardBackHref = (nextMode: Mode, nextCategory: string | null) => {
    return buildActivePageHref(nextMode, nextCategory);
  };

  const buildPracticeHref = (n: number) => {
    const qs = new URLSearchParams();
    qs.set("n", String(n));
    qs.set("o", "0");
    qs.set("mode", mode);
    qs.set("dir", "active");
    qs.set("source", "learn");
    qs.set("back", buildDashboardBackHref(mode, selectedCategory));

    if (selectedCategory) {
      qs.set("category", selectedCategory);
    }

    return `/decks/${deckId}/practice?${qs.toString()}`;
  };

  const buildReviewHref = () => {
    const qs = new URLSearchParams();
    qs.set("mode", mode);
    qs.set("back", buildDashboardBackHref(mode, selectedCategory));
    return `/decks/${deckId}/active/review?${qs.toString()}`;
  };

  useEffect(() => {
    setSelectedCategory(initialSelectedCategory);
  }, [initialSelectedCategory]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const saved = (window.sessionStorage.getItem(storageKey) || "").trim();
      if (!saved) return;

      const isValid = currentCategoryOptions.some((c) => c.value === saved);
      if (!isValid) return;

      if (!initialSelectedCategory) {
        setSelectedCategory(saved);

        const nextUrl = buildActivePageHref(mode, saved);
        window.history.replaceState(window.history.state, "", nextUrl);
      }
    } catch {
      // ignore storage errors
    }
  }, [storageKey, currentCategoryOptions, initialSelectedCategory, mode, buildActivePageHref]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      if (selectedCategory) {
        window.sessionStorage.setItem(storageKey, selectedCategory);
      } else {
        window.sessionStorage.removeItem(storageKey);
      }
    } catch {
      // ignore storage errors
    }
  }, [selectedCategory, storageKey]);

  useEffect(() => {
    if (!selectedCategory) return;

    const stillValid = currentCategoryOptions.some((c) => c.value === selectedCategory);
    if (stillValid) return;

    setSelectedCategory(null);

    if (typeof window !== "undefined") {
      const nextUrl = buildActivePageHref(mode, null);
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  }, [selectedCategory, currentCategoryOptions, mode, buildActivePageHref]);

  const selectedProgress = useMemo(() => {
    if (!selectedCategory) return null;
    return categoryProgressByValue[selectedCategory] ?? null;
  }, [selectedCategory, categoryProgressByValue]);

  const prWords = selectedProgress?.words ?? overallWordsProgress;
  const prSentences = selectedProgress?.sentences ?? overallSentencesProgress;

  const modeButtonStyle = (active: boolean) =>
    ({
      display: "inline-block",
      padding: "10px 12px",
      borderRadius: 12,
      border: active ? "1px solid var(--foreground)" : "1px solid var(--border)",
      background: active ? "var(--foreground)" : "var(--surface-solid)",
      color: active ? "var(--surface-solid)" : "var(--foreground)",
      textDecoration: "none",
      fontWeight: 800,
      width: "100%",
      flex: "1 1 0",
      minWidth: 0,
      textAlign: "center",
      boxShadow: active ? "none" : "0 1px 0 rgba(0,0,0,0.02)",
    }) as const;

  const secondaryActionStyle = {
    display: "inline-block",
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid var(--border-strong)",
    background: "var(--surface-solid)",
    textDecoration: "none",
    color: "var(--foreground)",
    fontWeight: 700,
    width: "100%",
    flex: "1 1 0",
    minWidth: 0,
    textAlign: "center",
    boxShadow: "0 1px 0 rgba(0,0,0,0.03)",
  } as const;

  const learnButtonStyle = {
    display: "inline-block",
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--surface-solid)",
    textDecoration: "none",
    color: "var(--foreground)",
    fontWeight: 700,
    width: "100%",
    flex: "1 1 0",
    minWidth: 0,
    textAlign: "center",
    boxShadow: "0 1px 0 rgba(0,0,0,0.02)",
  } as const;

  return (
    <div className="entry-controls-shell">
      <div style={{ marginTop: 20 }}>
        <div className="deck-mode-row" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link
            className="deck-mode-button"
            href={buildActivePageHref("words", selectedCategory)}
            style={modeButtonStyle(mode === "words")}
          >
            Words only
          </Link>
          <Link
            className="deck-mode-button"
            href={buildActivePageHref("ws", selectedCategory)}
            style={modeButtonStyle(mode === "ws")}
          >
            Words + Sentences
          </Link>
          <Link
            className="deck-mode-button"
            href={buildActivePageHref("sentences", selectedCategory)}
            style={modeButtonStyle(mode === "sentences")}
          >
            Sentences only
          </Link>
        </div>
      </div>

      {currentCategoryOptions.length > 0 && (
        <div className="entry-category-row" style={{ marginTop: 16 }}>
          <div className="entry-category-label">Category</div>

          <select
            className="deck-category-select entry-category-select"
            value={selectedCategory ?? ""}
            onChange={(e) => {
              const nextValue = e.currentTarget.value.trim() || null;
              setSelectedCategory(nextValue);

              if (typeof window !== "undefined") {
                const nextUrl = buildActivePageHref(mode, nextValue);
                window.history.replaceState(window.history.state, "", nextUrl);
              }
            }}
            style={{
              width: "100%",
              maxWidth: 420,
              minWidth: 0,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--surface-solid)",
              color: "var(--foreground)",
              fontWeight: 600,
            }}
          >
            <option value="">All</option>
            {currentCategoryOptions.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <ProgressBar label="Words" pr={prWords} />
        <ProgressBar label="Sentences" pr={prSentences} />
      </div>

      <div className="deck-actions-group">
        {currentModePending > 0 ? (
          <div
            className="deck-action-row deck-learn-row"
            style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}
          >
            {sessionSizes.map((size) => (
              <Link
                key={size.label}
                href={buildPracticeHref(size.value)}
                style={learnButtonStyle}
                className="deck-action-button deck-action-button--primary deck-learn-button"
              >
                {size.label}
              </Link>
            ))}
          </div>
        ) : (
          <div style={{ marginTop: 14, fontSize: 12, color: "var(--foreground-muted)" }}>
            {mode === "words"
              ? "No pending active words right now."
              : mode === "sentences"
                ? "No pending active sentences right now."
                : "No pending active items right now."}
          </div>
        )}

        <div className="deck-optional-section" style={{ marginTop: 18 }}>
          <Link
            href={buildReviewHref()}
            style={secondaryActionStyle}
            className="deck-action-button deck-action-button--secondary"
          >
            Active Learning review
          </Link>
        </div>
      </div>
    </div>
  );
}
