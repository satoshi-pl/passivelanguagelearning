"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
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

function SignupPageInner() {
  const supabase = createSupabaseBrowserClient();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [msgTone, setMsgTone] = useState<"error" | "success">("error");
  const [loading, setLoading] = useState(false);

  const authError = AUTH_ERROR_MESSAGES[searchParams.get("error") ?? ""] ?? null;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setMsgTone("error");
    setLoading(true);

    const form = e.currentTarget;
    const fd = new FormData(form);
    const emailRaw = String(fd.get("email") ?? "");
    const passwordRaw = String(fd.get("password") ?? "");
    const signupEmail = normalizeEmailForAuth(emailRaw);

    setEmail(signupEmail);
    setPassword(passwordRaw);

    if (!signupEmail || !signupEmail.includes("@")) {
      setLoading(false);
      setMsgTone("error");
      setMsg("Please enter a valid email address.");
      return;
    }

    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", "/login?verified=1");
    callbackUrl.searchParams.set("app_origin", window.location.origin);
    callbackUrl.searchParams.set("flow", "email_verify");

    const { data, error } = await supabase.auth.signUp({
      email: signupEmail,
      password: passwordRaw,
      options: {
        emailRedirectTo: callbackUrl.toString(),
      },
    });

    setLoading(false);
    if (error) {
      const m = error.message || "";
      if (/invalid format|validate email address/i.test(m)) {
        setMsgTone("error");
        setMsg(
          "That email could not be accepted. Remove any spaces or odd characters at the start or end, then try again."
        );
        return;
      }
      setMsgTone("error");
      return setMsg(m);
    }

    // Require verified email before allowing account login/session use.
    if (data.session) {
      await supabase.auth.signOut();
    }
    setMsgTone("success");
    setMsg(
      "Check your email to verify your account, then come back and log in."
    );
  }

  return (
    <Container>
      <div className="mx-auto mt-10 max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Create account</CardTitle>
            <CardDescription>
              Sign up to practice the creator&apos;s decks and track your progress.
            </CardDescription>
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
                <label className="text-sm text-neutral-700" htmlFor="signup-email">
                  Email
                </label>
                <Input
                  id="signup-email"
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
                <label className="text-sm text-neutral-700" htmlFor="signup-password">
                  Password
                </label>
                <Input
                  id="signup-password"
                  name="password"
                  placeholder="••••••••"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create account"}
              </Button>
            </form>

            {msg && (
              <div
                className={`mt-3 rounded-xl border p-3 text-sm ${
                  msgTone === "success"
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {msg}
              </div>
            )}

            <p className="mt-4 text-sm text-neutral-600">
              Have an account?{" "}
              <Link href="/login" className="font-medium text-black underline">
                Login
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}

function SignupPageFallback() {
  return (
    <Container>
      <div className="mx-auto mt-10 max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Create account</CardTitle>
            <CardDescription>
              Sign up to practice the creator&apos;s decks and track your progress.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-neutral-500">Loading…</p>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupPageFallback />}>
      <SignupPageInner />
    </Suspense>
  );
}
