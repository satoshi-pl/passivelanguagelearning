export type ActiveReviewMode = "words" | "ws" | "sentences";

export type ActiveReviewCategoryOption = {
  value: string;
  label: string;
};

export type ActiveReviewPageData = {
  deckId: string;
  deckName: string;
  targetLang: string;
  supportLang: string;
  level: string;
  backToDeckHref: string;
  categoryOptionsByMode: Record<ActiveReviewMode, ActiveReviewCategoryOption[]>;
  reviewTotalsByMode: Record<ActiveReviewMode, number>;
};
