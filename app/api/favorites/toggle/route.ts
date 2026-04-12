import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  pairId: string;
  kind: "word" | "sentence";
  dir: "passive" | "active";
};

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const user = userData.user;

  if (userErr || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  const pairId = body?.pairId?.trim();
  const kind = body?.kind;
  const dir = body?.dir;

  if (
    !pairId ||
    (kind !== "word" && kind !== "sentence") ||
    (dir !== "passive" && dir !== "active")
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { data: pairRow, error: pairErr } = await supabase
    .from("pairs")
    .select("id, deck_id")
    .eq("id", pairId)
    .single();

  if (pairErr || !pairRow) {
    return NextResponse.json({ error: "Pair not found" }, { status: 404 });
  }

  const { data: deckRow, error: deckErr } = await supabase
    .from("decks")
    .select("target_lang, native_lang")
    .eq("id", pairRow.deck_id)
    .single();

  if (deckErr || !deckRow?.target_lang || !deckRow?.native_lang) {
    return NextResponse.json({ error: "Deck not found for pair" }, { status: 404 });
  }

  const targetLang = String(deckRow.target_lang).trim().toLowerCase();
  const nativeLang = String(deckRow.native_lang).trim().toLowerCase();

  const { data: existing, error: existErr } = await supabase
    .from("user_favorites")
    .select("user_id, pair_id, kind, dir, target_lang, native_lang")
    .eq("user_id", user.id)
    .eq("pair_id", pairId)
    .eq("kind", kind)
    .maybeSingle();

  if (existErr) {
    return NextResponse.json({ error: existErr.message }, { status: 500 });
  }

  if (existing) {
    const { error: delErr } = await supabase
      .from("user_favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("pair_id", pairId)
      .eq("kind", kind);

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    return NextResponse.json({ favorited: false });
  }

  const { error: insErr } = await supabase.from("user_favorites").insert({
    user_id: user.id,
    pair_id: pairId,
    kind,
    dir,
    target_lang: targetLang,
    native_lang: nativeLang,
  });

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ favorited: true });
}