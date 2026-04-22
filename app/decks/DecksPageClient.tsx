"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import ResponsiveNavLink from "@/app/components/ResponsiveNavLink";
import TrackedResponsiveNavLink from "@/app/components/TrackedResponsiveNavLink";
import RouteTimingConsumer from "@/app/components/RouteTimingConsumer";
import AutoSubmitSupportSelect from "./AutoSubmitSupportSelect";
import DecksLevelSection from "./DecksLevelSection";
import RememberDecksHref from "./RememberDecksHref";
import { buildDecksHref, langName } from "@/lib/decks/shared";
import type { DecksPageData } from "@/lib/decks/types";
import {
  readDecksLastVisibleState,
  readDecksWarmCache,
  writeDecksLastVisibleState,
  writeDecksWarmCache,
} from "@/lib/decks/warmCache";

type Props = {
  requestedTarget: string;
  requestedSupport: string;
  requestedLevel: string;
  initialData: DecksPageData | null;
  warmEntry: boolean;
};

function linkInteractionStyle(active: boolean) {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "12px 18px",
    borderRadius: 999,
    border: active ? "1px solid var(--foreground)" : "1px solid var(--border)",
    background: active ? "var(--foreground)" : "var(--surface-solid)",
    color: active ? "var(--surface-solid)" : "var(--foreground)",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 15,
    whiteSpace: "nowrap",
    minHeight: 46,
    boxShadow: active ? "none" : "0 1px 0 rgba(0,0,0,0.02)",
    transition: "opacity 130ms ease",
  } as const;
}

function FilterButton({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <ResponsiveNavLink href={href} style={linkInteractionStyle(active)}>
      {children}
    </ResponsiveNavLink>
  );
}

