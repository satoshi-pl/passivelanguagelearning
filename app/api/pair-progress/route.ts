import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  pairId?: string;
  kind?: "word" | "sentence";
  dir?: "passive" | "active";
};

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const pairId = String(body.pairId || "").trim();
  const kind = body.kind;

  const dirRaw = String(body.dir || "passive").toLowerCase().trim();
  const dir: "passive" | "active" = dirRaw === "active" ? "active" : "passive";

  if (!pairId || (kind !== "word" && kind !== "sentence")) {
    return NextResponse.json({ error: "Missing pairId or invalid kind" }, { status: 400 });
  }

  // ✅ Get deck_id + sentence fields for this pair (so we can enforce sentence rules)
  const { data: pairRow, error: pairErr } = await supabase
    .from("pairs")
    .select("deck_id, sentence_target, sentence_native")
    .eq("id", pairId)
    .single();

  if (pairErr || !pairRow?.deck_id) {
    return NextResponse.json(
      { error: pairErr?.message || "Pair not found / missing deck_id" },
      { status: 400 }
    );
  }

  // ✅ Enforce: cannot mark sentence mastered if the pair has no sentence
  if (kind === "sentence") {
    const hasSentence = !!(pairRow.sentence_target && pairRow.sentence_native);
    if (!hasSentence) {
      return NextResponse.json(
        { error: "Cannot mark sentence: this pair has no sentence fields" },
        { status: 400 }
      );
    }
  }

  const deckId = String(pairRow.deck_id);
  const now = new Date().toISOString();

  // ✅ IMPORTANT:
  // Passive mastery goes to: word_mastered_at / sentence_mastered_at
  // Active mastery goes to:  word_active_mastered_at / sentence_active_mastered_at
  const fields =
    dir === "active"
      ? kind === "word"
        ? { word_active_mastered_at: now }
        : { sentence_active_mastered_at: now }
      : kind === "word"
      ? { word_mastered_at: now }
      : { sentence_mastered_at: now };

  const payload = {
    user_id: user.id,
    pair_id: pairId,
    deck_id: deckId,
    ...fields,
  };

  // ✅ UPSERT (reliable)
  const { data: saved, error: upsertErr } = await supabase
    .from("user_pairs")
    .upsert(payload, { onConflict: "user_id,deck_id,pair_id" })
    .select(
      [
        "user_id",
        "pair_id",
        "deck_id",
        "word_mastered_at",
        "sentence_mastered_at",
        "word_active_mastered_at",
        "sentence_active_mastered_at",
      ].join(",")
    )
    .single();

  if (upsertErr) {
    return NextResponse.json(
      {
        error: upsertErr.message,
        hint: upsertErr.hint,
        details: upsertErr.details,
        payload,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, saved });
}
