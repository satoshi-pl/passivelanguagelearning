import type { UiCategory } from "./types";

export type IssueType =
  | "wrong_translation"
  | "typo_grammar"
  | "audio_issue"
  | "unnatural_sentence"
  | "other";

export function uiCategoryToIssueType(cat: UiCategory): IssueType {
  if (cat === "Sentence") return "unnatural_sentence";
  if (cat === "Translation") return "wrong_translation";
  if (cat === "Pronunciation/Audio") return "audio_issue";
  return "other";
}
