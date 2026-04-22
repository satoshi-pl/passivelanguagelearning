export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import ResponsiveNavLink from "@/app/components/ResponsiveNavLink";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeCategoryParam } from "../practice/lib/categories";
import ActiveDashboardPageClient from "./ActiveDashboardPageClient";
import { getActiveDashboardPageData } from "@/lib/active-dashboard/pageData";
import type { ActiveDashboardMode } from "@/lib/active-dashboard/types";

function normalizeMode(raw: unknown): ActiveDashboardMode {
  const v = (typeof raw === "string" ? raw : "").toLowerCase().trim();
  if (v === "words" || v === "ws" || v === "sentences") return v;
  return "ws";
}

function getSingleParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

type ActiveSearchParams = {
  mode?: string | string[];
  back?: string | string[];
  category?: string | string[];
  entry?: string | string[];
};

export default async function DeckActivePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<ActiveSearchParams>;
}) {
  const supabase = await createSupabaseServerClient();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) redirect("/login");

  const { id } = await params;
  const deckId = id;

  const sp = (await searchParams) ?? {};
  const mode = normalizeMode(sp.mode);
  const selectedCategoryFromUrl = normalizeCategoryParam(sp.category);
  const backParam = getSingleParam(sp.back);
  const decodedBack = backParam && backParam.startsWith("/") ? backParam : undefined;
  const warmEntry = getSingleParam(sp.entry).toLowerCase() === "passive_dashboard";

  if (warmEntry) {
    return (
      <ActiveDashboardPageClient
        deckId={deckId}
        requestedBackToDecksHref={decodedBack || ""}
        mode={mode}
        selectedCategoryFromUrl={selectedCategoryFromUrl}
        initialData={null}
        warmEntry
      />
    );
  }

  const result = await getActiveDashboardPageData({
    supabase,
    userId: user.id,
    deckId,
    decodedBack,
  });

  if (result.kind === "not_found") {
    return (
      <div className="pll-workspace" style={{ maxWidth: 1000, margin: "24px auto", padding: "0 16px" }}>
        <ResponsiveNavLink className="pll-back-link" href="/decks" style={{ textDecoration: "none", color: "inherit" }}>
          ← Back to My decks
        </ResponsiveNavLink>
        <h1 style={{ marginTop: 12 }}>Deck not found</h1>
        <pre>{JSON.stringify({ deckId, deckErr: result.error }, null, 2)}</pre>
      </div>
    );
  }

  return (
    <ActiveDashboardPageClient
      deckId={deckId}
      requestedBackToDecksHref={result.data.backToDecksHref}
      mode={mode}
      selectedCategoryFromUrl={selectedCategoryFromUrl}
      initialData={result.data}
      warmEntry={false}
    />
  );
}
