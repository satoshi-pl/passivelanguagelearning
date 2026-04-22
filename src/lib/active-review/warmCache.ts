import type { ActiveReviewPageData } from "@/lib/active-review/types";

const ACTIVE_REVIEW_WARM_CACHE_VERSION = 1;
const ACTIVE_REVIEW_WARM_CACHE_MAX_AGE_MS = 2 * 60 * 1000;

type ActiveReviewWarmSnapshot = {
  version: number;
  savedAt: number;
  deckId: string;
  isComplete: boolean;
  data: ActiveReviewPageData;
};

export type ActiveReviewWarmCacheEntry = {
  isComplete: boolean;
  data: ActiveReviewPageData;
};

function buildActiveReviewWarmCacheKey(deckId: string) {
  return `pll:active-review:warm:${deckId}`;
}

export function readActiveReviewWarmCache(deckId: string): ActiveReviewWarmCacheEntry | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(buildActiveReviewWarmCacheKey(deckId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<ActiveReviewWarmSnapshot>;
    if (parsed.version !== ACTIVE_REVIEW_WARM_CACHE_VERSION) return null;
    if (parsed.deckId !== deckId) return null;
    if (typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > ACTIVE_REVIEW_WARM_CACHE_MAX_AGE_MS) return null;
    if (!parsed.data || typeof parsed.isComplete !== "boolean") return null;
    return { data: parsed.data, isComplete: parsed.isComplete };
  } catch {
    return null;
  }
}

function writeActiveReviewWarmCache(deckId: string, data: ActiveReviewPageData, isComplete: boolean) {
  if (typeof window === "undefined") return;

  try {
    const payload: ActiveReviewWarmSnapshot = {
      version: ACTIVE_REVIEW_WARM_CACHE_VERSION,
      savedAt: Date.now(),
      deckId,
      isComplete,
      data,
    };
    window.sessionStorage.setItem(buildActiveReviewWarmCacheKey(deckId), JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
}

export function seedActiveReviewWarmCache({
  deckId,
  deckName,
  targetLang,
  supportLang,
  level,
  backToDeckHref,
}: {
  deckId: string;
  deckName: string;
  targetLang: string;
  supportLang: string;
  level: string;
  backToDeckHref: string;
}) {
  const existing = readActiveReviewWarmCache(deckId);
  const existingData = existing?.data;
  writeActiveReviewWarmCache(
    deckId,
    {
      deckId,
      deckName,
      targetLang,
      supportLang,
      level,
      backToDeckHref,
      categoryOptionsByMode: existingData?.categoryOptionsByMode ?? {
        words: [],
        sentences: [],
        ws: [],
      },
      reviewTotalsByMode: existingData?.reviewTotalsByMode ?? {
        words: 0,
        sentences: 0,
        ws: 0,
      },
    },
    existing?.isComplete ?? false
  );
}

export function writeCompleteActiveReviewWarmCache(deckId: string, data: ActiveReviewPageData) {
  writeActiveReviewWarmCache(deckId, data, true);
}

export async function warmActiveReviewPageData(deckId: string, backToDeckHref: string) {
  const cached = readActiveReviewWarmCache(deckId);
  if (cached?.isComplete) return cached.data;

  const qs = new URLSearchParams();
  if (backToDeckHref) qs.set("back", backToDeckHref);

  const res = await fetch(`/api/decks/${deckId}/active-review-dashboard?${qs.toString()}`, {
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Active review prefetch failed: ${res.status}`);
  }

  const payload = (await res.json()) as { ok?: boolean; data?: ActiveReviewPageData };
  if (!payload.ok || !payload.data) {
    throw new Error("Active review prefetch returned no data");
  }

  writeCompleteActiveReviewWarmCache(deckId, payload.data);
  return payload.data;
}
