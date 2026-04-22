"use client";

import Link, { type LinkProps } from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

type AnchorProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">;

type Props = LinkProps &
  AnchorProps & {
    pendingClassName?: string;
    pendingDurationMs?: number;
  };

function toHrefString(href: LinkProps["href"]) {
  if (typeof href === "string") return href;
  if (href instanceof URL) return href.toString();
  const pathname = href.pathname ?? "";
  const query = href.query ? new URLSearchParams(href.query as Record<string, string>).toString() : "";
  return query ? `${pathname}?${query}` : pathname;
}

export default function ResponsiveNavLink({
  href,
  className,
  pendingClassName = "nav-link-pending",
  pendingDurationMs = 700,
  onClick,
  onPointerDown,
  onPointerEnter,
  onTouchStart,
  ...props
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const hrefString = useMemo(() => toHrefString(href), [href]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const armPending = () => {
    try {
      flushSync(() => {
        setPending(true);
      });
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setPending(false), pendingDurationMs);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[responsive-nav-link] pending state failed", { href: hrefString, error });
      }
    }
  };

  const primePrefetch = () => {
    if (!hrefString) return;
    try {
      router.prefetch(hrefString);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[responsive-nav-link] prefetch failed", { href: hrefString, error });
      }
    }
  };

  return (
    <Link
      href={href}
      className={[className, pending ? pendingClassName : ""].filter(Boolean).join(" ")}
      data-nav-pending={pending ? "true" : "false"}
      aria-busy={pending || undefined}
      onPointerDown={(e) => {
        primePrefetch();
        armPending();
        onPointerDown?.(e);
      }}
      onPointerEnter={(e) => {
        primePrefetch();
        onPointerEnter?.(e);
      }}
      onTouchStart={(e) => {
        primePrefetch();
        armPending();
        onTouchStart?.(e);
      }}
      onClick={(e) => {
        primePrefetch();
        armPending();
        onClick?.(e);
      }}
      {...props}
    />
  );
}

