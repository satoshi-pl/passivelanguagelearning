"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
type PairRow = { target_lang: string | null; native_lang: string | null };

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

export default function AddLanguagePairClient() {
  const [loadingPairs, setLoadingPairs] = useState(true);
  const [loadErrorMsg, setLoadErrorMsg] = useState<string | null>(null);
  const [submitErrorMsg, setSubmitErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [availableTargets, setAvailableTargets] = useState<string[]>([]);
  const [supportsByTarget, setSupportsByTarget] = useState<Record<string, string[]>>({});
  const [targetDraft, setTargetDraft] = useState("");
  const [supportDraft, setSupportDraft] = useState("");
  const [selectedPairs, setSelectedPairs] = useState<LanguagePair[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const cancelledRef = useRef(false);
  const supabaseRef = useRef(createSupabaseBrowserClient());

  useEffect(() => {
    cancelledRef.current = false;

    async function loadPairOptions() {
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
        .select("target_lang,native_lang");

      if (cancelledRef.current) return;
      if (decksErr) {
        setLoadingPairs(false);
        setLoadErrorMsg(`Could not load your existing language pairs: ${decksErr.message}`);
        return;
      }

      const ownedPairKeys = new Set<string>();
      for (const row of ((existingDeckRows as PairRow[] | null) ?? []).filter(Boolean)) {
        const t = (row.target_lang || "").trim().toLowerCase();
        const s = (row.native_lang || "").trim().toLowerCase();
        if (!t || !s) continue;
        ownedPairKeys.add(pairKey(t, s));
      }

      const map: Record<string, string[]> = {};
      for (const row of ((deckTemplateRows as PairRow[] | null) ?? []).filter(Boolean)) {
        const t = (row.target_lang || "").trim().toLowerCase();
        const s = (row.native_lang || "").trim().toLowerCase();
        if (!t || !s) continue;
        if (ownedPairKeys.has(pairKey(t, s))) continue;
        if (!map[t]) map[t] = [];
        if (!map[t].includes(s)) map[t].push(s);
      }

      const targets = Object.keys(map).sort((a, b) => langName(a).localeCompare(langName(b)));
      for (const t of targets) {
        map[t] = map[t].sort((a, b) => langName(a).localeCompare(langName(b)));
      }

      setAvailableTargets(targets);
      setSupportsByTarget(map);
      setTargetDraft(targets[0] ?? "");
      setSupportDraft(targets.length > 0 ? (map[targets[0]]?.[0] ?? "") : "");
      setLoadingPairs(false);
    }

    void loadPairOptions();
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  function addPair() {
    const t = targetDraft.trim().toLowerCase();
    const s = supportDraft.trim().toLowerCase();
    if (!t || !s) return;
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

  const hasAvailablePairs = availableTargets.length > 0;

  return (
    <Container>
      <div className="mx-auto mt-16 max-w-md px-4">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Add language pair</CardTitle>
            <CardDescription>Add one or more new pairs to your deck library.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 text-center">
            {loadingPairs ? (
              <div className="flex flex-col items-center gap-3">
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
            ) : !hasAvailablePairs ? (
              <div className="space-y-3">
                <p className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
                  You already have all currently available language pairs.
                </p>
                <Link className="text-sm font-medium text-neutral-900 underline" href="/decks">
                  Back to decks
                </Link>
              </div>
            ) : (
              <>
                <div className="grid gap-3 text-left">
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

                <div className="space-y-2 text-left">
                  <p className="text-sm font-medium text-neutral-900">Selected pairs</p>
                  {selectedPairs.length === 0 ? (
                    <p className="text-sm text-neutral-500">Select at least one new pair to add.</p>
                  ) : (
                    selectedPairs.map((p) => (
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
    </Container>
  );
}
