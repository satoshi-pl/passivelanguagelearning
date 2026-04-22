"use client";

import Link from "next/link";
import { trackGaEvent } from "@/lib/analytics/ga";

export default function LogoHomeLink({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href="/"
      prefetch={false}
      className={className}
      onClick={(event) => {
        try {
          const target = event.target instanceof Element ? event.target : null;
          const targetValue = target?.closest("[data-top-nav-target]")?.getAttribute("data-top-nav-target");
          trackGaEvent("top_nav_click", {
            target: targetValue === "logo" ? "logo" : "brand",
            location: "top_nav",
          });
        } catch (error) {
          if (process.env.NODE_ENV === "development") {
            console.warn("[logo-home-link] click tracking failed", { error });
          }
        }
      }}
    >
      {children}
    </Link>
  );
}
