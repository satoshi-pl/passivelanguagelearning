import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPassiveReviewPageData } from "@/lib/passive-review/pageData";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createSupabaseServerClient();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const user = userData.user;

  if (userErr || !user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const url = new URL(req.url);

  const result = await getPassiveReviewPageData({
    supabase,
    userId: user.id,
    deckId: id,
    mode: "ws",
    backParam: (url.searchParams.get("back") ?? "").trim(),
    deckNameFromParam: "",
    targetLangFromParam: "",
    supportLangFromParam: "",
    levelLabelFromParam: "",
  });

  if (result.kind === "not_found") {
    return NextResponse.json({ ok: false, error: "Deck not found" }, { status: 404 });
  }

  if (result.kind === "error") {
    const message =
      result.error && typeof result.error === "object" && "message" in result.error
        ? String((result.error as { message?: unknown }).message ?? "Unknown error")
        : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: result.data });
}
