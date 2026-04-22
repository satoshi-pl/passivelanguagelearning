"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TrackedResponsiveNavLink from "@/app/components/TrackedResponsiveNavLink";
import RouteTimingConsumer from "@/app/components/RouteTimingConsumer";
import FavoritesDeckControls from "./FavoritesDeckControls";
import { buildFavoritesHref, langName } from "@/lib/favorites/shared";
import type { FavoritesMode, FavoritesPageData } from "@/lib/favorites/types";
import { readFavoritesWarmCache, writeFavoritesWarmCache } from "@/lib/favorites/warmCache";

type Props = {
  targetLang: string;
  requestedSupport: string;
  mode: FavoritesMode;
  selectedCategoryFromUrl: string;
  initialData: FavoritesPageData | null;
  warmEntry: boolean;
};

function normalizeCategory(selectedCategoryFromUrl: string, data: FavoritesPageData, mode: FavoritesMode) {
  const currentOptions = data.categoryOptionsByMode[mode] ?? [];
  return selectedCategoryFromUrl && currentOptions.some((option) => option.value === selectedCategoryFromUrl)
    ? selectedCategoryFromUrl
    : null;
}

export default function FavoritesPageClient({
  targetLang,
  requestedSupport,
  mode,
  selectedCategoryFromUrl,
  initialData,
  warmEntry,
}: Props) {
  const router = useRouter();
  const cachedData = useMemo(
    () => (warmEntry && requestedSupport ? readFavoritesWarmCache(targetLang, requestedSupport) : null),
    [warmEntry, requestedSupport, targetLang]
  );
  const [data, setData] = useState<FavoritesPageData | null>(() => initialData ?? cachedData);
  const [loadError, setLoadError] = useState<string | null>(null);
  const hasInitialRenderableData = !!(initialData ?? cachedData);

  useEffect(() => {
    setData(initialData ?? cachedData);
  }, [initialData, cachedData]);

  useEffect(() => {
    if (!warmEntry) return;
    if (!requestedSupport) return;

    let cancelled = false;

    const load = async () => {
      try {
        const qs = new URLSearchParams();
        qs.set("target_lang", targetLang);
        qs.set("native_lang", requestedSupport);
        qs.set("mode", mode);

        const res = await fetch(`/api/favorites/aggregates?${qs.toString()}`, {
          credentials: "same-origin",
          cache: "no-store",
        });
        const payload = (await res.json()) as {
          ok?: boolean;
          error?: string;
          redirectTo?: string;
          data?: FavoritesPageData;
        };

        if (cancelled) return;

        if (payload.redirectTo) {
          router.replace(payload.redirectTo);
          return;
        }

        if (!res.ok || !payload.ok || !payload.data) {
          throw new Error(payload.error || `Favorites refresh failed: ${res.status}`);
        }

        writeFavoritesWarmCache(targetLang, payload.data.selectedSupport, payload.data);
        setData(payload.data);
        setLoadError(null);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Unable to load favourites";
        if (!hasInitialRenderableData) {
          setLoadError(message);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [warmEntry, requestedSupport, targetLang, mode, router, hasInitialRenderableData]);

  useEffect(() => {
    if (!warmEntry || !data) return;

    const normalizedCategory = normalizeCategory(selectedCategoryFromUrl, data, mode);
    const canonicalHref = buildFavoritesHref({
      target: targetLang,
      support: data.selectedSupport,
      mode,
      category: normalizedCategory,
    });
    const currentHref = `${window.location.pathname}${window.location.search}`;
    if (currentHref !== canonicalHref) {
      window.history.replaceState(window.history.state, "", canonicalHref);
    }
  }, [warmEntry, data, selectedCategoryFromUrl, mode, targetLang]);

  const selectedSupport = data?.selectedSupport ?? requestedSupport;
  const decksHref = data?.decksHref ?? `/decks?target=${targetLang}&support=${selectedSupport}`;
  const total = data?.total ?? 0;
  const initialSelectedCategory =
    data ? normalizeCategory(selectedCategoryFromUrl, data, mode) : null;

  if (!data && loadError) {
    return (
      <div className="pll-workspace" style={{ maxWidth: 980, margin: "40px auto", padding: "0 24px" }}>
        <TrackedResponsiveNavLink
          className="pll-back-link"
          href={decksHref}
          eventName="back_navigation_click"
          interactionTiming="back_navigation"
          eventParams={{
            source_page: "favorites_error",
            destination: decksHref,
            flow: "favorites",
          }}
          style={{ textDecoration: "none", color: "var(--foreground)" }}
        >
          ← Back to My decks
        </TrackedResponsiveNavLink>
        <h1 style={{ marginTop: 12, fontSize: 30, fontWeight: 900 }}>Favourites</h1>
        <pre
          style={{
            marginTop: 12,
            border: "1px solid var(--border)",
            borderRadius: 12,
            background: "var(--surface-muted)",
            color: "var(--foreground)",
            padding: 12,
            overflow: "auto",
          }}
        >
          {loadError}
        </pre>
      </div>
    );
  }

  return (
    <div className="pll-workspace" style={{ maxWidth: 980, margin: "40px auto", padding: "0 24px" }}>
      <RouteTimingConsumer />
      <div
        className="pll-primary-card"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 16,
          background: "var(--surface-solid)",
          padding: 22,
          boxShadow: "var(--shadow)",
        }}
      >
        <div className="pll-card-inner" style={{ width: "100%", maxWidth: 900, margin: "0 auto" }}>
          <TrackedResponsiveNavLink
            className="pll-back-link"
            href={decksHref}
            eventName="back_navigation_click"
            interactionTiming="back_navigation"
            eventParams={{
              source_page: "favorites",
              destination: decksHref,
              flow: "favorites",
              mode,
              category: initialSelectedCategory ?? "all",
            }}
            style={{ textDecoration: "none", color: "var(--foreground)" }}
          >
            ← Back to My decks
          </TrackedResponsiveNavLink>

          <div style={{ marginTop: 18 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 34,
                fontWeight: 900,
                letterSpacing: "-0.03em",
                lineHeight: 1.08,
              }}
            >
              {langName(targetLang)} - Favourites
            </h1>

            <div style={{ marginTop: 8, color: "var(--foreground-muted)", fontSize: 15 }}>
              {langName(selectedSupport)}
            </div>

            <div style={{ marginTop: 8, fontSize: 13, color: "var(--foreground-muted)" }}>
              Total favourites: <b style={{ color: "var(--foreground)" }}>{total}</b>
            </div>

            {!data ? (
              <div style={{ marginTop: 14, fontSize: 13, color: "var(--foreground-muted)" }}>
                Preparing favourites...
              </div>
            ) : total === 0 ? (
              <div style={{ marginTop: 14, fontSize: 13, color: "var(--foreground-muted)" }}>
                No favourites yet for this language pair. Add some while practising.
              </div>
            ) : (
              <FavoritesDeckControls
                targetLang={targetLang}
                supportLang={selectedSupport}
                mode={mode}
                initialSelectedCategory={initialSelectedCategory}
                categoryOptionsByMode={data.categoryOptionsByMode}
                favoriteTotalsByMode={data.favoriteTotalsByMode}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
