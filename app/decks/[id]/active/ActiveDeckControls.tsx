"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import ResponsiveNavLink from "@/app/components/ResponsiveNavLink";
import { usePrefetchRoutes } from "@/app/components/usePrefetchRoutes";
import { normalizeSessionOptionValue, trackGaEvent } from "@/lib/analytics/ga";
import {
  consumeRouteInteractionTiming,
  emitInteractionTiming,
  emitCategorySwitchTiming,
  startRouteInteractionTiming,
} from "@/lib/analytics/interactionTiming";
import {
  seedActiveReviewWarmCache,
  warmActiveReviewPageData,
} from "@/lib/active-review/warmCache";
import { buildActiveReviewHref as buildActiveReviewEntryHref } from "@/lib/active-review/shared";
import { buildActiveDashboardHref } from "@/lib/active-dashboard/shared";

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
  deckName: string;
  targetLang: string;
  supportLang: string;
  level: string;
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
  deckName,
  targetLang,
  supportLang,
  level,
  mode,
  backToDecksHref,
  initialSelectedCategory,
  categoryOptionsByMode,
  overallWordsProgress,
  overallSentencesProgress,
  categoryProgressByValue,
  pendingTotalsByMode,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const storageKey = `pll:deck:${deckId}:active-category`;
  const [currentMode, setCurrentMode] = useState<Mode>(mode);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialSelectedCategory);

  const currentCategoryOptions = useMemo(
    () => categoryOptionsByMode[currentMode] ?? [],
    [categoryOptionsByMode, currentMode]
  );
  const currentModePending = pendingTotalsByMode[currentMode] ?? 0;

  const sessionSizes = [
    { value: 5, label: "Active 5" },
    { value: 10, label: "Active 10" },
    { value: 15, label: "Active 15" },
    { value: 0, label: "No limit" },
  ];

  const buildActivePageHref = useCallback((nextMode: Mode, nextCategory: string | null) => {
    return buildActiveDashboardHref({
      deckId,
      mode: nextMode,
      backToDecksHref,
      category: nextCategory,
    });
  }, [backToDecksHref, deckId]);

  const buildDashboardBackHref = useCallback((nextMode: Mode, nextCategory: string | null) => {
    return buildActivePageHref(nextMode, nextCategory);
  }, [buildActivePageHref]);

  const buildPracticeHref = useCallback((n: number) => {
    const qs = new URLSearchParams();
    qs.set("n", String(n));
    qs.set("o", "0");
    qs.set("mode", currentMode);
    qs.set("dir", "active");
    qs.set("source", "learn");
    qs.set("back", buildDashboardBackHref(currentMode, selectedCategory));

    if (selectedCategory) {
      qs.set("category", selectedCategory);
    }

    return `/decks/${deckId}/practice?${qs.toString()}`;
  }, [deckId, currentMode, buildDashboardBackHref, selectedCategory]);

  const buildReviewHref = () =>
    buildActiveReviewEntryHref({
      deckId,
      mode: currentMode,
      backToDeckHref: buildDashboardBackHref(currentMode, selectedCategory),
      deckName,
      targetLang,
      supportLang,
      level,
      category: selectedCategory,
      warmEntry: true,
    });
  const warmActiveReview = useCallback(() => {
    const backToDeckHref = buildDashboardBackHref(currentMode, selectedCategory);
    seedActiveReviewWarmCache({
      deckId,
      deckName,
      targetLang,
      supportLang,
      level,
      backToDeckHref,
    });
    void warmActiveReviewPageData(deckId, backToDeckHref).catch(() => {
      // Warm prefetch should never interrupt the primary dashboard UI.
    });
  }, [buildDashboardBackHref, currentMode, selectedCategory, deckId, deckName, targetLang, supportLang, level]);

  useEffect(() => {
    consumeRouteInteractionTiming();
  }, [pathname, searchParams]);

  useEffect(() => {
    setCurrentMode(mode);
  }, [mode]);

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

        const nextUrl = buildActivePageHref(currentMode, saved);
        window.history.replaceState(window.history.state, "", nextUrl);
      }
    } catch {
      // ignore storage errors
    }
  }, [storageKey, currentCategoryOptions, initialSelectedCategory, currentMode, buildActivePageHref]);

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
    warmActiveReview();
  }, [warmActiveReview]);

  useEffect(() => {
    if (!selectedCategory) return;

    const stillValid = currentCategoryOptions.some((c) => c.value === selectedCategory);
    if (stillValid) return;

    setSelectedCategory(null);

    if (typeof window !== "undefined") {
      const nextUrl = buildActivePageHref(currentMode, null);
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  }, [selectedCategory, currentCategoryOptions, currentMode, buildActivePageHref]);

  const selectedProgress = useMemo(() => {
    if (!selectedCategory) return null;
    return categoryProgressByValue[selectedCategory] ?? null;
  }, [selectedCategory, categoryProgressByValue]);

  const prWords = selectedProgress?.words ?? overallWordsProgress;
  const prSentences = selectedProgress?.sentences ?? overallSentencesProgress;
  const modeWordsHref = buildActivePageHref("words", selectedCategory);
  const modeWsHref = buildActivePageHref("ws", selectedCategory);
  const modeSentencesHref = buildActivePageHref("sentences", selectedCategory);
  const activeReviewHref = buildReviewHref();

  const prefetchHrefs = useMemo(
    () => [
      modeWordsHref,
      modeWsHref,
      modeSentencesHref,
      ...[5, 10, 15, 0].map((n) => buildPracticeHref(n)),
      activeReviewHref,
    ],
    [modeWordsHref, modeWsHref, modeSentencesHref, buildPracticeHref, activeReviewHref]
  );
  usePrefetchRoutes(prefetchHrefs);

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

  const onModeClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, nextMode: Mode) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      event.preventDefault();
      if (nextMode === currentMode) return;

      const startedAt = performance.now();
      const validOptions = categoryOptionsByMode[nextMode] ?? [];
      const nextCategory =
        selectedCategory && validOptions.some((c) => c.value === selectedCategory)
          ? selectedCategory
          : null;

      setCurrentMode(nextMode);
      setSelectedCategory(nextCategory);
      const nextUrl = buildActivePageHref(nextMode, nextCategory);
      window.history.replaceState(window.history.state, "", nextUrl);
      emitInteractionTiming("mode_switch", startedAt, {
        flow: "active_learning",
        from_mode: currentMode,
        to_mode: nextMode,
      });
    },
    [buildActivePageHref, categoryOptionsByMode, currentMode, selectedCategory]
  );

  return (
    <div className="entry-controls-shell">
      <div style={{ marginTop: 20 }}>
        <div className="deck-mode-row" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <ResponsiveNavLink
            className="deck-mode-button"
            href={modeWordsHref}
            style={modeButtonStyle(currentMode === "words")}
            pendingDurationMs={220}
            onClick={(event) => onModeClick(event, "words")}
          >
            Words
          </ResponsiveNavLink>
          <ResponsiveNavLink
            className="deck-mode-button"
            href={modeWsHref}
            style={modeButtonStyle(currentMode === "ws")}
            pendingDurationMs={220}
            onClick={(event) => onModeClick(event, "ws")}
          >
            Words + Sentences
          </ResponsiveNavLink>
          <ResponsiveNavLink
            className="deck-mode-button"
            href={modeSentencesHref}
            style={modeButtonStyle(currentMode === "sentences")}
            pendingDurationMs={220}
            onClick={(event) => onModeClick(event, "sentences")}
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
                flow: "active_learning",
                deck_id: deckId,
                deck_name: deckName,
                mode: currentMode,
                category: nextValue ?? "all",
                target_lang: targetLang,
                support_lang: supportLang,
                level,
              });

              if (typeof window !== "undefined") {
                const nextUrl = buildActivePageHref(currentMode, nextValue);
                window.history.replaceState(window.history.state, "", nextUrl);
              }
              emitCategorySwitchTiming(timingStart, {
                flow: "active_learning",
                mode: currentMode,
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
              <ResponsiveNavLink
                key={size.label}
                href={buildPracticeHref(size.value)}
                onClick={() => {
                  const optionValue = normalizeSessionOptionValue(size.value);
                  startRouteInteractionTiming("start_practice", buildPracticeHref(size.value), {
                    flow: "active_learning",
                    mode: currentMode,
                    category: selectedCategory ?? "all",
                    n: optionValue,
                  });
                  trackGaEvent("session_option_select", {
                    flow: "active_learning",
                    option_type: "active",
                    option_value: optionValue,
                    deck_id: deckId,
                    deck_name: deckName,
                    mode: currentMode,
                    category: selectedCategory ?? "all",
                    target_lang: targetLang,
                    support_lang: supportLang,
                    level,
                  });
                }}
                style={learnButtonStyle}
                className="deck-action-button deck-action-button--primary deck-learn-button"
              >
                {size.label}
              </ResponsiveNavLink>
            ))}
          </div>
        ) : (
          <div style={{ marginTop: 14, fontSize: 12, color: "var(--foreground-muted)" }}>
            {currentMode === "words"
              ? "No pending active words right now."
              : currentMode === "sentences"
                ? "No pending active sentences right now."
                : "No pending active items right now."}
          </div>
        )}

        <div className="deck-optional-section" style={{ marginTop: 18 }}>
          <ResponsiveNavLink
            href={activeReviewHref}
            onPointerEnter={() => warmActiveReview()}
            onPointerDown={() => warmActiveReview()}
            onTouchStart={() => warmActiveReview()}
            onClick={() =>
              {
                warmActiveReview();
                trackGaEvent("learning_path_select", {
                  path: "active_review",
                  deck_id: deckId,
                  deck_name: deckName,
                  mode: currentMode,
                  category: selectedCategory ?? "all",
                  target_lang: targetLang,
                  support_lang: supportLang,
                  level,
                });
              }
            }
            style={secondaryActionStyle}
            className="deck-action-button deck-action-button--secondary"
          >
            Active Learning review
          </ResponsiveNavLink>
        </div>
      </div>
    </div>
  );
}
