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
import { PasswordInput } from "../components/ui/PasswordInput";
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
  const submitInFlightRef = useRef(false);

  const authError = AUTH_ERROR_MESSAGES[searchParams.get("error") ?? ""] ?? null;
  const resetStatus = searchParams.get("reset");
  const verifiedStatus = searchParams.get("verified");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;

    setMsg(null);
    setLoading(true);

    try {
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

      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: passwordRaw,
      });

      if (error) {
        if (/confirm|verified/i.test(error.message)) {
          setMsg("Please verify your email before logging in. Check your inbox.");
          return;
        }
        setMsg(error.message || "Could not log in. Please try again.");
        return;
      }

      const provider = (data.user?.app_metadata?.provider as string | undefined) ?? null;
      if (provider === "email" && !data.user?.email_confirmed_at) {
        await supabase.auth.signOut();
        setMsg("Please verify your email before logging in. Check your inbox.");
        return;
      }

      // Route through setup so first-time users wait for provisioning visibility settle.
      // Returning users with existing decks are redirected quickly to /decks by /setup page.
      window.location.assign("/setup");
    } catch (err) {
      setMsg(err instanceof Error && err.message ? err.message : "Could not log in. Please try again.");
    } finally {
      submitInFlightRef.current = false;
      setLoading(false);
    }
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
            {resetStatus === "success" && (
              <div className="mb-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                Password updated. You can now log in with your new password.
              </div>
            )}
            {verifiedStatus === "1" && (
              <div className="mb-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                Email verified. You can now log in.
              </div>
            )}
            {verifiedStatus === "error" && (
              <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                Email verification link was invalid or expired. Request a new sign-up email.
              </div>
            )}

            {!msg && authError && (
              <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {authError}
              </div>
            )}

            <div className="mb-4">
              <GoogleSignInButton location="login_page" />
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
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="email"
                />
              </div>

              <div className="grid gap-1">
                <div className="flex items-center justify-between gap-4">
                  <label className="text-sm text-neutral-700" htmlFor="login-password">
                    Password
                  </label>
                  <Link href="/forgot-password" className="text-xs font-medium text-black underline">
                    Forgot password?
                  </Link>
                </div>
                <PasswordInput
                  id="login-password"
                  name="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>

              <Button type="submit" disabled={loading}>
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
