import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(
  req: Request,
  ctx: { params: { id?: string } | Promise<{ id?: string }> }
) {
  const supabase = await createSupabaseServerClient();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const params = await ctx.params;
  const deckId = String(params?.id || "").trim();

  if (!deckId) {
    return NextResponse.json({ error: "Missing deck id" }, { status: 400 });
  }

  // Reset progress for this user + this deck
  const { error } = await supabase
    .from("user_pairs")
    .delete()
    .eq("user_id", user.id)
    .eq("deck_id", deckId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
