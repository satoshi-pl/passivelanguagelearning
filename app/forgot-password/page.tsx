"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { normalizeEmailForAuth } from "@/lib/auth/normalizeEmailForAuth";
import { Container } from "../components/Container";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";

function getResetRedirectOrigin() {
  const origin = new URL(window.location.origin);
  const host = origin.hostname.toLowerCase();

  // Production canonical host for reset links.
  if (host === "passivelanguagelearning.io" || host === "www.passivelanguagelearning.io") {
    origin.protocol = "https:";
    origin.hostname = "passivelanguagelearning.io";
    origin.port = "";
  }

  return origin.toString().replace(/\/$/, "");
}

export default function ForgotPasswordPage() {
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [recoveryVerifyFailed, setRecoveryVerifyFailed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("recovery_error") !== "1") return;
    setRecoveryVerifyFailed(true);
    url.searchParams.delete("recovery_error");
    const qs = url.searchParams.toString();
    window.history.replaceState(window.history.state, "", `${url.pathname}${qs ? `?${qs}` : ""}`);
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSentTo(null);
    setLoading(true);

    const normalizedEmail = normalizeEmailForAuth(email);
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setLoading(false);
      setError("Please enter a valid email address.");
      return;
    }

    const redirectTo = `${getResetRedirectOrigin()}/reset-password`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo,
    });

    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSentTo(normalizedEmail);
  }

  return (
    <Container>
      <div className="mx-auto mt-10 max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Reset password</CardTitle>
            <CardDescription>
              Enter your email and we&apos;ll send you a link to set a new password.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recoveryVerifyFailed && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                That reset link could not be verified or has expired. Request a new reset email below, or try
                logging in if you remember your password.
              </div>
            )}

            {sentTo && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                Password reset email sent to <span className="font-medium">{sentTo}</span>. Check
                your inbox and spam folder.
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={onSubmit} className="grid gap-3">
              <div className="grid gap-1">
                <label className="text-sm text-neutral-700" htmlFor="forgot-email">
                  Email
                </label>
                <Input
                  id="forgot-email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="email"
                />
              </div>

              <Button type="submit" disabled={loading}>
                {loading ? "Sending..." : "Send reset link"}
              </Button>
            </form>

            <p className="text-sm text-neutral-600">
              Remembered it?{" "}
              <Link href="/login" className="font-medium text-black underline">
                Back to login
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
