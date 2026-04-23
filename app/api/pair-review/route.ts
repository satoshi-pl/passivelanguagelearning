import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  pairId?: string;
  deckId?: string;
  stage?: "word" | "sentence";
  dir?: "active" | "passive";
};

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const pairId = String(body.pairId || "").trim();
  const deckId = String(body.deckId || "").trim();
  const stage = body.stage;
  const dir = body.dir;

  if (!pairId || !deckId || (stage !== "word" && stage !== "sentence") || (dir !== "active" && dir !== "passive")) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { error: rpcErr } = await supabase.rpc("write_pair_review", {
    p_user_id: user.id,
    p_pair_id: pairId,
    p_deck_id: deckId,
    p_stage: stage,
    p_dir: dir,
  });

  if (rpcErr) {
    return NextResponse.json(
      { error: rpcErr.message, hint: rpcErr.hint, details: rpcErr.details },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
