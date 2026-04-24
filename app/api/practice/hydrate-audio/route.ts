import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hydrateCanonicalFirstAudioForPairs } from "@/lib/audio/hydrateCanonicalFirstAudio";

type PairAudioRow = {
  id: string;
  pair_template_id?: string | null;
  word_target_audio_url?: string | null;
  sentence_target_audio_url?: string | null;
};

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const targetLang = String((body as { targetLang?: unknown })?.targetLang ?? "")
    .trim()
    .toLowerCase();
  const rawPairIds = Array.isArray((body as { pairIds?: unknown[] })?.pairIds)
    ? ((body as { pairIds: unknown[] }).pairIds as unknown[])
    : [];
  const pairIds = Array.from(
    new Set(rawPairIds.map((id) => String(id ?? "").trim()).filter(Boolean))
  ).slice(0, 80);

  if (!targetLang || pairIds.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const { data: rows, error } = await supabase
    .from("pairs")
    .select("id, pair_template_id, word_target_audio_url, sentence_target_audio_url")
    .in("id", pairIds);

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load pair audio" },
      { status: 500 }
    );
  }

  const hydrated = await hydrateCanonicalFirstAudioForPairs(
    supabase,
    (rows || []) as PairAudioRow[],
    targetLang
  );

  return NextResponse.json({
    items: hydrated.map((row) => ({
      id: row.id,
      word_target_audio_url: row.word_target_audio_url ?? null,
      sentence_target_audio_url: row.sentence_target_audio_url ?? null,
    })),
  });
}
