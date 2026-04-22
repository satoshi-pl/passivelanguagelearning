"use client";

import { useEffect, useMemo, useState } from "react";
import TrackedResponsiveNavLink from "@/app/components/TrackedResponsiveNavLink";
import ActiveDeckControls from "./ActiveDeckControls";
import { buildActiveDashboardHref, langName } from "@/lib/active-dashboard/shared";
import type {
  ActiveDashboardMode,
  ActiveDashboardPageData,
} from "@/lib/active-dashboard/types";
import {
  readActiveDashboardWarmCache,
  writeActiveDashboardWarmCache,
} from "@/lib/active-dashboard/warmCache";

type Props = {
  deckId: string;
  requestedBackToDecksHref: string;
  mode: ActiveDashboardMode;
  selectedCategoryFromUrl: string | null;
  initialData: ActiveDashboardPageData | null;
  warmEntry: boolean;
};

export default function ActiveDashboardPageClient({
  deckId,
  requestedBackToDecksHref,
  mode,
  selectedCategoryFromUrl,
  initialData,
  warmEntry,
}: Props) {
  const cachedData = useMemo(
    () => (warmEntry ? readActiveDashboardWarmCache(deckId) : null),
    [warmEntry, deckId]
  );
  const [data, setData] = useState<ActiveDashboardPageData | null>(() => initialData ?? cachedData);
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

        const res = await fetch(`/api/decks/${deckId}/active-dashboard?${qs.toString()}`, {
          credentials: "same-origin",
          cache: "no-store",
        });
        const payload = (await res.json()) as {
          ok?: boolean;
          error?: string;
          data?: ActiveDashboardPageData;
        };

        if (cancelled) return;
        if (!res.ok || !payload.ok || !payload.data) {
          throw new Error(payload.error || `Active dashboard refresh failed: ${res.status}`);
        }

        writeActiveDashboardWarmCache(deckId, payload.data);
        setData(payload.data);
        setLoadError(null);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Unable to load active dashboard";
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

    const currentOptions = currentData.categoryOptionsByMode[mode] ?? [];
    const normalizedCategory =
      selectedCategoryFromUrl && currentOptions.some((option) => option.value === selectedCategoryFromUrl)
        ? selectedCategoryFromUrl
        : null;
    const canonicalHref = buildActiveDashboardHref({
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
            source_page: "active_dashboard_error",
            destination: requestedBackToDecksHref || "/decks",
            flow: "active_learning",
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
            source_page: "active_dashboard_loading",
            destination: requestedBackToDecksHref || "/decks",
            flow: "active_learning",
          }}
          style={{ textDecoration: "none", color: "inherit" }}
        >
          ← Back to My decks
        </TrackedResponsiveNavLink>
        <div style={{ marginTop: 20, color: "var(--foreground-muted)" }}>Loading dashboard...</div>
      </div>
    );
  }

  const currentOptions = data.categoryOptionsByMode[mode] ?? [];
  const initialSelectedCategory =
    selectedCategoryFromUrl && currentOptions.some((option) => option.value === selectedCategoryFromUrl)
      ? selectedCategoryFromUrl
      : null;
  const targetLabel = langName(data.targetLang);
  const nativeLabel = langName(data.supportLang);
  const isBackToActive = data.backToDecksHref.startsWith(`/decks/${deckId}/active`);
  const isBackToPassive = data.backToDecksHref.startsWith(`/decks/${deckId}`) && !isBackToActive;
  const backLabel = isBackToActive
    ? `← Back to ${data.deckName} Active Learning`
    : isBackToPassive
      ? `← Back to ${data.deckName} Passive Learning`
      : "← Back to My decks";

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
              source_page: "active_dashboard",
              destination: data.backToDecksHref,
              flow: "active_learning",
              mode,
              category: initialSelectedCategory ?? "all",
              deck_id: deckId,
            }}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            {backLabel}
          </TrackedResponsiveNavLink>

          <div style={{ marginTop: 20 }}>
            <h1
              style={{
                marginBottom: 10,
                fontSize: "clamp(2rem, 4.6vw, 2.125rem)",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                lineHeight: 1.15,
              }}
            >
              {data.levelLabel
                ? `${targetLabel} ${data.levelLabel} — Active Learning`
                : `${targetLabel} — Active Learning`}
            </h1>

            <div style={{ marginTop: 2, color: "var(--foreground-muted)", fontSize: 15 }}>{nativeLabel}</div>

            <ActiveDeckControls
              deckId={deckId}
              deckName={data.deckName}
              targetLang={data.targetLang}
              supportLang={data.supportLang}
              level={data.levelLabel || "other"}
              mode={mode}
              backToDecksHref={data.backToDecksHref}
              initialSelectedCategory={initialSelectedCategory}
              categoryOptionsByMode={data.categoryOptionsByMode}
              overallWordsProgress={data.overallWordsProgress}
              overallSentencesProgress={data.overallSentencesProgress}
              categoryProgressByValue={data.categoryProgressByValue}
              pendingTotalsByMode={data.pendingTotalsByMode}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
