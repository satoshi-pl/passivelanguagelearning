"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Container } from "../components/Container";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";

export default function ResetPasswordPage() {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function waitForSessionSettle(maxAttempts = 8, delayMs = 150) {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const { data } = await supabase.auth.getSession();
        if (data.session) return data.session;
        if (attempt < maxAttempts - 1) {
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
      return null;
    }

    async function initRecoveryState() {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const searchParams = new URLSearchParams(window.location.search);
      const type = hashParams.get("type");
      const hasAccessToken = Boolean(hashParams.get("access_token"));
      const code = searchParams.get("code");
      const hasRecoveryError =
        Boolean(searchParams.get("error")) ||
        Boolean(searchParams.get("error_code")) ||
        Boolean(hashParams.get("error")) ||
        Boolean(hashParams.get("error_code"));

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError && process.env.NODE_ENV === "development") {
          console.warn("[reset-password] exchangeCodeForSession failed; waiting for settled session", {
            message: exchangeError.message,
          });
        }
      }

      const session = await waitForSessionSettle();
      if (!active) return;

      const hasSession = Boolean(session);
      if (hasSession || type === "recovery" || hasAccessToken) {
        setReady(true);
        return;
      }

      // Do not fail aggressively on first load if a recovery marker exists; the session may still
      // settle after redirect/exchange in some browsers/environments.
      if (hasRecoveryError) {
        setError("This reset link may have expired. Please try once more, or request a new email.");
        return;
      }

      setError("This reset link is invalid or expired. Request a new one.");
    }

    void initRecoveryState();
    return () => {
      active = false;
    };
  }, [supabase]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setMsg("Password updated. Redirecting to login...");
    setTimeout(() => {
      router.replace("/login?reset=success");
    }, 700);
  }

  return (
    <Container>
      <div className="mx-auto mt-10 max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Set a new password</CardTitle>
            <CardDescription>Choose a new password for your account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {msg && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                {msg}
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {!ready ? (
              <p className="text-sm text-neutral-600">
                If your link is expired, request a new reset email.
              </p>
            ) : (
              <form onSubmit={onSubmit} className="grid gap-3">
                <div className="grid gap-1">
                  <label className="text-sm text-neutral-700" htmlFor="new-password">
                    New password
                  </label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <div className="grid gap-1">
                  <label className="text-sm text-neutral-700" htmlFor="confirm-password">
                    Confirm new password
                  </label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <Button type="submit" disabled={loading}>
                  {loading ? "Saving..." : "Save new password"}
                </Button>
              </form>
            )}

            <p className="text-sm text-neutral-600">
              <Link href="/forgot-password" className="font-medium text-black underline">
                Request another reset email
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
