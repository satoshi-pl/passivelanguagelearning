"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Mode = "words" | "ws" | "sentences";

type CategoryOption = {
  value: string;
  label: string;
};

type Props = {
  deckId: string;
  mode: Mode;
  backToDeckHref: string;
  initialSelectedCategory: string | null;
  categoryOptionsByMode: Record<Mode, CategoryOption[]>;
  reviewTotalsByMode: Record<Mode, number>;
};

export default function ReviewDeckControls({
  deckId,
  mode,
  backToDeckHref,
  initialSelectedCategory,
  categoryOptionsByMode,
  reviewTotalsByMode,
}: Props) {
  const storageKey = `pll:deck:${deckId}:review-category`;
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialSelectedCategory);

  const currentCategoryOptions = useMemo(() => categoryOptionsByMode[mode] ?? [], [categoryOptionsByMode, mode]);
  const currentModeTotal = reviewTotalsByMode[mode] ?? 0;

  const sizes = [5, 10, 15, 20];

  const buildReviewPageHref = useCallback((nextMode: Mode, nextCategory: string | null) => {
    const qs = new URLSearchParams();
    qs.set("mode", nextMode);
    qs.set("back", backToDeckHref);

    if (nextCategory) {
      qs.set("category", nextCategory);
    }

    return `/decks/${deckId}/review?${qs.toString()}`;
  }, [backToDeckHref, deckId]);

  const buildPracticeHref = (n: number) => {
    const qs = new URLSearchParams();
    qs.set("n", String(n));
    qs.set("o", "0");
    qs.set("mode", mode);
    qs.set("source", "review");
    qs.set("dir", "passive");
    qs.set("back", buildReviewPageHref(mode, selectedCategory));

    if (selectedCategory) {
      qs.set("category", selectedCategory);
    }

    return `/decks/${deckId}/practice?${qs.toString()}`;
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

        const nextUrl = buildReviewPageHref(mode, saved);
        window.history.replaceState(window.history.state, "", nextUrl);
      }
    } catch {
      // ignore storage errors
    }
  }, [storageKey, currentCategoryOptions, initialSelectedCategory, mode, buildReviewPageHref]);

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
      const nextUrl = buildReviewPageHref(mode, null);
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  }, [selectedCategory, currentCategoryOptions, mode, buildReviewPageHref]);

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

  const reviewAmountLinkStyle = {
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--surface-solid)",
    textDecoration: "none",
    color: "var(--foreground)",
    fontWeight: 700,
    boxShadow: "0 1px 0 rgba(0,0,0,0.02)",
  } as const;

  return (
    <>
      <div style={{ marginTop: 6, fontSize: 13, color: "var(--foreground-muted)" }}>
        Passive review uses items already mastered in Passive Learning. No preview. No mastery changes.
      </div>

      <div style={{ marginTop: 20 }}>
        <div className="deck-mode-row" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link
            className="deck-mode-button"
            href={buildReviewPageHref("words", selectedCategory)}
            style={modeButtonStyle(mode === "words")}
          >
            Words only
          </Link>
          <Link
            className="deck-mode-button"
            href={buildReviewPageHref("ws", selectedCategory)}
            style={modeButtonStyle(mode === "ws")}
          >
            Words + Sentences
          </Link>
          <Link
            className="deck-mode-button"
            href={buildReviewPageHref("sentences", selectedCategory)}
            style={modeButtonStyle(mode === "sentences")}
          >
            Sentences only
          </Link>
        </div>
      </div>

      {currentCategoryOptions.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: "var(--foreground-muted)", marginBottom: 6 }}>Category</div>

          <select
            value={selectedCategory ?? ""}
            onChange={(e) => {
              const nextValue = e.currentTarget.value.trim() || null;
              setSelectedCategory(nextValue);

              if (typeof window !== "undefined") {
                const nextUrl = buildReviewPageHref(mode, nextValue);
                window.history.replaceState(window.history.state, "", nextUrl);
              }
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
            {currentCategoryOptions.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {currentModeTotal > 0 ? (
        <div style={{ marginTop: 18 }}>
          <div className="deck-action-row deck-review-size-row">
            {sizes.map((n) => (
              <Link
                key={n}
                href={buildPracticeHref(n)}
                style={reviewAmountLinkStyle}
                className="deck-review-size-link deck-action-button deck-action-button--primary"
              >
                Review {n}
              </Link>
            ))}
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: "var(--foreground-muted)" }}>
            Starts immediately. Reveal → rate (Hard/Easy).
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 18, fontSize: 12, color: "var(--foreground-muted)" }}>
          {mode === "words"
            ? "No reviewable words right now."
            : mode === "sentences"
            ? "No reviewable sentences right now."
            : "No reviewable items right now."}
        </div>
      )}
    </>
  );
}
