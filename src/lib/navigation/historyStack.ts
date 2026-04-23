"use client";

const HISTORY_STACK_KEY = "pll:nav-stack:v1";
const PRACTICE_ORIGIN_KEY = "pll:practice-origins:v1";

function readStack() {
  if (typeof window === "undefined") return [] as string[];

  try {
    const raw = window.sessionStorage.getItem(HISTORY_STACK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function writeStack(stack: string[]) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(HISTORY_STACK_KEY, JSON.stringify(stack.slice(-20)));
  } catch {
    // ignore storage errors
  }
}

function readPracticeOrigins() {
  if (typeof window === "undefined") return {} as Record<string, string>;

  try {
    const raw = window.sessionStorage.getItem(PRACTICE_ORIGIN_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string"
      )
    );
  } catch {
    return {};
  }
}

function writePracticeOrigins(origins: Record<string, string>) {
  if (typeof window === "undefined") return;

  try {
    const entries = Object.entries(origins).slice(-20);
    window.sessionStorage.setItem(PRACTICE_ORIGIN_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // ignore storage errors
  }
}

function normalizeInternalHref(href: string) {
  if (!href || typeof window === "undefined") return null;

  try {
    if (href.startsWith("/")) {
      const url = new URL(href, window.location.origin);
      return `${url.pathname}${url.search}`;
    }

    const url = new URL(href);
    if (url.origin !== window.location.origin) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

function getCurrentHref() {
  if (typeof window === "undefined") return null;
  return `${window.location.pathname}${window.location.search}`;
}

function isPracticeHref(href: string) {
  return /\/practice(?:\?|$)/.test(href);
}

export function rememberNavigationOrigin(targetHref: string) {
  const currentHref = getCurrentHref();
  const normalizedTargetHref = normalizeInternalHref(targetHref);
  if (!currentHref || !normalizedTargetHref) return;
  if (currentHref === normalizedTargetHref) return;

  const stack = readStack();
  if (stack[stack.length - 1] === currentHref) return;
  stack.push(currentHref);
  writeStack(stack);
}

export function rememberPracticeOrigin(targetHref: string) {
  const currentHref = getCurrentHref();
  const normalizedTargetHref = normalizeInternalHref(targetHref);
  if (!currentHref || !normalizedTargetHref) return;
  if (!isPracticeHref(normalizedTargetHref)) return;

  const origins = readPracticeOrigins();
  origins[normalizedTargetHref] = currentHref;
  writePracticeOrigins(origins);
}

export function tryUseHistoryBack(targetHref: string) {
  const normalizedTargetHref = normalizeInternalHref(targetHref);
  const currentHref = getCurrentHref();
  if (!normalizedTargetHref || !currentHref || normalizedTargetHref === currentHref) {
    return false;
  }

  const stack = readStack();
  if (stack[stack.length - 1] !== normalizedTargetHref) {
    return false;
  }

  stack.pop();
  writeStack(stack);
  window.history.back();
  return true;
}

export function hasImmediateHistoryBackMatch(targetHref: string) {
  const normalizedTargetHref = normalizeInternalHref(targetHref);
  const currentHref = getCurrentHref();
  if (!normalizedTargetHref || !currentHref || normalizedTargetHref === currentHref) {
    return false;
  }

  const stack = readStack();
  return stack[stack.length - 1] === normalizedTargetHref;
}

export function getSavedPracticeOriginForCurrentHref() {
  const currentHref = getCurrentHref();
  if (!currentHref || !isPracticeHref(currentHref)) return null;

  const origins = readPracticeOrigins();
  const savedOrigin = origins[currentHref];
  return typeof savedOrigin === "string" ? savedOrigin : null;
}

export function navigateFromPractice(
  router: { replace: (href: string) => void },
  fallbackHref: string
) {
  const savedOrigin = getSavedPracticeOriginForCurrentHref();
  if (savedOrigin) {
    if (tryUseHistoryBack(savedOrigin)) {
      return savedOrigin;
    }
    router.replace(savedOrigin);
    return savedOrigin;
  }

  router.replace(fallbackHref);
  return fallbackHref;
}
