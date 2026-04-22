export type FavoritesMode = "words" | "ws" | "sentences";

export type FavoritesCategoryOption = {
  value: string;
  label: string;
};

export type FavoritesPageData = {
  selectedSupport: string;
  decksHref: string;
  total: number;
  favoriteTotalsByMode: Record<FavoritesMode, number>;
  categoryOptionsByMode: Record<FavoritesMode, FavoritesCategoryOption[]>;
  canonicalHref: string;
};
