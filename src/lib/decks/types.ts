export type DecksDeckRow = {
  id: string;
  name: string;
  target_lang: string;
  native_lang: string;
  level: string | null;
};

export type DecksProgress = {
  total: number;
  mastered: number;
  pct: number;
};

export type DecksDualProgress = {
  words: DecksProgress;
  sentences: DecksProgress;
};

export type DecksLevelOption = {
  value: string;
  label: string;
};

export type DecksPageData = {
  targetOptions: string[];
  supportOptionsByTarget: Record<string, string[]>;
  selectedTarget: string;
  selectedSupport: string;
  availableSupportsForSelectedTarget: string[];
  levelOptions: DecksLevelOption[];
  selectedLevelUrl: string;
  pairDecks: DecksDeckRow[];
  progressByDeck: Record<string, DecksDualProgress>;
  favoritesTotal: number;
  favoritesHref: string;
  currentDecksHref: string;
};
