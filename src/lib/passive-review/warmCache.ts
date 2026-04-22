import type { PassiveReviewPageData } from "@/lib/passive-review/types";

const PASSIVE_REVIEW_WARM_CACHE_VERSION = 1;
const PASSIVE_REVIEW_WARM_CACHE_MAX_AGE_MS = 2 * 60 * 1000;

type PassiveReviewWarmSnapshot = {
  version: number;
  savedAt: number;
  deckId: string;
  isComplete: boolean;
  data: PassiveReviewPageData;
};

export type PassiveReviewWarmCacheEntry = {
  isComplete: boolean;
  data: PassiveReviewPageData;
};

function buildPassiveReviewWarmCacheKey(deckId: string) {
  return `pll:passive-review:warm:${deckId}`;
}

export function readPassiveReviewWarmCache(deckId: string): PassiveReviewWarmCacheEntry | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(buildPassiveReviewWarmCacheKey(deckId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<PassiveReviewWarmSnapshot>;
    if (parsed.version !== PASSIVE_REVIEW_WARM_CACHE_VERSION) return null;
    if (parsed.deckId !== deckId) return null;
    if (typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > PASSIVE_REVIEW_WARM_CACHE_MAX_AGE_MS) return null;
    if (!parsed.data || typeof parsed.isComplete !== "boolean") return null;
    return { data: parsed.data, isComplete: parsed.isComplete };
  } catch {
    return null;
  }
}

function writePassiveReviewWarmCache(deckId: string, data: PassiveReviewPageData, isComplete: boolean) {
  if (typeof window === "undefined") return;

  try {
    const payload: PassiveReviewWarmSnapshot = {
      version: PASSIVE_REVIEW_WARM_CACHE_VERSION,
      savedAt: Date.now(),
      deckId,
      isComplete,
      data,
    };
    window.sessionStorage.setItem(buildPassiveReviewWarmCacheKey(deckId), JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
}

export function seedPassiveReviewWarmCache({
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
  const existing = readPassiveReviewWarmCache(deckId);
  const existingData = existing?.data;
  writePassiveReviewWarmCache(
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

export function writeCompletePassiveReviewWarmCache(deckId: string, data: PassiveReviewPageData) {
  writePassiveReviewWarmCache(deckId, data, true);
}

export async function warmPassiveReviewPageData(deckId: string, backToDeckHref: string) {
  const cached = readPassiveReviewWarmCache(deckId);
  if (cached?.isComplete) return cached.data;

  const qs = new URLSearchParams();
  if (backToDeckHref) qs.set("back", backToDeckHref);

  const res = await fetch(`/api/decks/${deckId}/review-dashboard?${qs.toString()}`, {
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Passive review prefetch failed: ${res.status}`);
  }

  const payload = (await res.json()) as { ok?: boolean; data?: PassiveReviewPageData };
  if (!payload.ok || !payload.data) {
    throw new Error("Passive review prefetch returned no data");
  }

  writeCompletePassiveReviewWarmCache(deckId, payload.data);
  return payload.data;
}
