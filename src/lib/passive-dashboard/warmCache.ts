import type {
  PassiveDashboardPageData,
  PassiveDashboardProgress,
} from "@/lib/passive-dashboard/types";

const PASSIVE_DASHBOARD_WARM_CACHE_VERSION = 1;
const PASSIVE_DASHBOARD_WARM_CACHE_MAX_AGE_MS = 2 * 60 * 1000;

type PassiveDashboardWarmSnapshot = {
  version: number;
  savedAt: number;
  deckId: string;
  data: PassiveDashboardPageData;
};

function buildPassiveDashboardWarmCacheKey(deckId: string) {
  return `pll:passive-dashboard:warm:${deckId}`;
}

export function readPassiveDashboardWarmCache(deckId: string): PassiveDashboardPageData | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(buildPassiveDashboardWarmCacheKey(deckId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<PassiveDashboardWarmSnapshot>;
    if (parsed.version !== PASSIVE_DASHBOARD_WARM_CACHE_VERSION) return null;
    if (parsed.deckId !== deckId) return null;
    if (typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > PASSIVE_DASHBOARD_WARM_CACHE_MAX_AGE_MS) return null;
    if (!parsed.data) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function writePassiveDashboardWarmCache(deckId: string, data: PassiveDashboardPageData) {
  if (typeof window === "undefined") return;

  try {
    const payload: PassiveDashboardWarmSnapshot = {
      version: PASSIVE_DASHBOARD_WARM_CACHE_VERSION,
      savedAt: Date.now(),
      deckId,
      data,
    };
    window.sessionStorage.setItem(buildPassiveDashboardWarmCacheKey(deckId), JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
}

export function seedPassiveDashboardWarmCache({
  deckId,
  deckName,
  targetLang,
  supportLang,
  levelLabel,
  backToDecksHref,
  overallWordsProgress,
  overallSentencesProgress,
}: {
  deckId: string;
  deckName: string;
  targetLang: string;
  supportLang: string;
  levelLabel: string;
  backToDecksHref: string;
  overallWordsProgress: PassiveDashboardProgress;
  overallSentencesProgress: PassiveDashboardProgress;
}) {
  writePassiveDashboardWarmCache(deckId, {
    deckId,
    deckName,
    targetLang,
    supportLang,
    levelLabel,
    backToDecksHref,
    overallWordsProgress,
    overallSentencesProgress,
    categoryOptions: [],
    categoryProgressByValue: {},
  });
}

export async function warmPassiveDashboardPageData(deckId: string, backToDecksHref: string) {
  const cached = readPassiveDashboardWarmCache(deckId);
  if (cached && cached.categoryOptions.length > 0) return cached;

  const qs = new URLSearchParams();
  if (backToDecksHref) qs.set("back", backToDecksHref);

  const res = await fetch(`/api/decks/${deckId}/dashboard?${qs.toString()}`, {
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Passive dashboard prefetch failed: ${res.status}`);
  }

  const payload = (await res.json()) as { ok?: boolean; data?: PassiveDashboardPageData };
  if (!payload.ok || !payload.data) {
    throw new Error("Passive dashboard prefetch returned no data");
  }

  writePassiveDashboardWarmCache(deckId, payload.data);
  return payload.data;
}
