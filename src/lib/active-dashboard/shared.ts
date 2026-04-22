import type { ActiveDashboardMode } from "@/lib/active-dashboard/types";

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

export function buildActiveDashboardHref({
  deckId,
  mode,
  backToDecksHref,
  category,
  warmEntry,
}: {
  deckId: string;
  mode?: ActiveDashboardMode;
  backToDecksHref?: string;
  category?: string | null;
  warmEntry?: boolean;
}) {
  const qs = new URLSearchParams();

  if (mode) qs.set("mode", mode);
  if (backToDecksHref) qs.set("back", backToDecksHref);
  if (category) qs.set("category", category);
  if (warmEntry) qs.set("entry", "passive_dashboard");

  const s = qs.toString();
  return s ? `/decks/${deckId}/active?${s}` : `/decks/${deckId}/active`;
}
