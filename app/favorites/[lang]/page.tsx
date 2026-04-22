export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import TrackedResponsiveNavLink from "@/app/components/TrackedResponsiveNavLink";
import FavoritesPageClient from "./FavoritesPageClient";
import { getFavoritesPageData } from "@/lib/favorites/pageData";
import type { FavoritesMode } from "@/lib/favorites/types";

function normalizeMode(raw: unknown): FavoritesMode {
  const v = (typeof raw === "string" ? raw : "").toLowerCase().trim();
  if (v === "words" || v === "ws" || v === "sentences") return v;
  return "ws";
}

function normalizeCategoryParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function getSingleParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function ErrorBlock({
  href,
  error,
}: {
  href: string;
  error: unknown;
}) {
  return (
    <div className="pll-workspace" style={{ maxWidth: 980, margin: "40px auto", padding: "0 24px" }}>
      <TrackedResponsiveNavLink
        className="pll-back-link"
        href={href}
        eventName="back_navigation_click"
        interactionTiming="back_navigation"
        eventParams={{
          source_page: "favorites_error",
          destination: href,
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
        {JSON.stringify(error, null, 2)}
      </pre>
    </div>
  );
}

export default async function FavoritesLangPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createSupabaseServerClient();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) redirect("/login");

  const { lang } = await params;
  const targetLang = (lang ?? "").toLowerCase().trim();
  if (!targetLang) redirect("/decks");

  const sp = (await searchParams) ?? {};
  const mode = normalizeMode(sp.mode);
  const selectedCategoryFromUrl = normalizeCategoryParam(sp.category);
  const requestedSupport = getSingleParam(sp.support).toLowerCase();
  const warmEntry = getSingleParam(sp.entry).toLowerCase() === "my_decks";

  if (warmEntry && requestedSupport) {
    return (
      <FavoritesPageClient
        targetLang={targetLang}
        requestedSupport={requestedSupport}
        mode={mode}
        selectedCategoryFromUrl={selectedCategoryFromUrl}
        initialData={null}
        warmEntry
      />
    );
  }

  const result = await getFavoritesPageData({
    supabase,
    userId: user.id,
    targetLang,
    requestedSupport,
    mode,
  });

  if (result.kind === "redirect") {
    redirect(result.href);
  }

  if (result.kind === "error") {
    return <ErrorBlock href={result.href} error={result.error} />;
  }

  return (
    <FavoritesPageClient
      targetLang={targetLang}
      requestedSupport={result.data.selectedSupport}
      mode={mode}
      selectedCategoryFromUrl={selectedCategoryFromUrl}
      initialData={result.data}
      warmEntry={false}
    />
  );
}
