"use client";

import Link from "next/link";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { normalizeEmailForAuth } from "@/lib/auth/normalizeEmailForAuth";
import { Container } from "../components/Container";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";

export default function ForgotPasswordPage() {
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

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

    const redirectTo = `${window.location.origin}/reset-password`;
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
