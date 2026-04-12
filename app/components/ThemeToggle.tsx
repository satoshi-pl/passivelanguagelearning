"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "pll-theme";
const THEME_EVENT = "pll-theme-change";

type ThemeMode = "light" | "dark";

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handleChange = () => onStoreChange();

  window.addEventListener(THEME_EVENT, handleChange);
  window.addEventListener("storage", handleChange);
  mediaQuery.addEventListener("change", handleChange);

  return () => {
    window.removeEventListener(THEME_EVENT, handleChange);
    window.removeEventListener("storage", handleChange);
    mediaQuery.removeEventListener("change", handleChange);
  };
}

function readTheme(): ThemeMode {
  if (typeof document !== "undefined") {
    const fromDom = document.documentElement.dataset.theme;
    if (fromDom === "dark" || fromDom === "light") return fromDom;
  }

  if (typeof window !== "undefined") {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  return "light";
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light");

  const toggleTheme = () => {
    const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
    window.dispatchEvent(new Event(THEME_EVENT));
  };
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="theme-toggle"
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      aria-pressed={isDark}
      title={`Theme: ${theme}`}
    >
      <span className="theme-toggle__label">Dark</span>
      <span className="theme-toggle__track" aria-hidden="true">
        <span className="theme-toggle__thumb" />
      </span>
    </button>
  );
}
