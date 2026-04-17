"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ResponsiveNavLink from "@/app/components/ResponsiveNavLink";
import { usePrefetchRoutes } from "@/app/components/usePrefetchRoutes";
import { normalizeSessionOptionValue, trackGaEvent } from "@/lib/analytics/ga";

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
  categoryOptions: CategoryOption[];
  overallWordsProgress: Progress;
  overallSentencesProgress: Progress;
  categoryProgressByValue: Record<string, CategoryProgressEntry>;
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

export default function PassiveDeckControls({
  deckId,
  deckName,
  targetLang,
  supportLang,
  level,
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

  const buildPracticeHref = useCallback((n: number) => {
    const qs = new URLSearchParams();
    qs.set("n", String(n));
    qs.set("o", "0");
    qs.set("mode", mode);
    qs.set("back", buildDashboardBackHref(mode, selectedCategory));

    if (selectedCategory) {
      qs.set("category", selectedCategory);
    }

    return `/decks/${deckId}/practice?${qs.toString()}`;
  }, [deckId, mode, buildDashboardBackHref, selectedCategory]);

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
  const modeWordsHref = buildDeckPageHref("words", selectedCategory);
  const modeWsHref = buildDeckPageHref("ws", selectedCategory);
  const modeSentencesHref = buildDeckPageHref("sentences", selectedCategory);
  const passiveReviewHref = buildOptionalHref(`/decks/${deckId}/review`);
  const activeHref = buildOptionalHref(`/decks/${deckId}/active`);

  const prefetchHrefs = useMemo(
    () => [
      modeWordsHref,
      modeWsHref,
      modeSentencesHref,
      ...[5, 10, 15, 0].map((n) => buildPracticeHref(n)),
      passiveReviewHref,
      activeHref,
    ],
    [modeWordsHref, modeWsHref, modeSentencesHref, buildPracticeHref, passiveReviewHref, activeHref]
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

  return (
    <div className="entry-controls-shell">
      <div style={{ marginTop: 20 }}>
        <div className="deck-mode-row" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <ResponsiveNavLink className="deck-mode-button" href={modeWordsHref} style={modeButtonStyle(mode === "words")}>
            Words
          </ResponsiveNavLink>
          <ResponsiveNavLink className="deck-mode-button" href={modeWsHref} style={modeButtonStyle(mode === "ws")}>
            Words + Sentences
          </ResponsiveNavLink>
          <ResponsiveNavLink className="deck-mode-button" href={modeSentencesHref} style={modeButtonStyle(mode === "sentences")}>
            Sentences
          </ResponsiveNavLink>
        </div>
      </div>

      {categoryOptions.length > 0 && (
        <div className="entry-category-row" style={{ marginTop: 16 }}>
          <div className="entry-category-label">Category</div>

          <select
            className="deck-category-select entry-category-select"
            value={selectedCategory ?? ""}
            onChange={(e) => {
              const nextValue = e.currentTarget.value.trim() || null;
              setSelectedCategory(nextValue);
              trackGaEvent("category_select", {
                flow: "passive_learning",
                deck_id: deckId,
                deck_name: deckName,
                mode,
                category: nextValue ?? "all",
                target_lang: targetLang,
                support_lang: supportLang,
                level,
              });

              const nextUrl = buildDeckPageHref(mode, nextValue);
              window.history.replaceState(window.history.state, "", nextUrl);
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
            <ResponsiveNavLink
              key={size.label}
              href={buildPracticeHref(size.value)}
              onClick={() =>
                trackGaEvent("session_option_select", {
                  flow: "passive_learning",
                  option_type: "learn",
                  option_value: normalizeSessionOptionValue(size.value),
                  deck_id: deckId,
                  deck_name: deckName,
                  mode,
                  category: selectedCategory ?? "all",
                  target_lang: targetLang,
                  support_lang: supportLang,
                  level,
                })
              }
              style={learnButtonStyle}
              className="deck-action-button deck-action-button--primary deck-learn-button"
            >
              {size.label}
            </ResponsiveNavLink>
          ))}
        </div>

        <div className="deck-optional-section" style={{ marginTop: 18 }}>
          <div style={{ fontSize: 12, color: "var(--foreground-muted)", marginBottom: 8 }}>Also available</div>

          <div className="deck-action-row" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <ResponsiveNavLink
              href={passiveReviewHref}
              onClick={() =>
                trackGaEvent("learning_path_select", {
                  path: "passive_review",
                  deck_id: deckId,
                  deck_name: deckName,
                  mode,
                  category: selectedCategory ?? "all",
                  target_lang: targetLang,
                  support_lang: supportLang,
                  level,
                })
              }
              style={secondaryActionStyle}
              className="deck-action-button deck-action-button--secondary"
            >
              <span className="entry-action-label">
                Passive Learning review
                <span
                  className="entry-action-info"
                  aria-hidden="true"
                  data-tooltip="Uses items already mastered here."
                >
                  i
                </span>
              </span>
            </ResponsiveNavLink>

            <ResponsiveNavLink
              href={activeHref}
              onClick={() =>
                trackGaEvent("learning_path_select", {
                  path: "active_learning",
                  deck_id: deckId,
                  deck_name: deckName,
                  mode,
                  category: selectedCategory ?? "all",
                  target_lang: targetLang,
                  support_lang: supportLang,
                  level,
                })
              }
              style={secondaryActionStyle}
              className="deck-action-button deck-action-button--secondary"
            >
              <span className="entry-action-label">
                Active Learning
                <span
                  className="entry-action-info"
                  aria-hidden="true"
                  data-tooltip="Active Learning uses recall and only includes items already mastered in Passive Learning."
                >
                  i
                </span>
              </span>
            </ResponsiveNavLink>
          </div>
        </div>
      </div>
    </div>
  );
}
