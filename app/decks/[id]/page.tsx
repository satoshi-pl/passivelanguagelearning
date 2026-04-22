export const dynamic = "force-dynamic";
export const revalidate = 0;

import { normalizeCategoryParam } from "./practice/lib/categories";
import { redirect } from "next/navigation";
import ResponsiveNavLink from "@/app/components/ResponsiveNavLink";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import PassiveDashboardPageClient from "./PassiveDashboardPageClient";
import { getPassiveDashboardPageData } from "@/lib/passive-dashboard/pageData";
import type { PassiveDashboardMode } from "@/lib/passive-dashboard/types";

function normalizeMode(raw: unknown): PassiveDashboardMode {
  const v = (typeof raw === "string" ? raw : "").toLowerCase().trim();
  if (v === "words" || v === "ws" || v === "sentences") return v;
  return "ws";
}

function getSingleParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

type DeckDetailSearchParams = {
  mode?: string | string[];
  back?: string | string[];
  category?: string | string[];
  entry?: string | string[];
};

export default async function DeckDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<DeckDetailSearchParams>;
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
  const warmEntry = getSingleParam(sp.entry).toLowerCase() === "my_decks";

  let decodedBack = "";
  try {
    decodedBack = backParam ? decodeURIComponent(backParam) : "";
  } catch {
    decodedBack = backParam || "";
  }

  if (warmEntry) {
    return (
      <PassiveDashboardPageClient
        deckId={deckId}
        requestedBackToDecksHref={decodedBack}
        mode={mode}
        selectedCategoryFromUrl={selectedCategoryFromUrl}
        initialData={null}
        warmEntry
      />
    );
  }

  const result = await getPassiveDashboardPageData({
    supabase,
    userId: user.id,
    deckId,
    decodedBack,
  });

  if (result.kind === "not_found") {
    return (
      <div className="pll-workspace" style={{ maxWidth: 1040, margin: "24px auto", padding: "0 16px" }}>
        <ResponsiveNavLink className="pll-back-link" href="/decks" style={{ textDecoration: "none", color: "inherit" }}>
          ← Back to My decks
        </ResponsiveNavLink>
        <h1 style={{ marginTop: 12 }}>Deck not found</h1>
        <pre>{JSON.stringify({ deckId, deckErr: result.error }, null, 2)}</pre>
      </div>
    );
  }

  if (result.kind === "error") {
    return (
      <div className="pll-workspace" style={{ maxWidth: 1040, margin: "24px auto", padding: "0 16px" }}>
        <ResponsiveNavLink className="pll-back-link" href="/decks" style={{ textDecoration: "none", color: "inherit" }}>
          ← Back to My decks
        </ResponsiveNavLink>
        <h1 style={{ marginTop: 12 }}>Dashboard unavailable</h1>
        <pre>{JSON.stringify(result.error, null, 2)}</pre>
      </div>
    );
  }

  return (
    <PassiveDashboardPageClient
      deckId={deckId}
      requestedBackToDecksHref={result.data.backToDecksHref}
      mode={mode}
      selectedCategoryFromUrl={selectedCategoryFromUrl}
      initialData={result.data}
      warmEntry={false}
    />
  );
}
