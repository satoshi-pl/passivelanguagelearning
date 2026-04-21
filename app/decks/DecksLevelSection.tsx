"use client";

import { useMemo, useState } from "react";
import ResponsiveNavLink from "@/app/components/ResponsiveNavLink";
import TrackedResponsiveNavLink from "@/app/components/TrackedResponsiveNavLink";
import { usePrefetchRoutes } from "@/app/components/usePrefetchRoutes";

type DeckRow = {
  id: string;
  name: string;
  target_lang: string;
  native_lang: string;
  level: string | null;
};

type Progress = { total: number; mastered: number; pct: number };
type DualProgress = { words: Progress; sentences: Progress };

type LevelOption = {
  value: string;
  label: string;
};

const LEVEL_URL_OTHER = "other";

function buildDecksHref({
  target,
  support,
  level,
}: {
  target?: string;
  support?: string;
  level?: string;
}) {
  const qs = new URLSearchParams();
  if (target) qs.set("target", target);
  if (support) qs.set("support", support);
  if (level) {
    qs.set("level", level === LEVEL_URL_OTHER ? LEVEL_URL_OTHER : level.toUpperCase());
  }
  const s = qs.toString();
  return s ? `/decks?${s}` : "/decks";
}

function langName(codeOrName: string) {
  const map: Record<string, string> = {
    es: "Spanish",
    en: "English",
    pl: "Polish",
    de: "German",
    fr: "French",
    it: "Italian",
    pt: "Portuguese",
    ru: "Russian",
    tr: "Turkish",
    ar: "Arabic",
    sw: "Swahili",
    zh: "Chinese",
    ja: "Japanese",
    ko: "Korean",
  };
  const key = (codeOrName || "").toLowerCase().trim();
  return map[key] ?? codeOrName;
}

function deckCardTitle(deck: DeckRow) {
  const level = String(deck.level || "").toUpperCase().trim();
  const support = langName(deck.native_lang || "");
  if (level && support) return `${level} · ${support}`;
  if (level) return level;
  return deck.name;
}

function levelButtonStyle(active: boolean) {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "12px 18px",
    borderRadius: 999,
    border: active ? "1px solid var(--foreground)" : "1px solid var(--border)",
    background: active ? "var(--foreground)" : "var(--surface-solid)",
    color: active ? "var(--surface-solid)" : "var(--foreground)",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 15,
    whiteSpace: "nowrap",
    minHeight: 46,
    boxShadow: active ? "none" : "0 1px 0 rgba(0,0,0,0.02)",
    transition: "opacity 130ms ease",
    cursor: "pointer",
  } as const;
}

function ProgressBar({ label, pr }: { label: string; pr: Progress }) {
  return (
    <div className="entry-progress-row deck-progress-bar pll-deck-list-card__progress">
      <span className="entry-progress-row__label">{label}</span>
      <div className="entry-progress-row__track-wrap">
        <div className="entry-progress-row__track deck-progress-bar__track">
          <div
            className="entry-progress-row__fill deck-progress-bar__fill"
            style={{ width: `${pr.pct}%`, transition: "width 250ms ease" }}
          />
        </div>
      </div>
      <span className="entry-progress-row__stats">
        {pr.mastered}/{pr.total} · <b>{pr.pct}%</b>
      </span>
    </div>
  );
}

