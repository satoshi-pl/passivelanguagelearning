import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveDashboardPageData } from "@/lib/active-dashboard/pageData";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const url = new URL(request.url);
  const back = url.searchParams.get("back")?.trim() || "";

  const result = await getActiveDashboardPageData({
    supabase,
    userId: user.id,
    deckId: id,
    decodedBack: back || undefined,
  });

  if (result.kind === "not_found") {
    return NextResponse.json({ ok: false, error: "Deck not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: result.data });
}
