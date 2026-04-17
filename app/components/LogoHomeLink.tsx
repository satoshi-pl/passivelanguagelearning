"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackGaEvent } from "@/lib/analytics/ga";

function getCookie(name: string) {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&")}=([^;]*)`)
  );
  return match ? match[1] : "";
}

function readLastDecksHref() {
  try {
    const fromStorage = localStorage.getItem("pll_last_decks_href") || "";
    const fromCookie = getCookie("pll_last_decks_href") || "";
    const raw = fromStorage || fromCookie;

    if (!raw) return "/decks";

    const decoded = raw.startsWith("/decks") ? raw : decodeURIComponent(raw);
    return decoded.startsWith("/decks") ? decoded : "/decks";
  } catch {
    return "/decks";
  }
}

export default function LogoHomeLink({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [href, setHref] = useState("/decks");

  useEffect(() => {
    setHref(readLastDecksHref());
  }, [pathname, searchParams]);

  return (
    <Link
      href={href}
      prefetch={false}
      className={className}
      onClick={(event) => {
        const target = event.target as HTMLElement | null;
        const targetValue = target?.closest("[data-top-nav-target]")?.getAttribute("data-top-nav-target");
        trackGaEvent("top_nav_click", {
          target: targetValue === "logo" ? "logo" : "brand",
          location: "top_nav",
        });
      }}
    >
      {children}
    </Link>
  );
}