import type { ActiveDashboardPageData } from "@/lib/active-dashboard/types";

const ACTIVE_DASHBOARD_WARM_CACHE_VERSION = 1;
const ACTIVE_DASHBOARD_WARM_CACHE_MAX_AGE_MS = 2 * 60 * 1000;

type ActiveDashboardWarmSnapshot = {
  version: number;
  savedAt: number;
  deckId: string;
  data: ActiveDashboardPageData;
};

function buildActiveDashboardWarmCacheKey(deckId: string) {
  return `pll:active-dashboard:warm:${deckId}`;
}

export function readActiveDashboardWarmCache(deckId: string): ActiveDashboardPageData | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(buildActiveDashboardWarmCacheKey(deckId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<ActiveDashboardWarmSnapshot>;
    if (parsed.version !== ACTIVE_DASHBOARD_WARM_CACHE_VERSION) return null;
    if (parsed.deckId !== deckId) return null;
    if (typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > ACTIVE_DASHBOARD_WARM_CACHE_MAX_AGE_MS) return null;
    if (!parsed.data) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeActiveDashboardWarmCache(deckId: string, data: ActiveDashboardPageData) {
  if (typeof window === "undefined") return;

  try {
    const payload: ActiveDashboardWarmSnapshot = {
      version: ACTIVE_DASHBOARD_WARM_CACHE_VERSION,
      savedAt: Date.now(),
      deckId,
      data,
    };
    window.sessionStorage.setItem(buildActiveDashboardWarmCacheKey(deckId), JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
}

export async function warmActiveDashboardPageData(deckId: string, backToDecksHref: string) {
  const cached = readActiveDashboardWarmCache(deckId);
  if (cached && cached.backToDecksHref === backToDecksHref) {
    return cached;
  }

  const qs = new URLSearchParams();
  if (backToDecksHref) qs.set("back", backToDecksHref);

  const res = await fetch(`/api/decks/${deckId}/active-dashboard?${qs.toString()}`, {
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Active dashboard prefetch failed: ${res.status}`);
  }

  const payload = (await res.json()) as { ok?: boolean; data?: ActiveDashboardPageData };
  if (!payload.ok || !payload.data) {
    throw new Error("Active dashboard prefetch returned no data");
  }

  writeActiveDashboardWarmCache(deckId, payload.data);
  return payload.data;
}
