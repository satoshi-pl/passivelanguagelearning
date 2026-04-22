export type PairRow = {
  id: string;
  deck_id: string;
  word_target: string;
  word_native: string;
  sentence_target: string | null;
  sentence_native: string | null;
  created_at: string;

  word_target_audio_url?: string | null;
  sentence_target_audio_url?: string | null;
  fav_kind?: "word" | "sentence" | null;
  fav_dir?: "active" | "passive" | null;
};

export type ProgressMap = Record<
  string,
  { word_mastered: boolean; sentence_mastered: boolean }
>;

export type Stage = "word" | "sentence";
export type ViewMode = "preview" | "practice";
export type LearnMode = "words" | "ws" | "sentences";

// DB issue types
export type IssueType =
  | "wrong_translation"
  | "typo_grammar"
  | "audio_issue"
  | "unnatural_sentence"
  | "other";

// UI dropdown categories
export type UiCategory = "Sentence" | "Translation" | "Pronunciation/Audio" | "Other";

// WS learn step
export type LearnStep = { pairIndex: number; stage: Stage };
