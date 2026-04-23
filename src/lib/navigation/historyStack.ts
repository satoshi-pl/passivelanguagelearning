"use client";

const HISTORY_STACK_KEY = "pll:nav-stack:v1";

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
