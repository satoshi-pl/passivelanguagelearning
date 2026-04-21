import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hydrateCanonicalFirstAudioForPairs } from "@/lib/audio/hydrateCanonicalFirstAudio";

type LearnMode = "words" | "ws" | "sentences";
type Dir = "passive" | "active";
type Source = "learn" | "review";

type Body = {
  deckId?: string;
  mode?: string;
  dir?: string;
  source?: string;
  category?: string;
  offset?: number;
  limit?: number;
};

type PairRow = {
  id: string;
  deck_id: string;
  word_target: string;
  word_native: string;
  sentence_target: string | null;
  sentence_native: string | null;
  created_at: string;
  word_target_audio_url?: string | null;
  sentence_target_audio_url?: string | null;
  word_mastered_at?: string | null;
  sentence_mastered_at?: string | null;
  word_active_mastered_at?: string | null;
  sentence_active_mastered_at?: string | null;
};

function normalizeMode(raw: unknown): LearnMode {
  const v = String(raw ?? "").toLowerCase().trim();
  if (v === "words" || v === "ws" || v === "sentences") return v;
  return "ws";
}

function normalizeDir(raw: unknown): Dir {
  const v = String(raw ?? "").toLowerCase().trim();
  return v === "active" ? "active" : "passive";
}

function normalizeSource(raw: unknown): Source {
  const v = String(raw ?? "").toLowerCase().trim();
  return v === "review" ? "review" : "learn";
}

function normalizeCategory(raw: unknown) {
  return String(raw ?? "").trim();
}

function normalizeLimit(raw: unknown) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 30;
  return Math.min(60, Math.max(5, Math.floor(n)));
}

function normalizeOffset(raw: unknown) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

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

  const deckId = String(body.deckId ?? "").trim();
  if (!deckId) {
    return NextResponse.json({ error: "Missing deckId" }, { status: 400 });
  }

  const mode = normalizeMode(body.mode);
  const dir = normalizeDir(body.dir);
  const source = normalizeSource(body.source);
  const category = normalizeCategory(body.category);
  const offset = normalizeOffset(body.offset);
  const limit = normalizeLimit(body.limit);

  const { data: deck, error: deckErr } = await supabase
    .from("decks")
    .select("id, target_lang")
    .eq("id", deckId)
    .single();

  if (deckErr || !deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  const usePassiveReviewCategoryRpc =
    !!category && source === "review" && dir === "passive";
  const useActiveReviewCategoryRpc =
    !!category && source === "review" && dir === "active";
  const usePassiveLearnCategoryRpc =
    !!category && source === "learn" && dir === "passive";
  const useActiveLearnCategoryRpc =
    !!category && source === "learn" && dir === "active";

  const { data: sessionPairs, error: sessionErr } = usePassiveReviewCategoryRpc
    ? await supabase.rpc("get_passive_review_session_pairs_by_category", {
        p_user_id: user.id,
        p_deck_id: deckId,
        p_mode: mode,
        p_n: limit,
        p_offset: offset,
        p_category: category,
      })
    : useActiveReviewCategoryRpc
      ? await supabase.rpc("get_active_review_session_pairs_by_category", {
          p_user_id: user.id,
          p_deck_id: deckId,
          p_mode: mode,
          p_n: limit,
          p_offset: offset,
          p_category: category,
        })
      : usePassiveLearnCategoryRpc
        ? await supabase.rpc("get_passive_session_pairs_by_category", {
            p_user_id: user.id,
            p_deck_id: deckId,
            p_mode: mode,
            p_n: limit,
            p_offset: offset,
            p_category: category,
          })
        : useActiveLearnCategoryRpc
          ? await supabase.rpc("get_active_session_pairs_by_category", {
              p_user_id: user.id,
              p_deck_id: deckId,
              p_mode: mode,
              p_n: limit,
              p_offset: offset,
              p_category: category,
            })
          : await supabase.rpc("get_session_pairs", {
              p_user_id: user.id,
              p_deck_id: deckId,
              p_mode: mode,
              p_n: limit,
              p_offset: offset,
              p_dir: dir,
              p_source: source,
            });

  if (sessionErr) {
    return NextResponse.json(
      { error: sessionErr.message || "Failed to fetch session chunk" },
      { status: 500 }
    );
  }

  const hydratedPairs = await hydrateCanonicalFirstAudioForPairs(
    supabase,
    ((sessionPairs ?? []) as PairRow[]),
    deck.target_lang
  );

  const progress: Record<string, { word_mastered: boolean; sentence_mastered: boolean }> = {};
  for (const p of hydratedPairs) {
    const wordMastered = dir === "active" ? !!p.word_active_mastered_at : !!p.word_mastered_at;
    const sentenceMastered =
      dir === "active" ? !!p.sentence_active_mastered_at : !!p.sentence_mastered_at;
    progress[p.id] = {
      word_mastered: wordMastered,
      sentence_mastered: sentenceMastered,
    };
  }

  return NextResponse.json({
    pairs: hydratedPairs,
    progress,
    hasMore: hydratedPairs.length === limit,
  });
}