export default function DecksPageClient({
  requestedTarget,
  requestedSupport,
  requestedLevel,
  initialData,
  warmEntry,
}: Props) {
  const warmCachedData = useMemo(() => (warmEntry ? readDecksWarmCache() : null), [warmEntry]);
  const lastVisibleData = useMemo(() => (warmEntry ? readDecksLastVisibleState() : null), [warmEntry]);
  const [data, setData] = useState<DecksPageData | null>(() => initialData ?? warmCachedData ?? lastVisibleData);
  const [loadError, setLoadError] = useState<string | null>(null);
  const hasInitialRenderableData = !!(initialData ?? warmCachedData ?? lastVisibleData);
  const [visibleState, setVisibleState] = useState(() => ({
    selectedLevelUrl: (initialData ?? warmCachedData ?? lastVisibleData)?.selectedLevelUrl ?? requestedLevel,
    currentDecksHref:
      (initialData ?? warmCachedData ?? lastVisibleData)?.currentDecksHref ??
      buildDecksHref({
        target: requestedTarget || undefined,
        support: requestedSupport || undefined,
        level: requestedLevel || undefined,
      }),
  }));
  const handleVisibleStateChange = useCallback(
    (nextState: { selectedLevelUrl: string; currentDecksHref: string }) => {
      setVisibleState((currentState) =>
        currentState.selectedLevelUrl === nextState.selectedLevelUrl &&
        currentState.currentDecksHref === nextState.currentDecksHref
          ? currentState
          : nextState
      );
    },
    []
  );

  useEffect(() => {
    const next = initialData ?? warmCachedData ?? lastVisibleData;
    setData(next);
  }, [initialData, warmCachedData, lastVisibleData]);

  useEffect(() => {
    if (!data) return;
    setVisibleState({
      selectedLevelUrl: data.selectedLevelUrl,
      currentDecksHref: data.currentDecksHref,
    });
  }, [data]);

  useEffect(() => {
    if (!warmEntry) return;

    let cancelled = false;

    const load = async () => {
      try {
        const qs = new URLSearchParams();
        if (requestedTarget) qs.set("target", requestedTarget);
        if (requestedSupport) qs.set("support", requestedSupport);
        if (requestedLevel) qs.set("level", requestedLevel);

        const res = await fetch(`/api/decks/page-data?${qs.toString()}`, {
          credentials: "same-origin",
          cache: "no-store",
        });
        const payload = (await res.json()) as {
          ok?: boolean;
          error?: string;
          redirect?: string;
          data?: DecksPageData;
        };

        if (cancelled) return;
        if (payload.redirect) {
          window.location.replace(payload.redirect);
          return;
        }
        if (!res.ok || !payload.ok || !payload.data) {
          throw new Error(payload.error || `Decks refresh failed: ${res.status}`);
        }

        writeDecksWarmCache(payload.data);
        setData(payload.data);
        setLoadError(null);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Unable to load decks";
        if (!hasInitialRenderableData) {
          setLoadError(message);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [warmEntry, requestedTarget, requestedSupport, requestedLevel, hasInitialRenderableData]);

  useEffect(() => {
    if (!data) return;
    writeDecksLastVisibleState({
      ...data,
      selectedLevelUrl: visibleState.selectedLevelUrl || data.selectedLevelUrl,
      currentDecksHref: visibleState.currentDecksHref || data.currentDecksHref,
    });
  }, [data, visibleState]);

  useEffect(() => {
    if (!warmEntry || !data) return;
    const currentHref = `${window.location.pathname}${window.location.search}`;
    if (currentHref !== data.currentDecksHref) {
      window.history.replaceState(window.history.state, "", data.currentDecksHref);
    }
  }, [warmEntry, data]);

  if (!data && loadError) {
    return (
      <div className="pll-workspace" style={{ maxWidth: 1040, margin: "40px auto", padding: "0 24px" }}>
        <RouteTimingConsumer />
        <h1 style={{ marginTop: 0 }}>My decks unavailable</h1>
        <pre>{loadError}</pre>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="pll-workspace" style={{ maxWidth: 1040, margin: "40px auto", padding: "0 24px" }}>
        <RouteTimingConsumer />
        <div style={{ color: "var(--foreground-muted)" }}>Loading decks...</div>
      </div>
    );
  }

  return (
    <div className="pll-workspace" style={{ maxWidth: 1040, margin: "40px auto", padding: "0 24px" }}>
      <RouteTimingConsumer />
      <RememberDecksHref href={visibleState.currentDecksHref || data.currentDecksHref} />

      <div
        style={{
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 34,
            fontWeight: 900,
            letterSpacing: "-0.03em",
            lineHeight: 1.08,
            color: "var(--foreground)",
          }}
        >
          My decks
        </h1>

        <TrackedResponsiveNavLink
          href="/decks/add-pair"
          eventName="add_language_pair_click"
          eventParams={{ location: "decks_page" }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "10px 14px",
            borderRadius: 999,
            border: "1px solid var(--border)",
            background: "var(--surface-solid)",
            color: "var(--foreground)",
            textDecoration: "none",
            fontWeight: 800,
            fontSize: 14,
            whiteSpace: "nowrap",
            boxShadow: "0 1px 0 rgba(0,0,0,0.02)",
          }}
        >
          Add language pair
        </TrackedResponsiveNavLink>
      </div>

      <div
        style={{
          marginBottom: 18,
          display: "flex",
          justifyContent: "flex-start",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            justifyContent: "center",
            alignItems: "flex-start",
            gap: 34,
            flexWrap: "wrap",
            padding: "12px 18px",
            borderRadius: 18,
            background: "var(--surface-muted)",
            border: "1px solid var(--border)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
            width: "fit-content",
            maxWidth: "100%",
            color: "var(--foreground)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: "fit-content",
            }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 800,
                marginBottom: 8,
                textAlign: "center",
                color: "var(--foreground)",
              }}
            >
              I want to learn
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              {data.targetOptions.map((target) => {
                const supportsForTarget = data.supportOptionsByTarget[target] ?? [];
                const supportForLink = supportsForTarget.includes(data.selectedSupport)
                  ? data.selectedSupport
                  : supportsForTarget[0] ?? "";

                return (
                  <FilterButton
                    key={target}
                    href={buildDecksHref({
                      target,
                      support: supportForLink,
                    })}
                    active={target === data.selectedTarget}
                  >
                    {langName(target)}
                  </FilterButton>
                );
              })}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: "fit-content",
            }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 800,
                marginBottom: 8,
                textAlign: "center",
                color: "var(--foreground)",
              }}
            >
              From
            </div>

            <AutoSubmitSupportSelect
              target={data.selectedTarget}
              value={data.selectedSupport}
              options={data.availableSupportsForSelectedTarget.map((support) => ({
                value: support,
                label: langName(support),
              }))}
            />
          </div>
        </div>
      </div>

      <DecksLevelSection
        targetLang={data.selectedTarget}
        supportLang={data.selectedSupport}
        levelOptions={data.levelOptions}
        initialSelectedLevel={visibleState.selectedLevelUrl || data.selectedLevelUrl}
        pairDecks={data.pairDecks}
        progressByDeck={data.progressByDeck}
        favoritesHref={data.favoritesHref}
        favoritesTotal={data.favoritesTotal}
        onVisibleStateChange={handleVisibleStateChange}
      />
    </div>
  );
}
