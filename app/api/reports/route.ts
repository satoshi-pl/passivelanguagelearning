import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type IssueType =
  | "wrong_translation"
  | "typo_grammar"
  | "audio_issue"
  | "unnatural_sentence"
  | "other";

type LearnMode = "words" | "ws" | "sentences";
type Stage = "word" | "sentence";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const deckId = String(body?.deckId ?? "");
  const pairId = String(body?.pairId ?? "");
  const mode = String(body?.mode ?? "") as LearnMode;
  const stage = String(body?.stage ?? "") as Stage;
  const issueType = String(body?.issueType ?? "") as IssueType;

  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 300) : null;
  const promptText = typeof body?.promptText === "string" ? body.promptText : null;
  const answerText = typeof body?.answerText === "string" ? body.answerText : null;
  const audioRaw = typeof body?.audioRaw === "string" ? body.audioRaw : null;

  const allowedModes: LearnMode[] = ["words", "ws", "sentences"];
  const allowedStages: Stage[] = ["word", "sentence"];
  const allowedIssues: IssueType[] = [
    "wrong_translation",
    "typo_grammar",
    "audio_issue",
    "unnatural_sentence",
    "other",
  ];

  if (!deckId || !pairId) {
    return NextResponse.json({ error: "Missing deckId/pairId" }, { status: 400 });
  }
  if (!allowedModes.includes(mode) || !allowedStages.includes(stage) || !allowedIssues.includes(issueType)) {
    return NextResponse.json({ error: "Invalid mode/stage/issueType" }, { status: 400 });
  }

  const { error } = await supabase.from("pair_reports").insert({
    user_id: user.id,
    deck_id: deckId,
    pair_id: pairId,
    mode,
    stage,
    issue_type: issueType,
    note: note || null,
    prompt_text: promptText,
    answer_text: answerText,
    audio_raw: audioRaw,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
