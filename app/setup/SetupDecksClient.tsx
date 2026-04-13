"use client";

import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Container } from "../components/Container";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import { Button } from "../components/ui/Button";

type Phase = "checking" | "choosing" | "syncing" | "waiting" | "error" | "done";
type LanguagePair = { target_lang: string; native_lang: string };
type DeckTemplatePairRow = { target_lang: string | null; native_lang: string | null };

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

export default function SetupDecksClient() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [detail, setDetail] = useState<string | null>(null);
  const [availableTargets, setAvailableTargets] = useState<string[]>([]);
  const [supportsByTarget, setSupportsByTarget] = useState<Record<string, string[]>>({});
  const [targetDraft, setTargetDraft] = useState("");
  const [supportDraft, setSupportDraft] = useState("");
  const [selectedPairs, setSelectedPairs] = useState<LanguagePair[]>([]);
  const [isSubmittingPairs, setIsSubmittingPairs] = useState(false);
  const ranRef = useRef(false);
  const cancelledRef = useRef(false);
  const supabaseRef = useRef(createSupabaseBrowserClient());

  async function goDecks() {
    if (!cancelledRef.current) window.location.assign("/decks");
  }

  async function getSessionWithSettle() {
    const maxAttempts = 10;
    const delayMs = 120;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const {
        data: { session },
      } = await supabaseRef.current.auth.getSession();
      if (session) return session;
      if (attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    return null;
  }

  async function waitForDecksAndRedirect() {
    setPhase("waiting");
    for (let i = 0; i < 120 && !cancelledRef.current; i++) {
      const { data: rows } = await supabaseRef.current.from("decks").select("id").limit(1);
      if (rows && rows.length > 0) {
        setPhase("done");
        await goDecks();
        return true;
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    return false;
  }

  async function handleContinue() {
    if (selectedPairs.length === 0 || isSubmittingPairs) return;
    setIsSubmittingPairs(true);
    setDetail(null);
    setPhase("syncing");

    const payload = selectedPairs.map((p) => ({
      target_lang: p.target_lang,
      native_lang: p.native_lang,
    }));

    const { error: rpcErr } = await supabaseRef.current.rpc("sync_selected_content", { p_pairs: payload });
    if (cancelledRef.current) return;
    if (rpcErr) {
      setIsSubmittingPairs(false);
      setPhase("error");
      setDetail(`Could not provision selected pairs: ${rpcErr.message}`);
      return;
    }

    const hasDecks = await waitForDecksAndRedirect();
    if (!hasDecks) {
      setIsSubmittingPairs(false);
      setPhase("error");
      setDetail("Provisioning finished but no decks are visible yet. Please try again.");
    }
  }

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    cancelledRef.current = false;

    async function run() {
      const session = await getSessionWithSettle();
      if (!session) {
        window.location.assign("/login");
        return;
      }

      const { data: quick, error: qErr } = await supabaseRef.current.from("decks").select("id").limit(1);
      if (cancelledRef.current) return;
      if (qErr) {
        setPhase("error");
        setDetail(`Could not check your existing decks: ${qErr.message}`);
        await new Promise((r) => setTimeout(r, 2500));
        await goDecks();
        return;
      }
      if (quick && quick.length > 0) {
        setPhase("done");
        await goDecks();
        return;
      }

      const { data: pairRows, error: pairErr } = await supabaseRef.current
        .from("deck_templates")
        .select("target_lang,native_lang")
        .order("target_lang", { ascending: true })
        .order("native_lang", { ascending: true });
      if (cancelledRef.current) return;
      if (pairErr) {
        setPhase("error");
        const msg = pairErr.message || "Unknown error while loading language pairs.";
        const lower = msg.toLowerCase();
        if (pairErr.code === "42501" || lower.includes("permission denied") || lower.includes("row-level security")) {
          setDetail("Language pairs could not be loaded due to permissions. Please contact support.");
        } else {
          setDetail(`Could not load language pairs: ${msg}`);
        }
        return;
      }

      const pairs = (pairRows as DeckTemplatePairRow[] | null) ?? [];
      const map: Record<string, string[]> = {};
      for (const row of pairs) {
        const t = (row.target_lang || "").trim().toLowerCase();
        const s = (row.native_lang || "").trim().toLowerCase();
        if (!t || !s) continue;
        if (!map[t]) map[t] = [];
        if (!map[t].includes(s)) map[t].push(s);
      }
      const targets = Object.keys(map).sort((a, b) => langName(a).localeCompare(langName(b)));
      for (const t of targets) {
        map[t] = map[t].sort((a, b) => langName(a).localeCompare(langName(b)));
      }
      if (targets.length === 0) {
        setPhase("error");
        setDetail(
          "No language pairs are currently available for onboarding. Please try again shortly or contact support."
        );
        return;
      }

      const firstTarget = targets[0];
      setSupportsByTarget(map);
      setAvailableTargets(targets);
      setTargetDraft(firstTarget);
      setSupportDraft(map[firstTarget]?.[0] ?? "");
      setPhase("choosing");
    }

    void run();
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

  const message =
    phase === "checking"
      ? "Checking your library…"
      : phase === "choosing"
        ? "Choose one or more language pairs to start with."
      : phase === "syncing"
        ? "Copying selected decks and content…"
        : phase === "waiting"
          ? "Almost there — finalizing your decks…"
          : phase === "error"
            ? "Something went wrong during setup."
            : "Opening your decks…";

  return (
    <Container>
      <div className="mx-auto mt-16 max-w-md px-4">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-black text-sm font-extrabold text-white">
              PLL
            </div>
            <CardTitle className="text-xl">Setting up your decks</CardTitle>
            <CardDescription>
              Start with one or more language pairs now.{" "}
              <span className="font-semibold text-neutral-900">You can add more pairs later.</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 text-center">
            {phase === "choosing" ? (
              <>
                <div className="grid gap-3 text-left">
                  <div className="grid gap-1">
                    <label className="text-sm text-neutral-700" htmlFor="setup-target">
                      I want to learn
                    </label>
                    <select
                      id="setup-target"
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
                    <label className="text-sm text-neutral-700" htmlFor="setup-support">
                      From
                    </label>
                    <select
                      id="setup-support"
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
                    <p className="text-sm text-neutral-500">Add at least one pair to continue.</p>
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

                <Button
                  type="button"
                  disabled={selectedPairs.length === 0 || isSubmittingPairs}
                  onClick={handleContinue}
                >
                  {isSubmittingPairs ? "Provisioning..." : "Continue"}
                </Button>
              </>
            ) : (
              <>
                <div className="flex flex-col items-center gap-3">
                  <div
                    className="h-10 w-10 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900"
                    aria-hidden
                  />
                  <p className="text-sm font-medium text-neutral-900">{message}</p>
                  {detail && phase === "error" ? <p className="text-xs text-red-600">{detail}</p> : null}
                </div>
                <p className="text-xs text-neutral-500">
                  Please keep this tab open. You will be redirected automatically.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
