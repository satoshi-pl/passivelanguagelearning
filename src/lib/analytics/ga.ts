"use client";

import { sendGAEvent } from "@next/third-parties/google";

type EventParams = Record<string, string | number | boolean | null | undefined>;

function compactParams(params?: EventParams) {
  if (!params) return undefined;

  const entries = Object.entries(params).filter(([, value]) => {
    if (value === undefined || value === null) return false;
    if (typeof value === "string" && value.trim() === "") return false;
    return true;
  });

  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries);
}

export function trackGaEvent(eventName: string, params?: EventParams) {
  const payload = compactParams(params);
  try {
    sendGAEvent("event", eventName, payload ?? {});
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[ga] event dispatch failed", { eventName, payload, error });
    }
  }
}

export function normalizeSessionOptionValue(value: number) {
  return value === 0 ? "no_limit" : String(value);
}
