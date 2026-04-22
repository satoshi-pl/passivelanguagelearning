"use client";

import { useEffect, useMemo, useState } from "react";
import TrackedResponsiveNavLink from "@/app/components/TrackedResponsiveNavLink";
import ActiveReviewDeckControls from "./ActiveReviewDeckControls";
import { buildActiveReviewHref } from "@/lib/active-review/shared";
import type { ActiveReviewMode, ActiveReviewPageData } from "@/lib/active-review/types";
import {
  readActiveReviewWarmCache,
  writeCompleteActiveReviewWarmCache,
} from "@/lib/active-review/warmCache";

type Props = {
  deckId: string;
  requestedBackToDeckHref: string;
  mode: ActiveReviewMode;
  selectedCategoryFromUrl: string;
  initialData: ActiveReviewPageData | null;
  warmEntry: boolean;
};

function withBackOverride(data: ActiveReviewPageData, requestedBackToDeckHref: string) {
  if (!requestedBackToDeckHref) return data;
  return { ...data, backToDeckHref: requestedBackToDeckHref };
}

export default function ActiveReviewPageClient({
  deckId,
  requestedBackToDeckHref,
  mode,
  selectedCategoryFromUrl,
  initialData,
  warmEntry,
}: Props) {
  const cachedEntry = useMemo(
    () => (warmEntry ? readActiveReviewWarmCache(deckId) : null),
    [warmEntry, deckId]
  );
  const cachedData = cachedEntry ? withBackOverride(cachedEntry.data, requestedBackToDeckHref) : null;
  const [data, setData] = useState<ActiveReviewPageData | null>(() =>
    initialData ? withBackOverride(initialData, requestedBackToDeckHref) : cachedData
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const hasInitialRenderableData = !!(initialData ?? cachedData);

  useEffect(() => {
    setData(initialData ? withBackOverride(initialData, requestedBackToDeckHref) : cachedData);
  }, [initialData, cachedData, requestedBackToDeckHref]);

  useEffect(() => {
    if (!warmEntry) return;

    let cancelled = false;

    const load = async () => {
      try {
        const qs = new URLSearchParams();
        if (requestedBackToDeckHref) qs.set("back", requestedBackToDeckHref);

        const res = await fetch(`/api/decks/${deckId}/active-review-dashboard?${qs.toString()}`, {
          credentials: "same-origin",
          cache: "no-store",
        });
        const payload = (await res.json()) as {
          ok?: boolean;
          error?: string;
          data?: ActiveReviewPageData;
        };

        if (cancelled) return;
        if (!res.ok || !payload.ok || !payload.data) {
          throw new Error(payload.error || `Active review refresh failed: ${res.status}`);
        }

        const nextData = withBackOverride(payload.data, requestedBackToDeckHref);
        writeCompleteActiveReviewWarmCache(deckId, nextData);
        setData(nextData);
        setLoadError(null);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Unable to load active review";
        if (!hasInitialRenderableData) {
          setLoadError(message);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [warmEntry, deckId, requestedBackToDeckHref, hasInitialRenderableData]);

  useEffect(() => {
    if (!warmEntry || !data) return;

    const normalizedCategory =
      selectedCategoryFromUrl &&
      (data.categoryOptionsByMode[mode] ?? []).some((option) => option.value === selectedCategoryFromUrl)
        ? selectedCategoryFromUrl
        : null;

    const canonicalHref = buildActiveReviewHref({
      deckId,
      mode,
      backToDeckHref: data.backToDeckHref,
      category: normalizedCategory,
      deckName: data.deckName,
      targetLang: data.targetLang,
      supportLang: data.supportLang,
      level: data.level,
    });
    const currentHref = `${window.location.pathname}${window.location.search}`;
    if (currentHref !== canonicalHref) {
      window.history.replaceState(window.history.state, "", canonicalHref);
    }
  }, [warmEntry, data, deckId, mode, selectedCategoryFromUrl]);

  if (!data && loadError) {
    return (
      <div className="pll-workspace" style={{ maxWidth: 1000, margin: "24px auto", padding: "0 16px" }}>
        <TrackedResponsiveNavLink
          className="pll-back-link"
          href={requestedBackToDeckHref || `/decks/${deckId}/active`}
          eventName="back_navigation_click"
          interactionTiming="back_navigation"
          eventParams={{
            source_page: "active_review_error",
            destination: requestedBackToDeckHref || `/decks/${deckId}/active`,
            flow: "active_review",
            mode,
            deck_id: deckId,
          }}
          style={{ textDecoration: "none", color: "inherit" }}
        >
          ← Back to Active Learning
        </TrackedResponsiveNavLink>
        <h1 style={{ marginTop: 12 }}>Review unavailable</h1>
        <pre>{loadError}</pre>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="pll-workspace" style={{ maxWidth: 1000, margin: "24px auto", padding: "0 16px" }}>
        <TrackedResponsiveNavLink
          className="pll-back-link"
          href={requestedBackToDeckHref || `/decks/${deckId}/active`}
          eventName="back_navigation_click"
          interactionTiming="back_navigation"
          eventParams={{
            source_page: "active_review_loading",
            destination: requestedBackToDeckHref || `/decks/${deckId}/active`,
            flow: "active_review",
            mode,
            deck_id: deckId,
          }}
          style={{ textDecoration: "none", color: "inherit" }}
        >
          ← Back to Active Learning
        </TrackedResponsiveNavLink>
        <div style={{ marginTop: 18, color: "var(--foreground-muted)" }}>Preparing review…</div>
      </div>
    );
  }

  const currentOptions = data.categoryOptionsByMode[mode] ?? [];
  const initialSelectedCategory =
    selectedCategoryFromUrl && currentOptions.some((option) => option.value === selectedCategoryFromUrl)
      ? selectedCategoryFromUrl
      : null;
  const hasAny =
    data.reviewTotalsByMode.words + data.reviewTotalsByMode.sentences + data.reviewTotalsByMode.ws > 0;

  if (!hasAny) {
    return (
      <div className="pll-workspace" style={{ maxWidth: 1000, margin: "24px auto", padding: "0 16px" }}>
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
          <div className="pll-card-inner" style={{ width: "100%", maxWidth: 920, margin: "0 auto" }}>
            <TrackedResponsiveNavLink
              className="pll-back-link"
              href={data.backToDeckHref}
              eventName="back_navigation_click"
              interactionTiming="back_navigation"
              eventParams={{
                source_page: "active_review",
                destination: data.backToDeckHref,
                flow: "active_review",
                mode,
                category: initialSelectedCategory ?? "all",
                deck_id: deckId,
              }}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              ← Back to {data.deckName} Active Learning
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
                {data.deckName} — Active Learning review
              </h1>

              <div
                style={{
                  marginTop: 28,
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  background: "var(--surface-muted)",
                  padding: 24,
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>
                  Nothing to review yet.
                </div>
                <div style={{ marginTop: 12, fontSize: 14, color: "var(--foreground-muted)" }}>
                  Master some items first in Active Learning.
                </div>
                <div style={{ marginTop: 24 }}>
                  <TrackedResponsiveNavLink
                    href={data.backToDeckHref}
                    eventName="back_navigation_click"
                    interactionTiming="back_navigation"
                    eventParams={{
                      source_page: "active_review_empty",
                      destination: data.backToDeckHref,
                      flow: "active_review",
                      mode,
                      category: initialSelectedCategory ?? "all",
                      deck_id: deckId,
                    }}
                    style={{
                      display: "inline-block",
                      padding: "10px 16px",
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "var(--surface-soft)",
                      textDecoration: "none",
                      color: "var(--foreground)",
                      fontWeight: 500,
                    }}
                  >
                    Go back
                  </TrackedResponsiveNavLink>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pll-workspace" style={{ maxWidth: 1000, margin: "24px auto", padding: "0 16px" }}>
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
        <div className="pll-card-inner" style={{ width: "100%", maxWidth: 920, margin: "0 auto" }}>
          <TrackedResponsiveNavLink
            className="pll-back-link"
            href={data.backToDeckHref}
            eventName="back_navigation_click"
            interactionTiming="back_navigation"
            eventParams={{
              source_page: "active_review",
              destination: data.backToDeckHref,
              flow: "active_review",
              mode,
              category: initialSelectedCategory ?? "all",
              deck_id: deckId,
            }}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            ← Back to {data.deckName} Active Learning
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
              {data.deckName} — Active Learning review
              {initialSelectedCategory ? ` · ${initialSelectedCategory}` : ""}
            </h1>

            <ActiveReviewDeckControls
              deckId={deckId}
              deckName={data.deckName}
              targetLang={data.targetLang}
              supportLang={data.supportLang}
              level={data.level}
              mode={mode}
              backToDeckHref={data.backToDeckHref}
              initialSelectedCategory={initialSelectedCategory}
              categoryOptionsByMode={data.categoryOptionsByMode}
              reviewTotalsByMode={data.reviewTotalsByMode}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
