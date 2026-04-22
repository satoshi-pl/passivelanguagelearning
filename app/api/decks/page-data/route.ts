import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDecksPageData } from "@/lib/decks/pageData";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const result = await getDecksPageData({
    supabase,
    userId: user.id,
    requestedTarget: url.searchParams.get("target")?.trim() || undefined,
    requestedSupport: url.searchParams.get("support")?.trim() || undefined,
    requestedLevel: url.searchParams.get("level")?.trim() || undefined,
  });

  if (result.kind === "setup") {
    return NextResponse.json({ ok: false, error: "No decks found", redirect: "/setup" }, { status: 409 });
  }

  if (result.kind === "error") {
    return NextResponse.json({ ok: false, error: "Unable to load decks" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: result.data });
}
