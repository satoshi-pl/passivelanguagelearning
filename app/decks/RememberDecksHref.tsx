"use client";

import { useEffect } from "react";

export default function RememberDecksHref({ href }: { href: string }) {
  useEffect(() => {
    if (!href) return;

    const encoded = encodeURIComponent(href);

    document.cookie = [
      `pll_last_decks_href=${encoded}`,
      "path=/",
      "max-age=31536000",
      "samesite=lax",
    ].join("; ");

    try {
      localStorage.setItem("pll_last_decks_href", href);
    } catch {}
  }, [href]);

  return null;
}