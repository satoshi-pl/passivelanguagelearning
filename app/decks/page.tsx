export const dynamic = "force-dynamic";
export const revalidate = 0;

import RememberDecksHref from "./RememberDecksHref";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AutoSubmitSupportSelect from "./AutoSubmitSupportSelect";

type DeckRow = {
  id: string;
  name: string;
  target_lang: string;
  native_lang: string;
  level: string | null;
  created_at: string;
};

type Progress = { total: number; mastered: number; pct: number };
type DualProgress = { words: Progress; sentences: Progress };
type CountResult = { count: number | null; error: unknown };
type CountQuery = PromiseLike<CountResult> & {
  eq: (column: string, value: string) => CountQuery;
  not: (column: string, op: string, value: null) => CountQuery;
};
type SupabaseCountClient = {
  from: (table: string) => {
    select: (columns: string, options: { count: "exact"; head: true }) => CountQuery;
  };
};

function toPct(mastered: number, total: number) {
  return total > 0 ? Math.round((mastered / total) * 100) : 0;
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

function getSingleParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function levelRank(level: string | null | undefined) {
  const map: Record<string, number> = {
    A1: 1,
    A2: 2,
    B1: 3,
    B2: 4,
    C1: 5,
    C2: 6,
  };
  return map[String(level || "").toUpperCase()] ?? 999;
}

/** URL/query token for decks with no CEFR level set */
const LEVEL_URL_OTHER = "other";

function deckLevelUrlValue(level: string | null | undefined): string {
  const u = String(level || "").trim().toUpperCase();
  return u || LEVEL_URL_OTHER;
}

function deckLevelButtonLabel(level: string | null | undefined): string {
  const u = String(level || "").trim().toUpperCase();
  return u || "Other";
}

function parseLevelSearchParam(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (!t) return "";
  if (t === LEVEL_URL_OTHER) return LEVEL_URL_OTHER;
  return raw.trim().toUpperCase();
}

function levelUrlSortKey(urlVal: string): number {
  if (urlVal === LEVEL_URL_OTHER) return 999;
  return levelRank(urlVal);
}

function buildDecksHref({
  target,
  support,
  level,
}: {
  target?: string;
  support?: string;
  /** CEFR code (e.g. A1) or `other` for decks without level */
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

function deckCardTitle(deck: DeckRow) {
  const level = String(deck.level || "").toUpperCase().trim();
  const support = langName(deck.native_lang || "");

  if (level && support) return `${level} · ${support}`;
  if (level) return level;

  return deck.name;
}

async function getDeckProgressDual(
  supabase: SupabaseCountClient,
  userId: string,
  deckId: string
): Promise<DualProgress> {
  const [
    { count: totalPairs, error: totalErr },
    { count: masteredWords, error: masteredWordsErr },
    { count: masteredSentences, error: masteredSentencesErr },
  ] = await Promise.all([
    supabase.from("pairs").select("id", { count: "exact", head: true }).eq("deck_id", deckId),

    supabase
      .from("user_pairs")
      .select("pair_id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("deck_id", deckId)
      .not("word_mastered_at", "is", null),

    supabase
      .from("user_pairs")
      .select("pair_id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("deck_id", deckId)
      .not("sentence_mastered_at", "is", null),
  ]);

  const total = totalErr ? 0 : totalPairs ?? 0;
  const wMastered = masteredWordsErr ? 0 : masteredWords ?? 0;
  const sMastered = masteredSentencesErr ? 0 : masteredSentences ?? 0;

  return {
    words: { total, mastered: wMastered, pct: toPct(wMastered, total) },
    sentences: { total, mastered: sMastered, pct: toPct(sMastered, total) },
  };
}

function ProgressBar({ label, pr }: { label: string; pr: Progress }) {
  return (
    <div className="deck-progress-bar">
      <div className="deck-progress-bar__meta">
        <span className="deck-progress-bar__label">{label}</span>
        <span className="deck-progress-bar__stats">
          <b className="deck-progress-bar__pct">{pr.pct}%</b>
          <span className="deck-progress-bar__sep" aria-hidden="true">
            •
          </span>
          <span className="deck-progress-bar__count">
            {pr.mastered} of {pr.total}
          </span>
        </span>
      </div>

      <div className="deck-progress-bar__track">
        <div
          className="deck-progress-bar__fill"
          style={{
            width: `${pr.pct}%`,
            transition: "width 250ms ease",
          }}
        />
      </div>
    </div>
  );
}

function FilterButton({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
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
      }}
    >
      {children}
    </Link>
  );
}

export default async function DecksPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createSupabaseServerClient();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) redirect("/login");

  const sp = (await searchParams) ?? {};

  const loadDecks = () =>
    supabase
      .from("decks")
      .select("id, name, target_lang, native_lang, level, created_at")
      .order("target_lang", { ascending: true })
      .order("level", { ascending: true })
      .order("native_lang", { ascending: true })
      .order("name", { ascending: true });

  let { data: decks, error: decksError } = await loadDecks();

  if (decksError) {
    return (
      <div className="pll-workspace" style={{ maxWidth: 1040, margin: "40px auto", padding: "0 24px" }}>
        <pre>{JSON.stringify(decksError, null, 2)}</pre>
      </div>
    );
  }

  let allDecks = (decks as DeckRow[]) ?? [];

  if (allDecks.length === 0) {
    redirect("/setup");
  }

  const targetOptions = Array.from(
    new Set(allDecks.map((d) => (d.target_lang || "").toLowerCase()).filter(Boolean))
  ).sort((a, b) => langName(a).localeCompare(langName(b)));

  const supportOptionsByTarget: Record<string, string[]> = {};
  for (const target of targetOptions) {
    supportOptionsByTarget[target] = Array.from(
      new Set(
        allDecks
          .filter((d) => (d.target_lang || "").toLowerCase() === target)
          .map((d) => (d.native_lang || "").toLowerCase())
          .filter(Boolean)
      )
    ).sort((a, b) => langName(a).localeCompare(langName(b)));
  }

  const requestedTarget = getSingleParam(sp.target).toLowerCase();
  const selectedTarget =
    targetOptions.includes(requestedTarget) ? requestedTarget : targetOptions[0] ?? "";

  const requestedSupport = getSingleParam(sp.support).toLowerCase();
  const availableSupportsForSelectedTarget = supportOptionsByTarget[selectedTarget] ?? [];

  const selectedSupport =
    availableSupportsForSelectedTarget.includes(requestedSupport)
      ? requestedSupport
      : availableSupportsForSelectedTarget[0] ?? "";

  const pairDecks = allDecks
    .filter(
      (d) =>
        (d.target_lang || "").toLowerCase() === selectedTarget &&
        (d.native_lang || "").toLowerCase() === selectedSupport
    )
    .sort((a, b) => levelRank(a.level) - levelRank(b.level));

  const levelUrlOptions = Array.from(
    new Set(pairDecks.map((d) => deckLevelUrlValue(d.level)))
  ).sort((a, b) => levelUrlSortKey(a) - levelUrlSortKey(b));

  const requestedLevelToken = parseLevelSearchParam(getSingleParam(sp.level));
  const selectedLevelUrl =
    requestedLevelToken && levelUrlOptions.includes(requestedLevelToken)
      ? requestedLevelToken
      : levelUrlOptions[0] ?? LEVEL_URL_OTHER;

  const displayDecks = pairDecks.filter((d) => deckLevelUrlValue(d.level) === selectedLevelUrl);

  const progressEntries = await Promise.all(
    displayDecks.map(async (deck) => {
      const pr = await getDeckProgressDual(
        supabase as unknown as SupabaseCountClient,
        user.id,
        deck.id
      );
      return [deck.id, pr] as const;
    })
  );

  const progressByDeck: Record<string, DualProgress> = {};
  for (const [deckId, pr] of progressEntries) {
    progressByDeck[deckId] = pr;
  }

  const { count: favoritesCount, error: favoritesErr } = await supabase
    .from("user_favorites")
    .select("pair_id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("target_lang", selectedTarget)
    .eq("native_lang", selectedSupport);

  const favoritesTotal = favoritesErr ? 0 : favoritesCount ?? 0;
  const favoritesHref = `/favorites/${selectedTarget}?support=${selectedSupport}&mode=ws`;
  const currentDecksHref = buildDecksHref({
    target: selectedTarget,
    support: selectedSupport,
    level: selectedLevelUrl,
  });

  return (
    <div className="pll-workspace" style={{ maxWidth: 1040, margin: "40px auto", padding: "0 24px" }}>
      <RememberDecksHref href={currentDecksHref} />

      <div
        style={{
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 34,
            fontWeight: 900,
            letterSpacing: "-0.03em",
            lineHeight: 1.08,
            color: "var(--foreground)",
          }}
        >
          My decks
        </h1>

        <Link
          href="/decks/add-pair"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "10px 14px",
            borderRadius: 999,
            border: "1px solid var(--border)",
            background: "var(--surface-solid)",
            color: "var(--foreground)",
            textDecoration: "none",
            fontWeight: 800,
            fontSize: 14,
            whiteSpace: "nowrap",
            boxShadow: "0 1px 0 rgba(0,0,0,0.02)",
          }}
        >
          Add language pair
        </Link>
      </div>

      <div
        style={{
          marginBottom: 18,
          display: "flex",
          justifyContent: "flex-start",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            justifyContent: "center",
            alignItems: "flex-start",
            gap: 34,
            flexWrap: "wrap",
            padding: "12px 18px",
            borderRadius: 18,
            background: "var(--surface-muted)",
            border: "1px solid var(--border)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
            width: "fit-content",
            maxWidth: "100%",
            color: "var(--foreground)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: "fit-content",
            }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 800,
                marginBottom: 8,
                textAlign: "center",
                color: "var(--foreground)",
              }}
            >
              I want to learn
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              {targetOptions.map((target) => {
                const supportsForTarget = supportOptionsByTarget[target] ?? [];
                const supportForLink = supportsForTarget.includes(selectedSupport)
                  ? selectedSupport
                  : supportsForTarget[0] ?? "";

                return (
                  <FilterButton
                    key={target}
                    href={buildDecksHref({
                      target,
                      support: supportForLink,
                    })}
                    active={target === selectedTarget}
                  >
                    {langName(target)}
                  </FilterButton>
                );
              })}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: "fit-content",
            }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 800,
                marginBottom: 8,
                textAlign: "center",
                color: "var(--foreground)",
              }}
            >
              From
            </div>

            <AutoSubmitSupportSelect
              target={selectedTarget}
              value={selectedSupport}
              options={availableSupportsForSelectedTarget.map((support) => ({
                value: support,
                label: langName(support),
              }))}
            />
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: "fit-content",
            }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 800,
                marginBottom: 8,
                textAlign: "center",
                color: "var(--foreground)",
              }}
            >
              Level
            </div>

            {levelUrlOptions.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  justifyContent: "center",
                  maxWidth: "100%",
                }}
                role="group"
                aria-label="CEFR level"
              >
                {levelUrlOptions.map((urlVal) => {
                  const sampleDeck = pairDecks.find((d) => deckLevelUrlValue(d.level) === urlVal);
                  const label = sampleDeck ? deckLevelButtonLabel(sampleDeck.level) : urlVal;

                  return (
                    <FilterButton
                      key={urlVal}
                      href={buildDecksHref({
                        target: selectedTarget,
                        support: selectedSupport,
                        level: urlVal,
                      })}
                      active={urlVal === selectedLevelUrl}
                    >
                      {label}
                    </FilterButton>
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  fontSize: 13,
                  color: "var(--foreground-muted)",
                  textAlign: "center",
                  maxWidth: 200,
                }}
              >
                No levels for this pair
              </div>
            )}
          </div>
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
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
            {langName(selectedTarget)}
          </div>

          <Link
            href={favoritesHref}
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
          </Link>
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
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 14,
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  padding: "16px 16px",
                  background: "var(--surface-solid)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
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

                  <ProgressBar label="Words" pr={pr.words} />
                  <ProgressBar label="Sentences" pr={pr.sentences} />
                </div>

                <Link
                  href={`/decks/${String(deck.id)}?back=${encodeURIComponent(currentDecksHref)}`}
                  style={{
                    whiteSpace: "nowrap",
                    padding: "10px 14px",
                    borderRadius: 12,
                    background: "var(--foreground)",
                    color: "var(--surface-solid)",
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  Start practice
                </Link>
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
    </div>
  );
}
