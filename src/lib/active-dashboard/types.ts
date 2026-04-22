export type ActiveDashboardMode = "words" | "ws" | "sentences";

export type ActiveDashboardProgress = {
  total: number;
  mastered: number;
  pct: number;
};

export type ActiveDashboardCategoryOption = {
  value: string;
  label: string;
};

export type ActiveDashboardCategoryProgressEntry = {
  words: ActiveDashboardProgress;
  sentences: ActiveDashboardProgress;
};

export type ActiveDashboardPageData = {
  deckId: string;
  deckName: string;
  targetLang: string;
  supportLang: string;
  levelLabel: string;
  backToDecksHref: string;
  overallWordsProgress: ActiveDashboardProgress;
  overallSentencesProgress: ActiveDashboardProgress;
  categoryOptionsByMode: Record<ActiveDashboardMode, ActiveDashboardCategoryOption[]>;
  categoryProgressByValue: Record<string, ActiveDashboardCategoryProgressEntry>;
  pendingTotalsByMode: Record<ActiveDashboardMode, number>;
};
