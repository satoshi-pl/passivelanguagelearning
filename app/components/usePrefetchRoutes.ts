"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function usePrefetchRoutes(hrefs: string[]) {
  const router = useRouter();

  useEffect(() => {
    const unique = Array.from(new Set(hrefs.filter(Boolean)));
    for (const href of unique) {
      router.prefetch(href);
    }
  }, [router, hrefs]);
}
