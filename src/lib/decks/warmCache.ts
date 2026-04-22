import { buildDecksHref } from "@/lib/decks/shared";
import type { DecksPageData } from "@/lib/decks/types";

const DECKS_WARM_CACHE_VERSION = 1;
const DECKS_WARM_CACHE_MAX_AGE_MS = 2 * 60 * 1000;
const DECKS_LAST_VISIBLE_MAX_AGE_MS = 15 * 60 * 1000;

type DecksSnapshot = {
  version: number;
  savedAt: number;
  data: DecksPageData;
};

const DECKS_WARM_KEY = "pll:decks:warm";
const DECKS_LAST_VISIBLE_KEY = "pll:decks:last-visible";
let decksWarmInFlightHref: string | null = null;
let decksWarmInFlightPromise: Promise<DecksPageData> | null = null;

function readDecksSnapshot(key: string, maxAgeMs: number): DecksPageData | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<DecksSnapshot>;
    if (parsed.version !== DECKS_WARM_CACHE_VERSION) return null;
    if (typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > maxAgeMs) return null;
    if (!parsed.data) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeDecksSnapshot(key: string, data: DecksPageData) {
  if (typeof window === "undefined") return;

  try {
    const payload: DecksSnapshot = {
      version: DECKS_WARM_CACHE_VERSION,
      savedAt: Date.now(),
      data,
    };
    window.sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
}

export function readDecksWarmCache() {
  return readDecksSnapshot(DECKS_WARM_KEY, DECKS_WARM_CACHE_MAX_AGE_MS);
}

export function writeDecksWarmCache(data: DecksPageData) {
  writeDecksSnapshot(DECKS_WARM_KEY, data);
}

export function readDecksLastVisibleState() {
  return readDecksSnapshot(DECKS_LAST_VISIBLE_KEY, DECKS_LAST_VISIBLE_MAX_AGE_MS);
}

export function writeDecksLastVisibleState(data: DecksPageData) {
  writeDecksSnapshot(DECKS_LAST_VISIBLE_KEY, data);
}

export async function warmDecksPageData({
  target,
  support,
  level,
}: {
  target?: string;
  support?: string;
  level?: string;
} = {}) {
  const requestedHref = buildDecksHref({ target, support, level });
  const cached = readDecksWarmCache();
  if (cached && cached.currentDecksHref === requestedHref) {
    return cached;
  }
  if (decksWarmInFlightHref === requestedHref && decksWarmInFlightPromise) {
    return decksWarmInFlightPromise;
  }

  const qs = new URLSearchParams();
  if (target) qs.set("target", target);
  if (support) qs.set("support", support);
  if (level) qs.set("level", level);

  const promise = (async () => {
    const res = await fetch(`/api/decks/page-data?${qs.toString()}`, {
      credentials: "same-origin",
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Decks warm fetch failed: ${res.status}`);
    }

    const payload = (await res.json()) as { ok?: boolean; data?: DecksPageData };
    if (!payload.ok || !payload.data) {
      throw new Error("Decks warm fetch returned no data");
    }

    writeDecksWarmCache(payload.data);
    return payload.data;
  })();

  decksWarmInFlightHref = requestedHref;
  decksWarmInFlightPromise = promise;

  try {
    return await promise;
  } finally {
    if (decksWarmInFlightPromise === promise) {
      decksWarmInFlightHref = null;
      decksWarmInFlightPromise = null;
    }
  }
}
