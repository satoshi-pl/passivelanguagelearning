"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import ResponsiveNavLink from "@/app/components/ResponsiveNavLink";
import { buildDecksWarmEntryHref } from "@/lib/decks/shared";
import {
  readDecksLastVisibleState,
  readDecksWarmCache,
  warmDecksPageData,
} from "@/lib/decks/warmCache";

function getWarmHref() {
  const cached = readDecksWarmCache() ?? readDecksLastVisibleState();
  return cached ? buildDecksWarmEntryHref(cached.currentDecksHref) : "/decks";
}

export default function GoToMyDecksLink({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const initialHref = useMemo(() => getWarmHref(), []);
  const [href, setHref] = useState(initialHref);

  const warm = useCallback(async () => {
    const cached = readDecksWarmCache() ?? readDecksLastVisibleState();
    if (cached) {
      setHref(buildDecksWarmEntryHref(cached.currentDecksHref));
    }

    try {
      const warmed = await warmDecksPageData({
        target: cached?.selectedTarget,
        support: cached?.selectedSupport,
        level: cached?.selectedLevelUrl,
      });
      setHref(buildDecksWarmEntryHref(warmed.currentDecksHref));
    } catch {
      // Warm prefetch should never interrupt the landing page UI.
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void warm();
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [warm]);

  return (
    <ResponsiveNavLink
      href={href}
      className={className}
      onPointerEnter={() => void warm()}
      onPointerDown={() => void warm()}
      onTouchStart={() => void warm()}
      onClick={() => void warm()}
    >
      {children}
    </ResponsiveNavLink>
  );
}
