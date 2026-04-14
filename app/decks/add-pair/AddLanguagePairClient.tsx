"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Container } from "../../components/Container";
import { Button } from "../../components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/Card";

type LanguagePair = { target_lang: string; native_lang: string };
type PairTemplateRow = { target_lang: string | null; native_lang: string | null };
type DeckRow = { id: string; target_lang: string | null; native_lang: string | null; level: string | null };
type ManagedPair = { target_lang: string; native_lang: string; levels: string[]; deckCount: number };

function pairKey(targetLang: string, nativeLang: string) {
  return `${targetLang}__${nativeLang}`;
}

function langName(codeOrName: string) {
  const map: Record<string, string> = {
    es: "Spanish",
    en: "English",
    pl: "Polish",
    de: "German",
    fr: "French",
    it: "Italian",
    pt: "Portuguese",
    ru: "Russian",
    tr: "Turkish",
    ar: "Arabic",
    sw: "Swahili",
    zh: "Chinese",
    ja: "Japanese",
    ko: "Korean",
  };
  const key = (codeOrName || "").toLowerCase().trim();
  return map[key] ?? codeOrName;
}

function normalizeLevel(level: string | null | undefined) {
  const t = String(level || "").trim().toUpperCase();
  return t || "Other";
}

export default function AddLanguagePairClient() {
  const router = useRouter();
  const [loadingPairs, setLoadingPairs] = useState(true);
  const [loadErrorMsg, setLoadErrorMsg] = useState<string | null>(null);
  const [submitErrorMsg, setSubmitErrorMsg] = useState<string | null>(null);
  const [removeErrorMsg, setRemoveErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [templateRows, setTemplateRows] = useState<PairTemplateRow[]>([]);
  const [ownedDeckRows, setOwnedDeckRows] = useState<DeckRow[]>([]);
  const [targetDraft, setTargetDraft] = useState("");
  const [supportDraft, setSupportDraft] = useState("");
  const [selectedPairs, setSelectedPairs] = useState<LanguagePair[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [confirmRemovePair, setConfirmRemovePair] = useState<ManagedPair | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const cancelledRef = useRef(false);
  const supabaseRef = useRef(createSupabaseBrowserClient());

  useEffect(() => {
    cancelledRef.current = false;

    async function loadPairData() {
      setLoadingPairs(true);
      setLoadErrorMsg(null);

      const {
        data: { session },
      } = await supabaseRef.current.auth.getSession();
      if (!session) {
        window.location.assign("/login");
        return;
      }

      const { data: deckTemplateRows, error: templateErr } = await supabaseRef.current
        .from("deck_templates")
        .select("target_lang,native_lang")
        .order("target_lang", { ascending: true })
        .order("native_lang", { ascending: true });

      if (cancelledRef.current) return;
      if (templateErr) {
        setLoadingPairs(false);
        setLoadErrorMsg(`Could not load available language pairs: ${templateErr.message}`);
        return;
      }

      const { data: existingDeckRows, error: decksErr } = await supabaseRef.current
        .from("decks")
        .select("id,target_lang,native_lang,level");

      if (cancelledRef.current) return;
      if (decksErr) {
        setLoadingPairs(false);
        setLoadErrorMsg(`Could not load your existing language pairs: ${decksErr.message}`);
        return;
      }

      setTemplateRows(((deckTemplateRows as PairTemplateRow[] | null) ?? []).filter(Boolean));
      setOwnedDeckRows(((existingDeckRows as DeckRow[] | null) ?? []).filter(Boolean));
      setLoadingPairs(false);
    }

    void loadPairData();
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const ownedPairKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const row of ownedDeckRows) {
      const t = (row.target_lang || "").trim().toLowerCase();
      const s = (row.native_lang || "").trim().toLowerCase();
      if (!t || !s) continue;
      keys.add(pairKey(t, s));
    }
    return keys;
  }, [ownedDeckRows]);

  const managedPairs = useMemo<ManagedPair[]>(() => {
    const grouped = new Map<string, ManagedPair>();
    for (const row of ownedDeckRows) {
      const t = (row.target_lang || "").trim().toLowerCase();
      const s = (row.native_lang || "").trim().toLowerCase();
      if (!t || !s) continue;
      const k = pairKey(t, s);
      const level = normalizeLevel(row.level);
      const existing = grouped.get(k);
      if (!existing) {
        grouped.set(k, { target_lang: t, native_lang: s, levels: [level], deckCount: 1 });
        continue;
      }
      if (!existing.levels.includes(level)) existing.levels.push(level);
      existing.deckCount += 1;
    }
    return Array.from(grouped.values())
      .map((p) => ({ ...p, levels: p.levels.slice().sort() }))
      .sort((a, b) => {
        const byTarget = langName(a.target_lang).localeCompare(langName(b.target_lang));
        if (byTarget !== 0) return byTarget;
        return langName(a.native_lang).localeCompare(langName(b.native_lang));
      });
  }, [ownedDeckRows]);

  const supportsByTarget = useMemo<Record<string, string[]>>(() => {
    const map: Record<string, string[]> = {};
    for (const row of templateRows) {
      const t = (row.target_lang || "").trim().toLowerCase();
      const s = (row.native_lang || "").trim().toLowerCase();
      if (!t || !s) continue;
      if (ownedPairKeys.has(pairKey(t, s))) continue;
      if (!map[t]) map[t] = [];
      if (!map[t].includes(s)) map[t].push(s);
    }

    for (const target of Object.keys(map)) {
      map[target] = map[target].sort((a, b) => langName(a).localeCompare(langName(b)));
    }
    return map;
  }, [templateRows, ownedPairKeys]);

  const availableTargets = useMemo(
    () => Object.keys(supportsByTarget).sort((a, b) => langName(a).localeCompare(langName(b))),
    [supportsByTarget]
  );

  useEffect(() => {
    if (availableTargets.length === 0) {
      setTargetDraft("");
      setSupportDraft("");
      return;
    }

    if (!targetDraft || !availableTargets.includes(targetDraft)) {
      const nextTarget = availableTargets[0];
      setTargetDraft(nextTarget);
      setSupportDraft((supportsByTarget[nextTarget] ?? [])[0] ?? "");
      return;
    }

    const supports = supportsByTarget[targetDraft] ?? [];
    if (!supportDraft || !supports.includes(supportDraft)) {
      setSupportDraft(supports[0] ?? "");
    }
  }, [availableTargets, supportsByTarget, targetDraft, supportDraft]);

  function addPair() {
    const t = targetDraft.trim().toLowerCase();
    const s = supportDraft.trim().toLowerCase();
    if (!t || !s) return;
    if (ownedPairKeys.has(pairKey(t, s))) return;
    if (selectedPairs.some((p) => p.target_lang === t && p.native_lang === s)) return;
    setSelectedPairs((prev) => [...prev, { target_lang: t, native_lang: s }]);
  }

  function removePair(pair: LanguagePair) {
    setSelectedPairs((prev) =>
      prev.filter((p) => !(p.target_lang === pair.target_lang && p.native_lang === pair.native_lang))
    );
  }

  async function onSubmit() {
    if (selectedPairs.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitErrorMsg(null);
    setRemoveErrorMsg(null);
    setSuccessMsg(null);

    const payload = selectedPairs.map((p) => ({
      target_lang: p.target_lang,
      native_lang: p.native_lang,
    }));

    const { error } = await supabaseRef.current.rpc("sync_selected_content", { p_pairs: payload });
    if (cancelledRef.current) return;
    if (error) {
      setIsSubmitting(false);
      setSubmitErrorMsg(`Could not add language pair: ${error.message}`);
      return;
    }

    setSuccessMsg("Language pair added. Opening your decks...");
    window.location.assign("/decks");
  }

  async function onConfirmRemove() {
    if (!confirmRemovePair || isRemoving) return;
    setIsRemoving(true);
    setRemoveErrorMsg(null);
    setSubmitErrorMsg(null);
    setSuccessMsg(null);

    const targetLang = confirmRemovePair.target_lang;
    const nativeLang = confirmRemovePair.native_lang;

    const res = await fetch("/api/language-pairs/remove", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetLang, nativeLang }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };

    if (!res.ok) {
      setIsRemoving(false);
      setRemoveErrorMsg(json.error || "Could not remove language pair.");
      return;
    }

    setOwnedDeckRows((prev) =>
      prev.filter(
        (row) =>
          (row.target_lang || "").trim().toLowerCase() !== targetLang ||
          (row.native_lang || "").trim().toLowerCase() !== nativeLang
      )
    );
    setSelectedPairs((prev) => prev.filter((p) => !(p.target_lang === targetLang && p.native_lang === nativeLang)));
    setConfirmRemovePair(null);
    setIsRemoving(false);
    setSuccessMsg(`${langName(targetLang)} from ${langName(nativeLang)} was removed.`);
    router.refresh();
  }

  const hasAvailablePairs = availableTargets.length > 0;

  return (
    <Container>
      <div className="mx-auto mt-16 max-w-md px-4">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Add language pair</CardTitle>
            <CardDescription>Manage language pairs in one place.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {loadingPairs ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <div
                  className="h-10 w-10 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900"
                  aria-hidden
                />
                <p className="text-sm font-medium text-neutral-900">Loading available pairs...</p>
              </div>
            ) : loadErrorMsg ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-left text-sm text-red-700">
                {loadErrorMsg}
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <Button
                    type="button"
                    size="lg"
                    className="w-full"
                    onClick={() => {
                      if (!hasAvailablePairs) return;
                      setShowAddForm((v) => !v);
                    }}
                    disabled={!hasAvailablePairs}
                  >
                    + Add new language pair
                  </Button>
                  {showAddForm ? (
                    <div className="grid gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-left">
                      <div className="grid gap-1">
                        <label className="text-sm text-neutral-700" htmlFor="add-pair-target">
                          I want to learn
                        </label>
                        <select
                          id="add-pair-target"
                          className="h-11 rounded-xl border border-neutral-300 bg-white px-3 text-sm text-neutral-900"
                          value={targetDraft}
                          onChange={(e) => {
                            const nextTarget = e.target.value;
                            setTargetDraft(nextTarget);
                            const supports = supportsByTarget[nextTarget] ?? [];
                            setSupportDraft(supports[0] ?? "");
                          }}
                        >
                          {availableTargets.map((t) => (
                            <option key={t} value={t}>
                              {langName(t)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid gap-1">
                        <label className="text-sm text-neutral-700" htmlFor="add-pair-support">
                          From
                        </label>
                        <select
                          id="add-pair-support"
                          className="h-11 rounded-xl border border-neutral-300 bg-white px-3 text-sm text-neutral-900"
                          value={supportDraft}
                          onChange={(e) => setSupportDraft(e.target.value)}
                        >
                          {(supportsByTarget[targetDraft] ?? []).map((s) => (
                            <option key={s} value={s}>
                              {langName(s)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <Button type="button" onClick={addPair}>
                        Add pair
                      </Button>
                    </div>
                  ) : null}
                  {!hasAvailablePairs ? (
                    <p className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
                      You already have all currently available language pairs.
                    </p>
                  ) : null}
                </div>

                {selectedPairs.length > 0 ? (
                  <div className="space-y-2 text-left">
                    {selectedPairs.map((p) => (
                      <div
                        key={`${p.target_lang}-${p.native_lang}`}
                        className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2"
                      >
                        <span className="text-sm text-neutral-900">
                          {langName(p.target_lang)} from {langName(p.native_lang)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removePair(p)}
                          className="rounded-lg px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-200"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="border-t border-neutral-200 pt-4" />

                <div className="space-y-2 text-left">
                  <p className="text-sm font-medium text-neutral-900">Existing language pairs</p>
                  {managedPairs.length === 0 ? (
                    <p className="text-sm text-neutral-500">No existing language pairs yet.</p>
                  ) : (
                    managedPairs.map((p) => (
                      <div
                        key={`${p.target_lang}-${p.native_lang}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-neutral-900">
                            {langName(p.target_lang)} from {langName(p.native_lang)}
                          </div>
                          <div className="text-xs text-neutral-500">
                            {p.levels.length > 0 ? `Levels: ${p.levels.join(", ")}` : null}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-neutral-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => {
                            setSubmitErrorMsg(null);
                            setRemoveErrorMsg(null);
                            setConfirmRemovePair(p);
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    ))
                  )}
                </div>

                {successMsg ? (
                  <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-left text-sm text-green-700">
                    {successMsg}
                  </div>
                ) : null}

                {submitErrorMsg ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-left text-sm text-red-700">
                    {submitErrorMsg}
                  </div>
                ) : null}

                {removeErrorMsg ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-left text-sm text-red-700">
                    {removeErrorMsg}
                  </div>
                ) : null}

                <div className="flex items-center justify-between gap-3">
                  <Link className="text-sm text-neutral-600 underline" href="/decks">
                    Cancel
                  </Link>
                  <Button type="button" disabled={selectedPairs.length === 0 || isSubmitting} onClick={onSubmit}>
                    {isSubmitting ? "Adding..." : "Add selected pairs"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {confirmRemovePair ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-neutral-900">Remove language pair?</h2>
            <p className="mt-2 text-sm text-neutral-700">
              This will permanently delete all your progress for this language pair. This action cannot be undone.
            </p>
            <p className="mt-2 text-sm font-medium text-neutral-900">
              {langName(confirmRemovePair.target_lang)} from {langName(confirmRemovePair.native_lang)}
            </p>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setConfirmRemovePair(null)}
                disabled={isRemoving}
              >
                Cancel
              </Button>
              <Button type="button" variant="danger" onClick={onConfirmRemove} disabled={isRemoving}>
                {isRemoving ? "Removing..." : "Remove"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </Container>
  );
}
