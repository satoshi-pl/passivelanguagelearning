import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const user = userData.user;

  if (userErr || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const url = new URL(req.url);

  const targetLang = (url.searchParams.get("target_lang") ?? "").trim().toLowerCase();
  const nativeLang = (
    url.searchParams.get("native_lang") ??
    url.searchParams.get("support") ??
    ""
  )
    .trim()
    .toLowerCase();

  if (!targetLang) {
    return NextResponse.json({ error: "Missing target_lang" }, { status: 400 });
  }

  if (!nativeLang) {
    return NextResponse.json({ error: "Missing native_lang" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("user_favorites")
    .select("pair_id, kind, dir")
    .eq("user_id", user.id)
    .eq("target_lang", targetLang)
    .eq("native_lang", nativeLang);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    items: (data ?? []).map((r) => ({
      pairId: r.pair_id,
      kind: r.kind,
      dir: r.dir,
    })),
  });
}