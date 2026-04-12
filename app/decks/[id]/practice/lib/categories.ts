export type SearchParamValue = string | string[] | undefined;

export function normalizeCategoryParam(raw: SearchParamValue): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;

  const v = value.replace(/\+/g, " ").trim();
  if (!v || v.toLowerCase() === "all") return null;

  return v;
}

export function getUniqueCategories<T extends { category?: string | null }>(
  items: T[],
): string[] {
  return Array.from(
    new Set(
      items
        .map((item) => item.category?.trim())
        .filter((v): v is string => !!v),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

export function filterItemsByCategory<T extends { category?: string | null }>(
  items: T[],
  category: string | null,
): T[] {
  if (!category) return items;
  return items.filter((item) => (item.category?.trim() ?? "") === category);
}