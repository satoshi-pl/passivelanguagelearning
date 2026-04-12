import type { PairRow, ProgressMap, LearnMode, Stage, LearnStep } from "./types";

export function hasSentence(p: PairRow) {
  return !!(p.sentence_target && p.sentence_native);
}

export function normalizeMode(raw: string | null): LearnMode {
  const v = (raw ?? "").toLowerCase().trim();
  if (v === "words" || v === "ws" || v === "sentences") return v;
  return "ws";
}

export function getPr(p: PairRow, prMap: ProgressMap) {
  return prMap[p.id] || { word_mastered: false, sentence_mastered: false };
}

export function getPendingStage(
  p: PairRow,
  prMap: ProgressMap,
  mode: LearnMode
): Stage | null {
  const pr = getPr(p, prMap);

  if (mode === "words") return pr.word_mastered ? null : "word";

  if (mode === "sentences") {
    if (!hasSentence(p)) return null;
    return pr.sentence_mastered ? null : "sentence";
  }

  // ws:
  if (!pr.word_mastered) return "word";
  if (hasSentence(p) && !pr.sentence_mastered) return "sentence";
  return null;
}

/**
 * ✅ WS Learn steps builder
 *
 * Rules:
 * - Include ONLY pending stages.
 * - If both pending: word first, then sentence.
 * - If word mastered but sentence pending: sentence ONLY (no fake word step).
 * - If sentence missing: only word if pending.
 */
export function buildWsSteps(rows: PairRow[], prMap: ProgressMap): LearnStep[] {
  const steps: LearnStep[] = [];

  rows.forEach((p, i) => {
    const pr = getPr(p, prMap);
    const hs = hasSentence(p);

    const wordPending = !pr.word_mastered;
    const sentencePending = hs && !pr.sentence_mastered;

    // If nothing pending, skip entirely
    if (!wordPending && !sentencePending) return;

    // WS order: word first, then sentence
    if (wordPending) steps.push({ pairIndex: i, stage: "word" });
    if (sentencePending) steps.push({ pairIndex: i, stage: "sentence" });
  });

  return steps;
}

/**
 * ✅ WS Learn session slicer (FULL-PAIR FIRST, OFFSET BY PRIORITY)
 *
 * Your intended behavior:
 * 1) First take N "full pending pairs" (word + sentence both pending).
 *    => produces N words + their corresponding N sentences.
 * 2) If there aren't enough full pairs, replenish to still return N pairs
 *    using leftovers in this order:
 *    - wordOnly (word pending; sentence mastered or missing)
 *    - sentenceOnly (word mastered; sentence pending)
 *
 * Critical fix:
 * - Apply offset by priority buckets (fullPairs -> wordOnly -> sentenceOnly),
 *   so you never "skip" fullPairs while they still exist.
 */
export function buildWsSessionPairs(args: {
  all: PairRow[];
  prMap: ProgressMap;
  offset: number;
  chosenN: number;
}) {
  const { all, prMap, offset, chosenN } = args;

  const fullPairs: PairRow[] = [];
  const wordOnly: PairRow[] = [];
  const sentenceOnly: PairRow[] = [];

  for (const p of all) {
    const pr = getPr(p, prMap);
    const hs = hasSentence(p);

    const wordPending = !pr.word_mastered;
    const sentencePending = hs && !pr.sentence_mastered;

    if (wordPending && sentencePending) fullPairs.push(p);
    else if (wordPending) wordOnly.push(p);
    else if (sentencePending) sentenceOnly.push(p);
  }

  // Apply offset by priority so we don't dilute fullPairs selection
  let off = Math.max(0, offset);
  const picked: PairRow[] = [];

  const sliceWithOffset = (pool: PairRow[], poolOffset: number, n: number) => {
    const start = Math.min(poolOffset, pool.length);
    return pool.slice(start, start + n);
  };

  // 1) fullPairs first
  if (off < fullPairs.length) {
    picked.push(...sliceWithOffset(fullPairs, off, chosenN));
    off = 0;
  } else {
    off -= fullPairs.length;
  }

  // 2) then wordOnly
  if (picked.length < chosenN) {
    const need = chosenN - picked.length;
    if (off < wordOnly.length) {
      picked.push(...sliceWithOffset(wordOnly, off, need));
      off = 0;
    } else {
      off -= wordOnly.length;
    }
  }

  // 3) then sentenceOnly
  if (picked.length < chosenN) {
    const need = chosenN - picked.length;
    picked.push(...sliceWithOffset(sentenceOnly, off, need));
  }

  return picked;
}