export type PassiveReviewMode = "words" | "ws" | "sentences";

export type PassiveReviewCategoryOption = {
  value: string;
  label: string;
};

export type PassiveReviewPageData = {
  deckId: string;
  deckName: string;
  targetLang: string;
  supportLang: string;
  level: string;
  backToDeckHref: string;
  categoryOptionsByMode: Record<PassiveReviewMode, PassiveReviewCategoryOption[]>;
  reviewTotalsByMode: Record<PassiveReviewMode, number>;
};