export default function DecksLevelSection({
  targetLang,
  supportLang,
  levelOptions,
  initialSelectedLevel,
  pairDecks,
  progressByDeck,
  favoritesHref,
  favoritesTotal,
}: {
  targetLang: string;
  supportLang: string;
  levelOptions: LevelOption[];
  initialSelectedLevel: string;
  pairDecks: DeckRow[];
  progressByDeck: Record<string, DualProgress>;
  favoritesHref: string;
  favoritesTotal: number;
}) {
  const [selectedLevel, setSelectedLevel] = useState(initialSelectedLevel);

  const displayDecks = useMemo(
    () => pairDecks.filter((d) => (String(d.level || "").trim().toUpperCase() || LEVEL_URL_OTHER) === selectedLevel),
    [pairDecks, selectedLevel]
  );

  const currentDecksHref = useMemo(
    () =>
      buildDecksHref({
        target: targetLang,
        support: supportLang,
        level: selectedLevel,
      }),
    [targetLang, supportLang, selectedLevel]
  );

  const deckDashboardHrefs = useMemo(
    () => pairDecks.map((deck) => `/decks/${String(deck.id)}?back=${encodeURIComponent(currentDecksHref)}`),
    [pairDecks, currentDecksHref]
  );
  usePrefetchRoutes([favoritesHref, ...deckDashboardHrefs]);

  const onLevelSelect = (nextLevel: string) => {
    if (nextLevel === selectedLevel) return;
    setSelectedLevel(nextLevel);
    const nextHref = buildDecksHref({
      target: targetLang,
      support: supportLang,
      level: nextLevel,
    });
    window.history.replaceState(window.history.state, "", nextHref);
  };

  return (
    <>
      <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }} role="group" aria-label="CEFR level">
          {levelOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onLevelSelect(option.value)}
              aria-pressed={option.value === selectedLevel}
              style={levelButtonStyle(option.value === selectedLevel)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 18,
          background: "var(--surface-solid)",
          color: "var(--foreground)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div
            style={{
              marginTop: 2,
              fontSize: 28,
              fontWeight: 900,
              letterSpacing: "-0.03em",
              lineHeight: 1.08,
              color: "var(--foreground)",
            }}
          >
            {langName(targetLang)}
          </div>

          <TrackedResponsiveNavLink
            href={favoritesHref}
            eventName="favorites_open"
            eventParams={{ target_lang: targetLang, support_lang: supportLang, mode: "ws" }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 14px",
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: "var(--surface-solid)",
              color: "var(--foreground)",
              textDecoration: "none",
              fontWeight: 800,
              fontSize: 14,
              boxShadow: "0 1px 0 rgba(0,0,0,0.02)",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1, color: "#C89B1D" }}>★</span>
            <span>Favourites{favoritesTotal > 0 ? ` (${favoritesTotal})` : ""}</span>
          </TrackedResponsiveNavLink>
        </div>

        <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
          {displayDecks.map((deck) => {
            const pr = progressByDeck[deck.id] ?? {
              words: { total: 0, mastered: 0, pct: 0 },
              sentences: { total: 0, mastered: 0, pct: 0 },
            };

            return (
              <div
                key={deck.id}
                className="pll-deck-list-card flex flex-col md:flex-row md:items-center md:justify-between md:gap-[14px]"
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  padding: "16px 16px",
                  background: "var(--surface-solid)",
                }}
              >
                <div className="w-full min-w-0 md:flex-1">
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: 18,
                      letterSpacing: "-0.015em",
                      color: "var(--foreground)",
                    }}
                  >
                    {deckCardTitle(deck)}
                  </div>
                  <div className="mt-3 flex w-full flex-col gap-3 md:mt-0 md:block md:gap-0">
                    <ProgressBar label="Words" pr={pr.words} />
                    <ProgressBar label="Sentences" pr={pr.sentences} />
                  </div>
                </div>

                <TrackedResponsiveNavLink
                  href={`/decks/${String(deck.id)}?back=${encodeURIComponent(currentDecksHref)}`}
                  eventName="start_practice_click"
                  interactionTiming="open_dashboard"
                  eventParams={{
                    deck_id: deck.id,
                    deck_name: deck.name,
                    target_lang: deck.target_lang,
                    support_lang: deck.native_lang,
                    level: deck.level ?? "other",
                  }}
                  className="mt-5 flex w-full shrink-0 items-center justify-center text-center md:mt-0 md:inline-flex md:w-auto"
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    background: "var(--foreground)",
                    color: "var(--surface-solid)",
                    fontWeight: 700,
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  Start practice
                </TrackedResponsiveNavLink>
              </div>
            );
          })}

          {displayDecks.length === 0 && (
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: 16,
                background: "var(--surface-solid)",
                color: "var(--foreground-muted)",
              }}
            >
              No decks match the current selection.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
