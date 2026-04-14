import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Server is missing Supabase admin configuration" }, { status: 500 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

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

  const { data: deckRows, error: deckErr } = await admin
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

  const { error: favErr } = await admin
    .from("user_favorites")
    .delete()
    .eq("user_id", user.id)
    .eq("target_lang", targetLang)
    .eq("native_lang", nativeLang);
  if (favErr) {
    return NextResponse.json({ error: favErr.message }, { status: 500 });
  }

  const { error: progressErr } = await admin
    .from("user_pairs")
    .delete()
    .eq("user_id", user.id)
    .in("deck_id", deckIds);
  if (progressErr) {
    return NextResponse.json({ error: progressErr.message }, { status: 500 });
  }

  const { error: pairsErr } = await admin.from("pairs").delete().in("deck_id", deckIds);
  if (pairsErr) {
    return NextResponse.json({ error: pairsErr.message }, { status: 500 });
  }

  const { count: remainingPairs, error: remainingPairsErr } = await admin
    .from("pairs")
    .select("id", { count: "exact", head: true })
    .in("deck_id", deckIds);
  if (remainingPairsErr) {
    return NextResponse.json({ error: remainingPairsErr.message }, { status: 500 });
  }
  if ((remainingPairs ?? 0) > 0) {
    return NextResponse.json(
      { error: `Language pair deletion aborted: ${remainingPairs} pairs rows still remain` },
      { status: 500 }
    );
  }

  const { error: deleteDeckErr } = await admin
    .from("decks")
    .delete()
    .eq("user_id", user.id)
    .in("id", deckIds);
  if (deleteDeckErr) {
    return NextResponse.json({ error: deleteDeckErr.message }, { status: 500 });
  }

  const [{ count: remainingUserPairs, error: remainingUserPairsErr }, { count: remainingDecks, error: remainingDecksErr }] =
    await Promise.all([
      admin.from("user_pairs").select("pair_id", { count: "exact", head: true }).eq("user_id", user.id).in("deck_id", deckIds),
      admin.from("decks").select("id", { count: "exact", head: true }).eq("user_id", user.id).in("id", deckIds),
    ]);

  if (remainingUserPairsErr) {
    return NextResponse.json({ error: remainingUserPairsErr.message }, { status: 500 });
  }
  if (remainingDecksErr) {
    return NextResponse.json({ error: remainingDecksErr.message }, { status: 500 });
  }
  if ((remainingUserPairs ?? 0) > 0 || (remainingDecks ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          "Language pair deletion incomplete after validation",
        remainingUserPairs: remainingUserPairs ?? 0,
        remainingDecks: remainingDecks ?? 0,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    removed: true,
    deckCount: deckIds.length,
    remainingUserPairs: 0,
    remainingPairs: 0,
    remainingDecks: 0,
  });
}

