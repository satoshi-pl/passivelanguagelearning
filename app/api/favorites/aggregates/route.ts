import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFavoritesPageData } from "@/lib/favorites/pageData";

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const user = userData.user;

  if (userErr || !user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const url = new URL(req.url);
  const targetLang = (url.searchParams.get("target_lang") ?? "").trim().toLowerCase();
  const requestedSupport = (
    url.searchParams.get("native_lang") ??
    url.searchParams.get("support") ??
    ""
  )
    .trim()
    .toLowerCase();
  const modeParam = (url.searchParams.get("mode") ?? "ws").trim().toLowerCase();
  const mode = modeParam === "words" || modeParam === "sentences" ? modeParam : "ws";

  if (!targetLang) {
    return NextResponse.json({ ok: false, error: "Missing target_lang" }, { status: 400 });
  }

  const result = await getFavoritesPageData({
    supabase,
    userId: user.id,
    targetLang,
    requestedSupport,
    mode,
  });

  if (result.kind === "redirect") {
    return NextResponse.json({ ok: false, redirectTo: result.href }, { status: 200 });
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
