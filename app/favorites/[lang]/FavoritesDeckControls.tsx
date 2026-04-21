"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ResponsiveNavLink from "@/app/components/ResponsiveNavLink";
import { usePrefetchRoutes } from "@/app/components/usePrefetchRoutes";
import { normalizeSessionOptionValue, trackGaEvent } from "@/lib/analytics/ga";
import {
  consumeRouteInteractionTiming,
  emitCategorySwitchTiming,
  startRouteInteractionTiming,
} from "@/lib/analytics/interactionTiming";

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

  const reviewSizes = [
    { value: 5, label: "Review 5" },
    { value: 10, label: "Review 10" },
    { value: 15, label: "Review 15" },
    { value: 0, label: "No limit" },
  ];

  const buildPageHref = useCallback((nextMode: Mode, nextCategory: string | null) => {
    const qs = new URLSearchParams();
    qs.set("support", supportLang);
    qs.set("mode", nextMode);

    if (nextCategory) {
      qs.set("category", nextCategory);
    }

    return `/favorites/${targetLang}?${qs.toString()}`;
  }, [supportLang, targetLang]);

  const buildPracticeHref = useCallback((n: number) => {
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
  }, [supportLang, mode, buildPageHref, selectedCategory, targetLang]);

  useEffect(() => {
    consumeRouteInteractionTiming();
  }, []);

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

  const modeWordsHref = buildPageHref("words", selectedCategory);
  const modeWsHref = buildPageHref("ws", selectedCategory);
  const modeSentencesHref = buildPageHref("sentences", selectedCategory);
  const prefetchHrefs = useMemo(
    () => [
      modeWordsHref,
      modeWsHref,
      modeSentencesHref,
      ...[5, 10, 15, 0].map((n) => buildPracticeHref(n)),
    ],
    [modeWordsHref, modeWsHref, modeSentencesHref, buildPracticeHref]
  );
  usePrefetchRoutes(prefetchHrefs);

  return (
    <div className="entry-controls-shell">
      <div style={{ marginTop: 18 }}>
        <div className="deck-mode-row" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <ResponsiveNavLink
            className="deck-mode-button"
            href={modeWordsHref}
            style={modeButtonStyle(mode === "words")}
            onClick={() =>
              startRouteInteractionTiming("mode_switch", modeWordsHref, {
                flow: "favorites",
                from_mode: mode,
                to_mode: "words",
              })
            }
          >
            Words
          </ResponsiveNavLink>

          <ResponsiveNavLink
            className="deck-mode-button"
            href={modeWsHref}
            style={modeButtonStyle(mode === "ws")}
            onClick={() =>
              startRouteInteractionTiming("mode_switch", modeWsHref, {
                flow: "favorites",
                from_mode: mode,
                to_mode: "ws",
              })
            }
          >
            Words + Sentences
          </ResponsiveNavLink>

          <ResponsiveNavLink
            className="deck-mode-button"
            href={modeSentencesHref}
            style={modeButtonStyle(mode === "sentences")}
            onClick={() =>
              startRouteInteractionTiming("mode_switch", modeSentencesHref, {
                flow: "favorites",
                from_mode: mode,
                to_mode: "sentences",
              })
            }
          >
            Sentences
          </ResponsiveNavLink>
        </div>
      </div>

      {currentCategoryOptions.length > 0 && (
        <div className="entry-category-row" style={{ marginTop: 16 }}>
          <div className="entry-category-label">Category</div>

          <select
            className="deck-category-select entry-category-select"
            value={selectedCategory ?? ""}
            onChange={(e) => {
              const timingStart = performance.now();
              const nextValue = e.currentTarget.value.trim() || null;
              setSelectedCategory(nextValue);
              trackGaEvent("category_select", {
                flow: "favorites_review",
                mode,
                category: nextValue ?? "all",
                target_lang: targetLang,
                support_lang: supportLang,
              });

              if (typeof window !== "undefined") {
                const nextUrl = buildPageHref(mode, nextValue);
                window.history.replaceState(window.history.state, "", nextUrl);
              }
              emitCategorySwitchTiming(timingStart, {
                flow: "favorites",
                mode,
                category: nextValue ?? "all",
              });
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
            {reviewSizes.map((size) => (
              <ResponsiveNavLink
                key={size.label}
                href={buildPracticeHref(size.value)}
                onClick={() => {
                  const optionValue = normalizeSessionOptionValue(size.value);
                  startRouteInteractionTiming("start_practice", buildPracticeHref(size.value), {
                    flow: "favorites",
                    mode,
                    category: selectedCategory ?? "all",
                    n: optionValue,
                  });
                  trackGaEvent("session_option_select", {
                    flow: "favorites_review",
                    option_type: "review",
                    option_value: optionValue,
                    mode,
                    category: selectedCategory ?? "all",
                    target_lang: targetLang,
                    support_lang: supportLang,
                  });
                }}
                style={reviewButtonStyle}
                className="deck-action-button deck-action-button--primary deck-learn-button"
              >
                {size.label}
              </ResponsiveNavLink>
            ))}
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
