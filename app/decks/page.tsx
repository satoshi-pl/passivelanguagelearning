export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import DecksPageClient from "./DecksPageClient";
import { getDecksPageData } from "@/lib/decks/pageData";
import { parseLevelSearchParam } from "@/lib/decks/shared";

function getSingleParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export default async function DecksPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createSupabaseServerClient();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) redirect("/login");

  const sp = (await searchParams) ?? {};
  const requestedTarget = getSingleParam(sp.target).toLowerCase();
  const requestedSupport = getSingleParam(sp.support).toLowerCase();
  const requestedLevel = parseLevelSearchParam(getSingleParam(sp.level));
  const warmEntry = getSingleParam(sp.entry).toLowerCase() === "home";

  if (warmEntry) {
    return (
      <DecksPageClient
        requestedTarget={requestedTarget}
        requestedSupport={requestedSupport}
        requestedLevel={requestedLevel}
        initialData={null}
        warmEntry
      />
    );
  }

  const result = await getDecksPageData({
    supabase,
    userId: user.id,
    requestedTarget,
    requestedSupport,
    requestedLevel,
  });

  if (result.kind === "setup") {
    redirect("/setup");
  }

  if (result.kind === "error") {
    return (
      <div className="pll-workspace" style={{ maxWidth: 1040, margin: "40px auto", padding: "0 24px" }}>
        <pre>{JSON.stringify(result.error, null, 2)}</pre>
      </div>
    );
  }

  return (
    <DecksPageClient
      requestedTarget={requestedTarget}
      requestedSupport={requestedSupport}
      requestedLevel={requestedLevel}
      initialData={result.data}
      warmEntry={false}
    />
  );
}
