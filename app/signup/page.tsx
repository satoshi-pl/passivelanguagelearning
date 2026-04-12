"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { normalizeEmailForAuth } from "@/lib/auth/normalizeEmailForAuth";
import {
  logHardcodedSignupTestResult,
  logSignupFormDevDiagnostics,
} from "@/lib/auth/signupFormDevDiagnostics";
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
  google_callback_failed: "Google sign-in failed. Please try again.",
};

const SIGNUP_DEBUG_V2 = process.env.NEXT_PUBLIC_SIGNUP_DEBUG_V2 === "1";

type SubmitDebugSnapshot = {
  emailRaw: string;
  cleanedEmail: string;
  length: number;
  cleanedCodes: number[];
};

function SignupPageInner() {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastSubmitSnapshot, setLastSubmitSnapshot] = useState<SubmitDebugSnapshot | null>(null);
  const [hardcodedTestBusy, setHardcodedTestBusy] = useState(false);
  const [hardcodedTestResult, setHardcodedTestResult] = useState<string | null>(null);

  const authError = AUTH_ERROR_MESSAGES[searchParams.get("error") ?? ""] ?? null;

  async function runHardcodedSignupTest() {
    setHardcodedTestBusy(true);
    setHardcodedTestResult(null);
    const { data, error } = await supabase.auth.signUp({
      email: "plltestsimple@example.com",
      password: "Testpass123!",
    });
    logHardcodedSignupTestResult({ error });
    if (error) {
      setHardcodedTestResult(`ERROR: ${error.message}`);
    } else {
      setHardcodedTestResult(
        `OK: signUp returned no error (user/session: ${data.user?.id ?? "none"}). Check Supabase Auth → Users.`
      );
    }
    setHardcodedTestBusy(false);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    const form = e.currentTarget;
    const fd = new FormData(form);
    const emailRaw = String(fd.get("email") ?? "");
    const passwordRaw = String(fd.get("password") ?? "");
    const signupEmail = normalizeEmailForAuth(emailRaw);

    setEmail(signupEmail);
    setPassword(passwordRaw);

    if (SIGNUP_DEBUG_V2) {
      setLastSubmitSnapshot({
        emailRaw,
        cleanedEmail: signupEmail,
        length: signupEmail.length,
        cleanedCodes: [...signupEmail].map((ch) => ch.codePointAt(0) ?? 0),
      });
    }

    logSignupFormDevDiagnostics(form, emailRaw, signupEmail, passwordRaw.length);

    if (!signupEmail || !signupEmail.includes("@")) {
      setLoading(false);
      setMsg("Please enter a valid email address.");
      return;
    }

    const { error } = await supabase.auth.signUp({ email: signupEmail, password: passwordRaw });

    setLoading(false);
    if (error) {
      const m = error.message || "";
      if (/invalid format|validate email address/i.test(m)) {
        setMsg(
          "That email could not be accepted. Remove any spaces or odd characters at the start or end, then try again."
        );
        return;
      }
      return setMsg(m);
    }

    router.push("/decks");
    router.refresh();
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
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {msg}
              </div>
            )}

            {SIGNUP_DEBUG_V2 && (
              <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-neutral-900">
                <div className="mb-2 font-bold text-amber-900">DEV: signup debug (last submit)</div>
                {lastSubmitSnapshot ? (
                  <div className="space-y-1 font-mono break-all">
                    <div>
                      <span className="text-amber-800">emailRaw:</span>{" "}
                      {JSON.stringify(lastSubmitSnapshot.emailRaw)}
                    </div>
                    <div>
                      <span className="text-amber-800">cleanedEmail:</span>{" "}
                      {JSON.stringify(lastSubmitSnapshot.cleanedEmail)}
                    </div>
                    <div>
                      <span className="text-amber-800">length:</span> {lastSubmitSnapshot.length}
                    </div>
                    <div>
                      <span className="text-amber-800">cleaned char codes:</span>{" "}
                      {lastSubmitSnapshot.cleanedCodes.join(", ")}
                    </div>
                  </div>
                ) : (
                  <p className="text-neutral-600">Submit the form once to populate.</p>
                )}
                <div className="mt-3 border-t border-amber-200 pt-3">
                  <p className="mb-2 font-semibold text-amber-900">DEV: hardcoded signUp test</p>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={hardcodedTestBusy || loading}
                    onClick={() => void runHardcodedSignupTest()}
                  >
                    {hardcodedTestBusy ? "Running…" : "Run plltestsimple@example.com signUp"}
                  </Button>
                  {hardcodedTestResult && (
                    <pre className="mt-2 whitespace-pre-wrap break-words text-[11px] text-neutral-800">
                      {hardcodedTestResult}
                    </pre>
                  )}
                </div>
              </div>
            )}

            {SIGNUP_DEBUG_V2 && (
              <p className="mt-2 text-center text-[11px] font-medium tracking-wide text-amber-700">
                signup-debug-v2
              </p>
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
