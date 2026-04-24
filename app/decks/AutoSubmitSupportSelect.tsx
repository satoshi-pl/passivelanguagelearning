"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Option = {
  value: string;
  label: string;
};

export default function AutoSubmitSupportSelect({
  target,
  value,
  options,
}: {
  target: string;
  value: string;
  options: Option[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, setIsPending] = useState(false);
  const pendingResetRef = useRef<number | null>(null);

  const buildHref = useCallback((nextValue: string) => {
    const qs = new URLSearchParams(searchParams.toString());

    if (target) qs.set("target", target);
    else qs.delete("target");

    if (nextValue) qs.set("support", nextValue);
    else qs.delete("support");

    // Level is pair-specific; let /decks default to the first level for the new pair.
    qs.delete("level");

    return qs.toString() ? `${pathname}?${qs.toString()}` : pathname;
  }, [pathname, searchParams, target]);

  const prefetchHref = useCallback(
    (href: string) => {
      if (!href) return;
      try {
        router.prefetch(href);
      } catch {
        // ignore prefetch failures
      }
    },
    [router]
  );

  useEffect(() => {
    if (!value) return;
    prefetchHref(buildHref(value));
  }, [value, buildHref, prefetchHref]);

  const prefetchSupportValue = useCallback(
    (nextValue: string) => {
      if (!nextValue) return;
      prefetchHref(buildHref(nextValue));
    },
    [buildHref, prefetchHref]
  );

  useEffect(() => {
    return () => {
      if (pendingResetRef.current) {
        window.clearTimeout(pendingResetRef.current);
      }
    };
  }, []);

  function handleChange(nextValue: string) {
    setIsPending(true);
    if (pendingResetRef.current) window.clearTimeout(pendingResetRef.current);
    pendingResetRef.current = window.setTimeout(() => setIsPending(false), 900);
    const next = buildHref(nextValue);
    router.replace(next);
  }

  return (
    <div
      style={{
        position: "relative",
        minWidth: 170,
      }}
      onPointerEnter={() => prefetchSupportValue(value)}
    >
      <select
        value={value}
        onFocus={() => prefetchSupportValue(value)}
        onChange={(e) => handleChange(e.target.value)}
        aria-busy={isPending || undefined}
        data-nav-pending={isPending ? "true" : "false"}
        style={{
          width: "100%",
          height: 46,
          borderRadius: 14,
          border: "1px solid var(--border)",
          background: "var(--surface-solid)",
          padding: "0 42px 0 14px",
          fontSize: 15,
          fontWeight: 700,
          color: "var(--foreground)",
          outline: "none",
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
          boxShadow: "0 1px 0 rgba(0,0,0,0.02)",
          cursor: "pointer",
          opacity: isPending ? 0.72 : 1,
          transition: "opacity 130ms ease",
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <div
        style={{
          position: "absolute",
          right: 14,
          top: "50%",
          transform: "translateY(-50%)",
          pointerEvents: "none",
          fontSize: 12,
          color: "var(--foreground-muted)",
        }}
      >
        ▼
      </div>
    </div>
  );
}
