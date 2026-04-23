import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Body = {
  pairId?: string;
  kind?: "word" | "sentence";
  dir?: "passive" | "active";
};

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const user = userData.user;

  if (userErr || !user) {
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
  const dir = body.dir;

  if (
    !pairId ||
    (kind !== "word" && kind !== "sentence") ||
    (dir !== "passive" && dir !== "active")
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { data, error: rpcErr } = await supabase.rpc("toggle_favorite", {
    p_user_id: user.id,
    p_pair_id: pairId,
    p_kind: kind,
    p_dir: dir,
  });

  if (rpcErr) {
    const message = String(rpcErr.message || "");
    if (message.includes("pair_not_found") || message.includes("deck_not_found_for_pair")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json(
      { error: rpcErr.message, hint: rpcErr.hint, details: rpcErr.details },
      { status: 500 }
    );
  }

  return NextResponse.json({ favorited: !!data });
}