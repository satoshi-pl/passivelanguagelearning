import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  pairId: string;
  deckId: string;
  stage: "word" | "sentence";
  dir: "active" | "passive";
};

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as Body | null;
    if (!body?.pairId || !body?.deckId || !body?.stage || !body?.dir) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const col =
      body.stage === "word"
        ? body.dir === "active"
          ? "word_active_last_reviewed_at"
          : "word_last_reviewed_at"
        : body.dir === "active"
        ? "sentence_active_last_reviewed_at"
        : "sentence_last_reviewed_at";

    const { error } = await supabase
      .from("user_pairs")
      .update({ [col]: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("deck_id", body.deckId)
      .eq("pair_id", body.pairId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
