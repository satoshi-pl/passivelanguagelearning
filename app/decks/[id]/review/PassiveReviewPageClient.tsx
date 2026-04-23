"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TrackedResponsiveNavLink from "@/app/components/TrackedResponsiveNavLink";
import ReviewDeckControls from "./ReviewDeckControls";
import { buildPassiveReviewHref } from "@/lib/passive-review/shared";
import type { PassiveReviewMode, PassiveReviewPageData } from "@/lib/passive-review/types";
import {
  readPassiveReviewWarmCache,
  writeCompletePassiveReviewWarmCache,
} from "@/lib/passive-review/warmCache";

type Props = {
  deckId: string;
  requestedBackToDeckHref: string;
  mode: PassiveReviewMode;
  selectedCategoryFromUrl: string;
  initialData: PassiveReviewPageData | null;
  warmEntry: boolean;
};

function withBackOverride(data: PassiveReviewPageData, requestedBackToDeckHref: string) {
  if (!requestedBackToDeckHref) return data;
  return { ...data, backToDeckHref: requestedBackToDeckHref };
}

export default function PassiveReviewPageClient({
  deckId,
  requestedBackToDeckHref,
  mode,
  selectedCategoryFromUrl,
  initialData,
  warmEntry,
}: Props) {
  const router = useRouter();
  const cachedEntry = useMemo(
    () => (warmEntry ? readPassiveReviewWarmCache(deckId) : null),
    [warmEntry, deckId]
  );
  const cachedData = cachedEntry ? withBackOverride(cachedEntry.data, requestedBackToDeckHref) : null;
  const [data, setData] = useState<PassiveReviewPageData | null>(() =>
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

        const res = await fetch(`/api/decks/${deckId}/review-dashboard?${qs.toString()}`, {
          credentials: "same-origin",
          cache: "no-store",
        });
        const payload = (await res.json()) as {
          ok?: boolean;
          error?: string;
          data?: PassiveReviewPageData;
        };

        if (cancelled) return;
        if (!res.ok || !payload.ok || !payload.data) {
          throw new Error(payload.error || `Review refresh failed: ${res.status}`);
        }

        const nextData = withBackOverride(payload.data, requestedBackToDeckHref);
        writeCompletePassiveReviewWarmCache(deckId, nextData);
        setData(nextData);
        setLoadError(null);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Unable to load review";
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

    const canonicalHref = buildPassiveReviewHref({
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
      router.replace(canonicalHref, { scroll: false });
    }
  }, [warmEntry, data, deckId, mode, selectedCategoryFromUrl, router]);

  if (!data && loadError) {
    return (
      <div className="pll-workspace" style={{ maxWidth: 900, margin: "24px auto", padding: "0 16px" }}>
        <TrackedResponsiveNavLink
          className="pll-back-link"
          href={requestedBackToDeckHref || `/decks/${deckId}`}
          eventName="back_navigation_click"
          interactionTiming="back_navigation"
          eventParams={{
            source_page: "passive_review_error",
            destination: requestedBackToDeckHref || `/decks/${deckId}`,
            flow: "passive_review",
            mode,
            deck_id: deckId,
          }}
          style={{ textDecoration: "none", color: "inherit" }}
        >
          ← Back to Passive Learning
        </TrackedResponsiveNavLink>
        <h1 style={{ marginTop: 12 }}>Review unavailable</h1>
        <pre>{loadError}</pre>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="pll-workspace" style={{ maxWidth: 900, margin: "24px auto", padding: "0 16px" }}>
        <TrackedResponsiveNavLink
          className="pll-back-link"
          href={requestedBackToDeckHref || `/decks/${deckId}`}
          eventName="back_navigation_click"
          interactionTiming="back_navigation"
          eventParams={{
            source_page: "passive_review_loading",
            destination: requestedBackToDeckHref || `/decks/${deckId}`,
            flow: "passive_review",
            mode,
            deck_id: deckId,
          }}
          style={{ textDecoration: "none", color: "inherit" }}
        >
          ← Back to Passive Learning
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
                source_page: "passive_review",
                destination: data.backToDeckHref,
                flow: "passive_review",
                mode,
                category: initialSelectedCategory ?? "all",
                deck_id: deckId,
              }}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              ← Back to {data.deckName} Passive Learning
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
                {data.deckName} — Passive Learning review
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
                  Master some items first in Passive Learning.
                </div>
                <div style={{ marginTop: 24 }}>
                  <TrackedResponsiveNavLink
                    href={data.backToDeckHref}
                    eventName="back_navigation_click"
                    interactionTiming="back_navigation"
                    eventParams={{
                      source_page: "passive_review_empty",
                      destination: data.backToDeckHref,
                      flow: "passive_review",
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
    <div className="pll-workspace" style={{ maxWidth: 900, margin: "24px auto", padding: "0 16px" }}>
      <div
        className="pll-primary-card"
        style={{
          border: "1px solid var(--border)",
          borderRadius: 16,
          background: "var(--surface-solid)",
          color: "var(--foreground)",
          padding: 22,
          boxShadow: "var(--shadow)",
        }}
      >
        <div className="pll-card-inner" style={{ width: "100%", maxWidth: 820, margin: "0 auto" }}>
          <TrackedResponsiveNavLink
            className="pll-back-link"
            href={data.backToDeckHref}
            eventName="back_navigation_click"
            interactionTiming="back_navigation"
            eventParams={{
              source_page: "passive_review",
              destination: data.backToDeckHref,
              flow: "passive_review",
              mode,
              category: initialSelectedCategory ?? "all",
              deck_id: deckId,
            }}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            ← Back to {data.deckName} Passive Learning
          </TrackedResponsiveNavLink>

          <div style={{ marginTop: 18 }}>
            <h1
              style={{
                marginBottom: 8,
                fontSize: "clamp(2rem, 4.6vw, 2.125rem)",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                lineHeight: 1.15,
              }}
            >
              {data.deckName} — Passive Learning review
              {initialSelectedCategory ? ` · ${initialSelectedCategory}` : ""}
            </h1>

            <ReviewDeckControls
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
