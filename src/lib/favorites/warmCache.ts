import type { FavoritesPageData } from "@/lib/favorites/types";

const FAVORITES_WARM_CACHE_VERSION = 1;
const FAVORITES_WARM_CACHE_MAX_AGE_MS = 2 * 60 * 1000;

type FavoritesWarmSnapshot = {
  version: number;
  savedAt: number;
  targetLang: string;
  supportLang: string;
  data: FavoritesPageData;
};

function buildFavoritesWarmCacheKey(targetLang: string, supportLang: string) {
  return `pll:favorites:warm:${targetLang}:${supportLang}`;
}

export function readFavoritesWarmCache(targetLang: string, supportLang: string): FavoritesPageData | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(buildFavoritesWarmCacheKey(targetLang, supportLang));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<FavoritesWarmSnapshot>;
    if (parsed.version !== FAVORITES_WARM_CACHE_VERSION) return null;
    if (parsed.targetLang !== targetLang || parsed.supportLang !== supportLang) return null;
    if (typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > FAVORITES_WARM_CACHE_MAX_AGE_MS) return null;
    if (!parsed.data) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeFavoritesWarmCache(targetLang: string, supportLang: string, data: FavoritesPageData) {
  if (typeof window === "undefined") return;

  try {
    const payload: FavoritesWarmSnapshot = {
      version: FAVORITES_WARM_CACHE_VERSION,
      savedAt: Date.now(),
      targetLang,
      supportLang,
      data,
    };
    window.sessionStorage.setItem(buildFavoritesWarmCacheKey(targetLang, supportLang), JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
}

export async function warmFavoritesPageData(targetLang: string, supportLang: string) {
  const cached = readFavoritesWarmCache(targetLang, supportLang);
  if (cached) return cached;

  const qs = new URLSearchParams();
  qs.set("target_lang", targetLang);
  qs.set("native_lang", supportLang);

  const res = await fetch(`/api/favorites/aggregates?${qs.toString()}`, {
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Favorites aggregate prefetch failed: ${res.status}`);
  }

  const payload = (await res.json()) as { ok?: boolean; data?: FavoritesPageData };
  if (!payload.ok || !payload.data) {
    throw new Error("Favorites aggregate prefetch returned no data");
  }

  writeFavoritesWarmCache(targetLang, payload.data.selectedSupport, payload.data);
  return payload.data;
}
