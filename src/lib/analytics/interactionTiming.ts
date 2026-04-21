"use client";

import { trackGaEvent } from "@/lib/analytics/ga";

type TimingPhase = "first_visual" | "usable";
type TimingParams = Record<string, string | number | boolean | null | undefined>;

const ROUTE_TIMING_KEY = "pll:pending-route-timing";

function emitPhase(interaction: string, phase: TimingPhase, durationMs: number, params?: TimingParams) {
  trackGaEvent("interaction_timing", {
    interaction,
    phase,
    duration_ms: Math.max(0, Math.round(durationMs)),
    ...(params ?? {}),
  });
}

export function emitInteractionTiming(interaction: string, startedAtMs: number, params?: TimingParams) {
  const firstVisualMs = performance.now() - startedAtMs;
  emitPhase(interaction, "first_visual", firstVisualMs, params);

  window.requestAnimationFrame(() => {
    const usableMs = performance.now() - startedAtMs;
    emitPhase(interaction, "usable", usableMs, params);
  });
}

export function emitCategorySwitchTiming(startedAtMs: number, params?: TimingParams) {
  window.requestAnimationFrame(() => {
    const firstVisualMs = performance.now() - startedAtMs;
    emitPhase("category_switch", "first_visual", firstVisualMs, params);

    window.setTimeout(() => {
      const usableMs = performance.now() - startedAtMs;
      emitPhase("category_switch", "usable", usableMs, params);
    }, 0);
  });
}

export function startRouteInteractionTiming(
  interaction: string,
  href: string,
  params?: TimingParams
) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      ROUTE_TIMING_KEY,
      JSON.stringify({
        interaction,
        href,
        startedAtEpochMs: Date.now(),
        params: params ?? {},
      })
    );
  } catch {
    // ignore storage errors
  }
}

function normalizePathAndSearch(href: string, origin: string) {
  const url = new URL(href, origin);
  const params = Array.from(url.searchParams.entries()).sort(([aKey, aVal], [bKey, bVal]) => {
    if (aKey === bKey) return aVal.localeCompare(bVal);
    return aKey.localeCompare(bKey);
  });
  const search = params.length > 0 ? `?${new URLSearchParams(params).toString()}` : "";
  return `${url.pathname}${search}`;
}

export function consumeRouteInteractionTiming() {
  if (typeof window === "undefined") return;

  try {
    const raw = window.sessionStorage.getItem(ROUTE_TIMING_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw) as {
      interaction?: string;
      href?: string;
      startedAtEpochMs?: number;
      params?: TimingParams;
    };

    const interaction = String(parsed.interaction ?? "").trim();
    const href = String(parsed.href ?? "").trim();
    const startedAtEpochMs = Number(parsed.startedAtEpochMs ?? 0);
    if (!interaction || !href || !Number.isFinite(startedAtEpochMs) || startedAtEpochMs <= 0) {
      window.sessionStorage.removeItem(ROUTE_TIMING_KEY);
      return;
    }

    const targetPathWithQuery = normalizePathAndSearch(href, window.location.origin);
    const currentPathWithQuery = normalizePathAndSearch(window.location.href, window.location.origin);
    if (targetPathWithQuery !== currentPathWithQuery) return;

    const firstVisualMs = Date.now() - startedAtEpochMs;
    emitPhase(interaction, "first_visual", firstVisualMs, parsed.params);

    window.requestAnimationFrame(() => {
      const usableMs = Date.now() - startedAtEpochMs;
      emitPhase(interaction, "usable", usableMs, parsed.params);
      window.sessionStorage.removeItem(ROUTE_TIMING_KEY);
    });
  } catch {
    // ignore parsing/storage errors
  }
}
