export const LEVEL_URL_OTHER = "other";

export function toPct(mastered: number, total: number) {
  return total > 0 ? Math.round((mastered / total) * 100) : 0;
}

export function langName(codeOrName: string) {
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

export function levelRank(level: string | null | undefined) {
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

export function deckLevelUrlValue(level: string | null | undefined): string {
  const u = String(level || "").trim().toUpperCase();
  return u || LEVEL_URL_OTHER;
}

export function deckLevelButtonLabel(level: string | null | undefined): string {
  const u = String(level || "").trim().toUpperCase();
  return u || "Other";
}

export function parseLevelSearchParam(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (!t) return "";
  if (t === LEVEL_URL_OTHER) return LEVEL_URL_OTHER;
  return raw.trim().toUpperCase();
}

export function levelUrlSortKey(urlVal: string): number {
  if (urlVal === LEVEL_URL_OTHER) return 999;
  return levelRank(urlVal);
}

export function buildDecksHref({
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

export function buildDecksWarmEntryHref(currentDecksHref: string) {
  const url = new URL(currentDecksHref || "/decks", "http://localhost");
  url.searchParams.set("entry", "home");
  return `${url.pathname}${url.search}`;
}
