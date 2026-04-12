"use client";

import Link from "next/link";
import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { normalizeEmailForAuth } from "@/lib/auth/normalizeEmailForAuth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import GoogleSignInButton from "../components/auth/GoogleSignInButton";
import { Container } from "../components/Container";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  google_start_failed: "Could not start Google sign-in.",
  google_callback_failed:
    "Google could not finish sign-in. Try again, pick a different Google account if needed, or use email.",
};

function LoginPageInner() {
  const supabase = createSupabaseBrowserClient();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submitIntentRef = useRef(false);

  const authError = AUTH_ERROR_MESSAGES[searchParams.get("error") ?? ""] ?? null;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Mobile password managers can autofill and auto-submit.
    // Allow login only after an explicit user action (click/Enter).
    if (!submitIntentRef.current) return;
    submitIntentRef.current = false;

    setMsg(null);
    setLoading(true);

    const form = e.currentTarget;
    const fd = new FormData(form);
    const emailRaw = String(fd.get("email") ?? "");
    const passwordRaw = String(fd.get("password") ?? "");
    const loginEmail = normalizeEmailForAuth(emailRaw);

    setEmail(loginEmail);
    setPassword(passwordRaw);

    if (process.env.NODE_ENV === "development") {
      console.log("[login] submit (FormData)", {
        emailLen: emailRaw.length,
        passwordLen: passwordRaw.length,
        cleanedEmailLen: loginEmail.length,
      });
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: passwordRaw,
    });

    setLoading(false);
    if (error) return setMsg(error.message);

    // Hard navigation so /decks sees session cookies (same timing issue as signup).
    window.location.assign("/decks");
  }

  return (
    <Container>
      <div className="mx-auto mt-10 max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Login</CardTitle>
            <CardDescription>Sign in to continue to your decks.</CardDescription>
          </CardHeader>

          <CardContent>
            {!msg && authError && (
              <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {authError}
              </div>
            )}

            <div className="mb-4">
              <GoogleSignInButton />
            </div>

            <form onSubmit={onSubmit} className="grid gap-3">
              <div className="grid gap-1">
                <label className="text-sm text-neutral-700" htmlFor="login-email">
                  Email
                </label>
                <Input
                  id="login-email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitIntentRef.current = true;
                  }}
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="email"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-sm text-neutral-700" htmlFor="login-password">
                  Password
                </label>
                <Input
                  id="login-password"
                  name="password"
                  placeholder="••••••••"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitIntentRef.current = true;
                  }}
                  autoComplete="current-password"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                onClick={() => {
                  submitIntentRef.current = true;
                }}
              >
                {loading ? "Logging in..." : "Login"}
              </Button>
            </form>

            {msg && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {msg}
              </div>
            )}

            <p className="mt-4 text-sm text-neutral-600">
              No account?{" "}
              <Link href="/signup" className="font-medium text-black underline">
                Sign up
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}

function LoginPageFallback() {
  return (
    <Container>
      <div className="mx-auto mt-10 max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Login</CardTitle>
            <CardDescription>Sign in to continue to your decks.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-neutral-500">Loading…</p>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageInner />
    </Suspense>
  );
}
