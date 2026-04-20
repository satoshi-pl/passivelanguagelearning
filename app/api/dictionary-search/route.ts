// app/api/dictionary-search/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hydrateCanonicalFirstAudioForPairs } from "@/lib/audio/hydrateCanonicalFirstAudio";

type DictionaryRow = {
  pair_id: string;
  deck_id: string;
  word_target: string;
  word_native: string;
  sentence_target: string | null;
  sentence_native: string | null;
  word_target_audio_url: string | null;
  sentence_target_audio_url: string | null;
  score: number | null;
  total_count?: number | null;
};

type DictionaryHydrationRow = DictionaryRow & { id: string };
type DeckIdRow = { id: string };

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const target = (url.searchParams.get("lang") || "").trim().toLowerCase(); // "es"
  const qRaw = url.searchParams.get("q") || "";
  const q = qRaw.trim().replace(/\s+/g, " ");

  if (!target) return NextResponse.json({ error: "Missing lang" }, { status: 400 });
  if (q.length < 2) return NextResponse.json({ results: [], total: 0 }, { status: 200 });

  // ✅ MVP: filter ONLY by target_lang (ignore native_lang for now)
  const { data: decks, error: decksErr } = await supabase
    .from("decks")
    .select("id")
    .eq("user_id", user.id)
    .eq("target_lang", target);

  if (decksErr) {
    return NextResponse.json({ error: decksErr.message }, { status: 500 });
  }

  const deckIds = ((decks || []) as DeckIdRow[]).map((d) => d.id);

  if (deckIds.length === 0) {
    return NextResponse.json({ results: [], total: 0 }, { status: 200 });
  }

  const { data, error } = await supabase.rpc("dictionary_search", {
    p_deck_ids: deckIds,
    p_q: q,
    p_limit: 10,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data || []) as DictionaryRow[];
  const total = rows?.[0]?.total_count ? Number(rows[0].total_count) : 0;
  const hydrationRows: DictionaryHydrationRow[] = rows.map((row) => ({
    ...row,
    id: row.pair_id,
  }));
  const hydratedRows = await hydrateCanonicalFirstAudioForPairs(
    supabase,
    hydrationRows,
    target
  );

  return NextResponse.json({
    results: hydratedRows.map((r: DictionaryHydrationRow) => ({
      pair_id: r.pair_id,
      deck_id: r.deck_id,
      word_target: r.word_target,
      word_native: r.word_native,
      sentence_target: r.sentence_target,
      sentence_native: r.sentence_native,
      word_target_audio_url: r.word_target_audio_url,
      sentence_target_audio_url: r.sentence_target_audio_url,
      score: r.score,
    })),
    total,
  });
}
