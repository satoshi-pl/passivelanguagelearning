import type { FavoritesMode } from "@/lib/favorites/types";

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

export function buildFavoritesHref({
  target,
  support,
  mode,
  category,
}: {
  target: string;
  support: string;
  mode?: FavoritesMode;
  category?: string | null;
}) {
  const qs = new URLSearchParams();

  if (support) qs.set("support", support);
  if (mode) qs.set("mode", mode);
  if (category) qs.set("category", category);

  const s = qs.toString();
  return s ? `/favorites/${target}?${s}` : `/favorites/${target}`;
}
