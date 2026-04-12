export type PracticeEmptyStateInput = {
  hasSessionPairs: boolean;
  categoryParam?: string | null;
  isFavoritesSession: boolean;
  isReview: boolean;
  isActive: boolean;
};

export type PracticeEmptyStateData = {
  title: string;
  text: string;
};

export function getPracticeEmptyState({
  hasSessionPairs,
  categoryParam,
  isFavoritesSession,
  isReview,
  isActive,
}: PracticeEmptyStateInput): PracticeEmptyStateData | null {
  if (hasSessionPairs) return null;

  const isCategoryFilteredPassiveEmpty =
    !!categoryParam && !isFavoritesSession && !isReview && !isActive;

  if (isCategoryFilteredPassiveEmpty) {
    return {
      title: "Nothing left in this category.",
      text: `No eligible items found for "${categoryParam}" in this mode. Choose another category or go back.`,
    };
  }

  if (isFavoritesSession) {
    return {
      title: "No favourites yet.",
      text: "Add some favourites first to start a favourites session.",
    };
  }

  if (isReview) {
    return {
      title: "Nothing to review yet.",
      text: "Master some items first in Passive Learning.",
    };
  }

  if (isActive) {
    return {
      title: "No active items yet.",
      text: "Master some items first in Passive Learning to unlock Active Learning.",
    };
  }

  return {
    title: "Nothing to practise yet.",
    text: "Start with Passive Learning first.",
  };
}