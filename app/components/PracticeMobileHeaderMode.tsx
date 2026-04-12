"use client";

import { useEffect } from "react";

const BODY_CLASS = "pll-mobile-practice";

/**
 * Marks the document while mounted so CSS can relax the sticky header on mobile
 * practice routes — dictionary/nav scroll away and the learning card gets more space.
 */
export function PracticeMobileHeaderMode() {
  useEffect(() => {
    document.body.classList.add(BODY_CLASS);
    return () => {
      document.body.classList.remove(BODY_CLASS);
    };
  }, []);

  return null;
}
