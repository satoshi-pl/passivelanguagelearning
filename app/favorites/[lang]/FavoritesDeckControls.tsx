"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Mode = "words" | "ws" | "sentences";

type CategoryOption = {
  value: string;
  label: string;
};

type Props = {
  targetLang: string;
  supportLang: string;
  mode: Mode;
  initialSelectedCategory: string | null;
  categoryOptionsByMode: Record<Mode, CategoryOption[]>;
  favoriteTotalsByMode: Record<Mode, number>;
};

export default function FavoritesDeckControls({
  targetLang,
  supportLang,
  mode,
  initialSelectedCategory,
  categoryOptionsByMode,
  favoriteTotalsByMode,
}: Props) {
  const storageKey = `pll:favorites:${targetLang}:${supportLang}:category`;
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialSelectedCategory);

  const currentCategoryOptions = useMemo(
    () => categoryOptionsByMode[mode] ?? [],
    [categoryOptionsByMode, mode]
  );
  const currentModeTotal = favoriteTotalsByMode[mode] ?? 0;

  const sizes = [5, 10, 15, 20];

  const buildPageHref = useCallback((nextMode: Mode, nextCategory: string | null) => {
    const qs = new URLSearchParams();
    qs.set("support", supportLang);
    qs.set("mode", nextMode);

    if (nextCategory) {
      qs.set("category", nextCategory);
    }

    return `/favorites/${targetLang}?${qs.toString()}`;
  }, [supportLang, targetLang]);

  const buildPracticeHref = (n: number) => {
    const qs = new URLSearchParams();
    qs.set("support", supportLang);
    qs.set("mode", mode);
    qs.set("n", String(n));
    qs.set("o", "0");
    qs.set("back", buildPageHref(mode, selectedCategory));

    if (selectedCategory) {
      qs.set("category", selectedCategory);
    }

    return `/favorites/${targetLang}/practice?${qs.toString()}`;
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

        const nextUrl = buildPageHref(mode, saved);
        window.history.replaceState(window.history.state, "", nextUrl);
      }
    } catch {
      // ignore storage errors
    }
  }, [storageKey, currentCategoryOptions, initialSelectedCategory, mode, buildPageHref]);

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
      const nextUrl = buildPageHref(mode, null);
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  }, [selectedCategory, currentCategoryOptions, mode, buildPageHref]);

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

  const reviewButtonStyle = {
    width: "100%",
    display: "inline-block",
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--surface-solid)",
    textDecoration: "none",
    color: "var(--foreground)",
    fontWeight: 800,
    minWidth: 0,
    textAlign: "center",
    boxShadow: "0 1px 0 rgba(0,0,0,0.02)",
  } as const;

  return (
    <div className="entry-controls-shell">
      <div style={{ marginTop: 18 }}>
        <div className="deck-mode-row" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link
            className="deck-mode-button"
            href={buildPageHref("words", selectedCategory)}
            style={modeButtonStyle(mode === "words")}
          >
            Words
          </Link>

          <Link
            className="deck-mode-button"
            href={buildPageHref("ws", selectedCategory)}
            style={modeButtonStyle(mode === "ws")}
          >
            Words + Sentences
          </Link>

          <Link
            className="deck-mode-button"
            href={buildPageHref("sentences", selectedCategory)}
            style={modeButtonStyle(mode === "sentences")}
          >
            Sentences
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
                const nextUrl = buildPageHref(mode, nextValue);
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

      {currentModeTotal > 0 ? (
        <div style={{ marginTop: 18 }}>
          <div className="deck-action-row deck-learn-row" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {sizes.map((n) => (
              <Link
                key={n}
                href={buildPracticeHref(n)}
                style={reviewButtonStyle}
                className="deck-action-button deck-action-button--primary deck-learn-button"
              >
                Review {n}
              </Link>
            ))}
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: "var(--foreground-muted)" }}>
            Starts immediately. No preview. Reveal → rate.
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 14, fontSize: 13, color: "var(--foreground-muted)" }}>
          {mode === "words"
            ? "No favourited words in this category right now."
            : mode === "sentences"
              ? "No favourited sentences in this category right now."
              : "No favourites in this category right now."}
        </div>
      )}
    </div>
  );
}
