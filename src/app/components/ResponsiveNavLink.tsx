"use client";

import Link, { type LinkProps } from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type AnchorProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">;

type Props = LinkProps &
  AnchorProps & {
    pendingClassName?: string;
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
    setPending(true);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setPending(false), 900);
  };

  const primePrefetch = () => {
    if (!hrefString) return;
    router.prefetch(hrefString);
  };

  return (
    <Link
      href={href}
      className={[className, pending ? pendingClassName : ""].filter(Boolean).join(" ")}
      data-nav-pending={pending ? "true" : "false"}
      aria-busy={pending || undefined}
      onPointerDown={(e) => {
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
        armPending();
        onClick?.(e);
      }}
      {...props}
    />
  );
}

