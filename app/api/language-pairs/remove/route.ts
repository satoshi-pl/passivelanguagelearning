import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  targetLang?: string;
  nativeLang?: string;
};

function norm(value: string | undefined) {
  return String(value || "").trim().toLowerCase();
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const user = userData.user;
  if (userErr || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  const targetLang = norm(body?.targetLang);
  const nativeLang = norm(body?.nativeLang);

  if (!targetLang || !nativeLang) {
    return NextResponse.json({ error: "Missing targetLang or nativeLang" }, { status: 400 });
  }

  const { data: deckRows, error: deckErr } = await supabase
    .from("decks")
    .select("id")
    .eq("user_id", user.id)
    .eq("target_lang", targetLang)
    .eq("native_lang", nativeLang);

  if (deckErr) {
    return NextResponse.json({ error: deckErr.message }, { status: 500 });
  }

  const deckIds = (deckRows ?? []).map((row) => row.id).filter(Boolean);
  if (deckIds.length === 0) {
    return NextResponse.json({ ok: true, removed: false, deckCount: 0 });
  }

  const { error: favErr } = await supabase
    .from("user_favorites")
    .delete()
    .eq("user_id", user.id)
    .eq("target_lang", targetLang)
    .eq("native_lang", nativeLang);
  if (favErr) {
    return NextResponse.json({ error: favErr.message }, { status: 500 });
  }

  const { error: progressErr } = await supabase
    .from("user_pairs")
    .delete()
    .eq("user_id", user.id)
    .in("deck_id", deckIds);
  if (progressErr) {
    return NextResponse.json({ error: progressErr.message }, { status: 500 });
  }

  const { error: pairsErr } = await supabase.from("pairs").delete().in("deck_id", deckIds);
  if (pairsErr) {
    return NextResponse.json({ error: pairsErr.message }, { status: 500 });
  }

  const { error: deleteDeckErr } = await supabase
    .from("decks")
    .delete()
    .eq("user_id", user.id)
    .in("id", deckIds);
  if (deleteDeckErr) {
    return NextResponse.json({ error: deleteDeckErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, removed: true, deckCount: deckIds.length });
}

