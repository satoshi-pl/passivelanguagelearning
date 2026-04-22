"use client";

import { useEffect, useMemo, useState } from "react";
import TrackedResponsiveNavLink from "@/app/components/TrackedResponsiveNavLink";
import PassiveDeckControls from "./PassiveDeckControls";
import { buildPassiveDashboardHref, langName } from "@/lib/passive-dashboard/shared";
import type {
  PassiveDashboardMode,
  PassiveDashboardPageData,
} from "@/lib/passive-dashboard/types";
import {
  readPassiveDashboardWarmCache,
  writePassiveDashboardWarmCache,
} from "@/lib/passive-dashboard/warmCache";

type Props = {
  deckId: string;
  requestedBackToDecksHref: string;
  mode: PassiveDashboardMode;
  selectedCategoryFromUrl: string | null;
  initialData: PassiveDashboardPageData | null;
  warmEntry: boolean;
};

export default function PassiveDashboardPageClient({
  deckId,
  requestedBackToDecksHref,
  mode,
  selectedCategoryFromUrl,
  initialData,
  warmEntry,
}: Props) {
  const cachedData = useMemo(
    () => (warmEntry ? readPassiveDashboardWarmCache(deckId) : null),
    [warmEntry, deckId]
  );
  const [data, setData] = useState<PassiveDashboardPageData | null>(() => initialData ?? cachedData);
  const [loadError, setLoadError] = useState<string | null>(null);
  const hasInitialRenderableData = !!(initialData ?? cachedData);

  useEffect(() => {
    setData(initialData ?? cachedData);
  }, [initialData, cachedData]);

  useEffect(() => {
    if (!warmEntry) return;

    let cancelled = false;

    const load = async () => {
      try {
        const qs = new URLSearchParams();
        if (requestedBackToDecksHref) qs.set("back", requestedBackToDecksHref);

        const res = await fetch(`/api/decks/${deckId}/dashboard?${qs.toString()}`, {
          credentials: "same-origin",
          cache: "no-store",
        });
        const payload = (await res.json()) as {
          ok?: boolean;
          error?: string;
          data?: PassiveDashboardPageData;
        };

        if (cancelled) return;
        if (!res.ok || !payload.ok || !payload.data) {
          throw new Error(payload.error || `Dashboard refresh failed: ${res.status}`);
        }

        writePassiveDashboardWarmCache(deckId, payload.data);
        setData(payload.data);
        setLoadError(null);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Unable to load dashboard";
        if (!hasInitialRenderableData) {
          setLoadError(message);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [warmEntry, deckId, requestedBackToDecksHref, hasInitialRenderableData]);

  useEffect(() => {
    if (!warmEntry) return;

    const currentData = data;
    if (!currentData) return;

    const normalizedCategory =
      selectedCategoryFromUrl && currentData.categoryProgressByValue[selectedCategoryFromUrl]
        ? selectedCategoryFromUrl
        : null;
    const canonicalHref = buildPassiveDashboardHref({
      deckId,
      mode,
      backToDecksHref: currentData.backToDecksHref,
      category: normalizedCategory,
    });
    const currentHref = `${window.location.pathname}${window.location.search}`;
    if (currentHref !== canonicalHref) {
      window.history.replaceState(window.history.state, "", canonicalHref);
    }
  }, [warmEntry, data, deckId, mode, selectedCategoryFromUrl]);

  if (!data && loadError) {
    return (
      <div className="pll-workspace" style={{ maxWidth: 1040, margin: "24px auto", padding: "0 16px" }}>
        <TrackedResponsiveNavLink
          className="pll-back-link"
          href={requestedBackToDecksHref || "/decks"}
          eventName="back_navigation_click"
          interactionTiming="back_navigation"
          eventParams={{
            source_page: "passive_dashboard_error",
            destination: requestedBackToDecksHref || "/decks",
            flow: "passive_learning",
          }}
          style={{ textDecoration: "none", color: "inherit" }}
        >
          ← Back to My decks
        </TrackedResponsiveNavLink>
        <h1 style={{ marginTop: 12 }}>Dashboard unavailable</h1>
        <pre>{loadError}</pre>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="pll-workspace" style={{ maxWidth: 1040, margin: "24px auto", padding: "0 16px" }}>
        <TrackedResponsiveNavLink
          className="pll-back-link"
          href={requestedBackToDecksHref || "/decks"}
          eventName="back_navigation_click"
          interactionTiming="back_navigation"
          eventParams={{
            source_page: "passive_dashboard_loading",
            destination: requestedBackToDecksHref || "/decks",
            flow: "passive_learning",
          }}
          style={{ textDecoration: "none", color: "inherit" }}
        >
          ← Back to My decks
        </TrackedResponsiveNavLink>
        <div style={{ marginTop: 20, color: "var(--foreground-muted)" }}>Loading dashboard...</div>
      </div>
    );
  }

  const initialSelectedCategory =
    selectedCategoryFromUrl && data.categoryProgressByValue[selectedCategoryFromUrl]
      ? selectedCategoryFromUrl
      : null;
  const targetLabel = langName(data.targetLang);
  const nativeLabel = langName(data.supportLang);

  return (
    <div className="pll-workspace" style={{ maxWidth: 1040, margin: "24px auto", padding: "0 16px" }}>
      <div
        className="pll-primary-card"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 16,
          background: "var(--surface-solid)",
          color: "var(--foreground)",
          padding: 18,
          boxShadow: "var(--shadow)",
        }}
      >
        <div className="pll-card-inner" style={{ width: "100%", maxWidth: 940, margin: "0 auto" }}>
          <TrackedResponsiveNavLink
            className="pll-back-link"
            href={data.backToDecksHref}
            eventName="back_navigation_click"
            interactionTiming="back_navigation"
            eventParams={{
              source_page: "passive_dashboard",
              destination: data.backToDecksHref,
              flow: "passive_learning",
              mode,
              category: initialSelectedCategory ?? "all",
              deck_id: deckId,
            }}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            ← Back to My decks
          </TrackedResponsiveNavLink>

          <div style={{ marginTop: 20 }}>
            <h1
              style={{
                margin: 0,
                fontSize: "clamp(2rem, 4.6vw, 2.125rem)",
                fontWeight: 900,
                letterSpacing: "-0.03em",
                lineHeight: 1.08,
              }}
            >
              {data.levelLabel
                ? `${targetLabel} ${data.levelLabel} - Passive Learning`
                : `${targetLabel} - Passive Learning`}
            </h1>

            <div style={{ marginTop: 8, color: "var(--foreground-muted)", fontSize: 15 }}>
              {nativeLabel}
            </div>

            <PassiveDeckControls
              deckId={deckId}
              deckName={data.deckName}
              targetLang={data.targetLang}
              supportLang={data.supportLang}
              level={data.levelLabel || "other"}
              mode={mode}
              backToDecksHref={data.backToDecksHref}
              initialSelectedCategory={initialSelectedCategory}
              categoryOptions={data.categoryOptions}
              overallWordsProgress={data.overallWordsProgress}
              overallSentencesProgress={data.overallSentencesProgress}
              categoryProgressByValue={data.categoryProgressByValue}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
