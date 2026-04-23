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
  // Keep the hot path to one targeted DB write. The RPC derives deck ownership
  // from `pairs` and enforces sentence eligibility without a route-side read.
  const { error: rpcErr } = await supabase.rpc("write_pair_progress", {
    p_user_id: user.id,
    p_pair_id: pairId,
    p_kind: kind,
    p_dir: dir,
  });

  if (rpcErr) {
    const message = String(rpcErr.message || "");
    if (message.includes("pair_not_found") || message.includes("sentence_unavailable")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json(
      {
        error: rpcErr.message,
        hint: rpcErr.hint,
        details: rpcErr.details,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
