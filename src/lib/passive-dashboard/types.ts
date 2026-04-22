export type PassiveDashboardMode = "words" | "ws" | "sentences";

export type PassiveDashboardProgress = {
  total: number;
  mastered: number;
  pct: number;
};

export type PassiveDashboardCategoryOption = {
  value: string;
  label: string;
};

export type PassiveDashboardCategoryProgressEntry = {
  words: PassiveDashboardProgress;
  sentences: PassiveDashboardProgress;
};

export type PassiveDashboardPageData = {
  deckId: string;
  deckName: string;
  targetLang: string;
  supportLang: string;
  levelLabel: string;
  backToDecksHref: string;
  overallWordsProgress: PassiveDashboardProgress;
  overallSentencesProgress: PassiveDashboardProgress;
  categoryOptions: PassiveDashboardCategoryOption[];
  categoryProgressByValue: Record<string, PassiveDashboardCategoryProgressEntry>;
};
