import type { ActiveReviewMode } from "@/lib/active-review/types";

export function buildActiveReviewHref({
  deckId,
  mode,
  backToDeckHref,
  category,
  deckName,
  targetLang,
  supportLang,
  level,
  warmEntry,
}: {
  deckId: string;
  mode?: ActiveReviewMode;
  backToDeckHref?: string;
  category?: string | null;
  deckName?: string;
  targetLang?: string;
  supportLang?: string;
  level?: string;
  warmEntry?: boolean;
}) {
  const qs = new URLSearchParams();

  if (mode) qs.set("mode", mode);
  if (backToDeckHref) qs.set("back", backToDeckHref);
  if (category) qs.set("category", category);
  if (deckName) qs.set("deck_name", deckName);
  if (targetLang) qs.set("target_lang", targetLang);
  if (supportLang) qs.set("support_lang", supportLang);
  if (level) qs.set("level_label", level);
  if (warmEntry) qs.set("entry", "active_dashboard");

  const s = qs.toString();
  return s ? `/decks/${deckId}/active/review?${s}` : `/decks/${deckId}/active/review`;
}
