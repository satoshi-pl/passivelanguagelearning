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
  categoryOptions: CategoryOption[];
  overallWordsProgress: Progress;
  overallSentencesProgress: Progress;
  categoryProgressByValue: Record<string, CategoryProgressEntry>;
};

function ProgressBar({ label, pr }: { label: string; pr: Progress }) {
  return (
    <div style={{ marginTop: 10, width: "100%", maxWidth: 620 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          color: "var(--foreground-muted)",
        }}
      >
        <span>{label}</span>
        <span style={{ fontWeight: 600 }}>
          {pr.mastered}/{pr.total} · <b style={{ color: "var(--foreground)" }}>{pr.pct}%</b>
        </span>
      </div>

      <div
        style={{
          marginTop: 8,
          height: 13,
          borderRadius: 999,
          background: "var(--surface-muted)",
          border: "1px solid var(--border)",
          overflow: "hidden",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pr.pct}%`,
            background: "linear-gradient(90deg, var(--foreground) 0%, var(--foreground-muted) 100%)",
            borderRadius: 999,
          }}
        />
      </div>
    </div>
  );
}

export default function PassiveDeckControls({
  deckId,
  mode,
  backToDecksHref,
  initialSelectedCategory,
  categoryOptions,
  overallWordsProgress,
  overallSentencesProgress,
  categoryProgressByValue,
}: Props) {
  const storageKey = `pll:deck:${deckId}:passive-category`;
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialSelectedCategory);

  const helperText =
    mode === "words"
      ? "Learn words only."
      : mode === "sentences"
        ? "Learn sentences only."
        : "Learn words first, then sentences.";

  const sessionSizes = [
    { value: 5, label: "Learn 5" },
    { value: 10, label: "Learn 10" },
    { value: 15, label: "Learn 15" },
    { value: 0, label: "No limit" },
  ];

  const buildDeckPageHref = useCallback((nextMode: Mode, nextCategory: string | null) => {
    const qs = new URLSearchParams();
    qs.set("mode", nextMode);
    qs.set("back", backToDecksHref);

    if (nextCategory) {
      qs.set("category", nextCategory);
    }

    return `/decks/${deckId}?${qs.toString()}`;
  }, [backToDecksHref, deckId]);

  const buildDashboardBackHref = useCallback((nextMode: Mode, nextCategory: string | null) => {
    const qs = new URLSearchParams();
    qs.set("mode", nextMode);

    if (nextCategory) {
      qs.set("category", nextCategory);
    }

    return `/decks/${deckId}?${qs.toString()}`;
  }, [deckId]);

  const buildPracticeHref = (n: number) => {
    const qs = new URLSearchParams();
    qs.set("n", String(n));
    qs.set("o", "0");
    qs.set("mode", mode);
    qs.set("back", buildDashboardBackHref(mode, selectedCategory));

    if (selectedCategory) {
      qs.set("category", selectedCategory);
    }

    return `/decks/${deckId}/practice?${qs.toString()}`;
  };

  const buildOptionalHref = (pathname: string) => {
    const qs = new URLSearchParams();
    qs.set("mode", mode);

    const passiveDashboardHref = buildDashboardBackHref(mode, selectedCategory);
    qs.set("back", passiveDashboardHref);

    if (selectedCategory) {
      qs.set("category", selectedCategory);
    }

    return `${pathname}?${qs.toString()}`;
  };

  useEffect(() => {
    setSelectedCategory(initialSelectedCategory);
  }, [initialSelectedCategory]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const saved = (window.sessionStorage.getItem(storageKey) || "").trim();
      if (!saved) return;

      const isValid = categoryOptions.some((c) => c.value === saved);
      if (!isValid) return;

      if (!initialSelectedCategory) {
        setSelectedCategory(saved);

        const nextUrl = buildDeckPageHref(mode, saved);
        window.history.replaceState(window.history.state, "", nextUrl);
      }
    } catch {
      // ignore storage errors
    }
  }, [storageKey, categoryOptions, initialSelectedCategory, mode, buildDeckPageHref]);

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
      maxWidth: 220,
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
    maxWidth: 220,
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
    maxWidth: 160,
    minWidth: 0,
    textAlign: "center",
    boxShadow: "0 1px 0 rgba(0,0,0,0.02)",
  } as const;

  return (
    <>
      <div style={{ marginTop: 20 }}>
        <div className="deck-mode-row" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="deck-mode-button" href={buildDeckPageHref("words", selectedCategory)} style={modeButtonStyle(mode === "words")}>
            Words
          </Link>
          <Link className="deck-mode-button" href={buildDeckPageHref("ws", selectedCategory)} style={modeButtonStyle(mode === "ws")}>
            Words + Sentences
          </Link>
          <Link className="deck-mode-button" href={buildDeckPageHref("sentences", selectedCategory)} style={modeButtonStyle(mode === "sentences")}>
            Sentences
          </Link>
        </div>
      </div>

      {categoryOptions.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: "var(--foreground-muted)", marginBottom: 6 }}>Category</div>

          <select
            value={selectedCategory ?? ""}
            onChange={(e) => {
              const nextValue = e.currentTarget.value.trim() || null;
              setSelectedCategory(nextValue);

              const nextUrl = buildDeckPageHref(mode, nextValue);
              window.history.replaceState(window.history.state, "", nextUrl);
            }}
            style={{
              width: "100%",
              maxWidth: 320,
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
            {categoryOptions.map((category) => (
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

      <div style={{ marginTop: 14, color: "var(--foreground-muted)" }}>{helperText}</div>

      <div className="deck-actions-group">
        <div className="deck-action-row deck-learn-row" style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
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

        <div className="deck-optional-section" style={{ marginTop: 18 }}>
          <div style={{ fontSize: 12, color: "var(--foreground-muted)", marginBottom: 8 }}>Optional</div>

          <div className="deck-action-row" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link
              href={buildOptionalHref(`/decks/${deckId}/review`)}
              style={secondaryActionStyle}
              className="deck-action-button deck-action-button--secondary"
            >
              Passive review
            </Link>

            <Link
              href={buildOptionalHref(`/decks/${deckId}/active`)}
              style={secondaryActionStyle}
              className="deck-action-button deck-action-button--secondary"
            >
              Active learning
            </Link>
          </div>

          <div style={{ marginTop: 8, fontSize: 12, color: "var(--foreground-muted)", maxWidth: 700 }}>
            Passive review uses items you have already mastered here. Active learning uses unlocked items from this deck.
          </div>
        </div>
      </div>
    </>
  );
}
