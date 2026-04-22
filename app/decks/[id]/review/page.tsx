export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import ResponsiveNavLink from "@/app/components/ResponsiveNavLink";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import PassiveReviewPageClient from "./PassiveReviewPageClient";
import { getPassiveReviewPageData } from "@/lib/passive-review/pageData";
import type { PassiveReviewMode } from "@/lib/passive-review/types";

type DeckReviewSearchParams = {
  mode?: string | string[];
  back?: string | string[];
  category?: string | string[];
  deck_name?: string | string[];
  target_lang?: string | string[];
  support_lang?: string | string[];
  level_label?: string | string[];
  entry?: string | string[];
};

function normalizeMode(raw: unknown): PassiveReviewMode {
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

export default async function DeckReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<DeckReviewSearchParams>;
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
  const deckNameFromParam = getSingleParam(sp.deck_name);
  const targetLangFromParam = getSingleParam(sp.target_lang).toLowerCase();
  const supportLangFromParam = getSingleParam(sp.support_lang).toLowerCase();
  const levelLabelFromParam = getSingleParam(sp.level_label);
  const warmEntry = getSingleParam(sp.entry).toLowerCase() === "passive_dashboard";

  if (warmEntry) {
    return (
      <PassiveReviewPageClient
        deckId={deckId}
        requestedBackToDeckHref={backParam}
        mode={mode}
        selectedCategoryFromUrl={selectedCategoryFromUrl}
        initialData={null}
        warmEntry
      />
    );
  }

  const result = await getPassiveReviewPageData({
    supabase,
    userId: user.id,
    deckId,
    mode,
    backParam,
    deckNameFromParam,
    targetLangFromParam,
    supportLangFromParam,
    levelLabelFromParam,
  });

  if (result.kind === "not_found") {
    return (
      <div className="pll-workspace" style={{ maxWidth: 900, margin: "24px auto", padding: "0 16px" }}>
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
      <div className="pll-workspace" style={{ maxWidth: 900, margin: "24px auto", padding: "0 16px" }}>
        <ResponsiveNavLink className="pll-back-link" href={`/decks/${deckId}?mode=${mode}`} style={{ textDecoration: "none", color: "inherit" }}>
          ← Back to Passive Learning
        </ResponsiveNavLink>
        <h1 style={{ marginTop: 12 }}>Review unavailable</h1>
        <pre>{JSON.stringify(result.error, null, 2)}</pre>
      </div>
    );
  }

  return (
    <PassiveReviewPageClient
      deckId={deckId}
      requestedBackToDeckHref={result.data.backToDeckHref}
      mode={mode}
      selectedCategoryFromUrl={selectedCategoryFromUrl}
      initialData={result.data}
      warmEntry={false}
    />
  );
}
