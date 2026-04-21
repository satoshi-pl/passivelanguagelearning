"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { consumeRouteInteractionTiming } from "@/lib/analytics/interactionTiming";

export default function RouteTimingConsumer() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    consumeRouteInteractionTiming();
  }, [pathname, searchParams]);

  return null;
}
