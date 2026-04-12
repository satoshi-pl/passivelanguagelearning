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

type Phase = "checking" | "syncing" | "waiting" | "error" | "done";

export default function SetupDecksClient() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [detail, setDetail] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const supabase = createSupabaseBrowserClient();
    let cancelled = false;

    async function goDecks() {
      if (!cancelled) window.location.assign("/decks");
    }

    async function getSessionWithSettle() {
      const maxAttempts = 10;
      const delayMs = 120;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) return session;
        if (attempt < maxAttempts - 1) {
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
      return null;
    }

    async function run() {
      const session = await getSessionWithSettle();
      if (!session) {
        window.location.assign("/login");
        return;
      }

      const { data: quick, error: qErr } = await supabase.from("decks").select("id").limit(1);
      if (cancelled) return;
      if (qErr) {
        setPhase("error");
        setDetail(qErr.message);
        await new Promise((r) => setTimeout(r, 2500));
        await goDecks();
        return;
      }
      if (quick && quick.length > 0) {
        setPhase("done");
        await goDecks();
        return;
      }

      setPhase("syncing");
      const { error: rpcErr } = await supabase.rpc("sync_default_content");
      if (cancelled) return;
      if (rpcErr) {
        setPhase("error");
        setDetail(rpcErr.message);
        await new Promise((r) => setTimeout(r, 2500));
        await goDecks();
        return;
      }

      setPhase("waiting");
      for (let i = 0; i < 120 && !cancelled; i++) {
        const { data: rows } = await supabase.from("decks").select("id").limit(1);
        if (rows && rows.length > 0) {
          setPhase("done");
          await goDecks();
          return;
        }
        await new Promise((r) => setTimeout(r, 400));
      }

      await goDecks();
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const message =
    phase === "checking"
      ? "Checking your library…"
      : phase === "syncing"
        ? "Copying default decks and content…"
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
              The first visit can take a little while while we copy your practice library. You only
              see this once.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 text-center">
            <div className="flex flex-col items-center gap-3">
              <div
                className="h-10 w-10 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900"
                aria-hidden
              />
              <p className="text-sm font-medium text-neutral-900">{message}</p>
              {detail && phase === "error" ? (
                <p className="text-xs text-red-600">{detail}</p>
              ) : null}
            </div>
            <p className="text-xs text-neutral-500">
              Please keep this tab open. You will be redirected automatically.
            </p>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
