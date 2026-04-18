"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  AuthCardColumn,
  authCardContentClassName,
  authCardDescriptionClassName,
  authCardHeaderClassName,
  authCardSurfaceClassName,
  authCardTitleClassName,
  authFieldLabelClassName,
  authFormGapClassName,
  authInputClassName,
  authPrimaryButtonClassName,
} from "../components/auth/AuthCardColumn";
import { Container } from "../components/Container";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card";
import { PasswordInput } from "../components/ui/PasswordInput";
import { Button } from "../components/ui/Button";

const RECOVERY_SEARCH_PARAMS = ["code", "type", "error", "error_code", "error_description"] as const;
const RECOVERY_HASH_PARAMS = [
  "type",
  "access_token",
  "refresh_token",
  "token_type",
  "expires_in",
  "expires_at",
  "error",
  "error_code",
  "error_description",
] as const;

function cleanupRecoveryUrl() {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  let changed = false;

  for (const key of RECOVERY_SEARCH_PARAMS) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }

  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
  let hashChanged = false;
  for (const key of RECOVERY_HASH_PARAMS) {
    if (hashParams.has(key)) {
      hashParams.delete(key);
      hashChanged = true;
    }
  }
  if (hashChanged) {
    const nextHash = hashParams.toString();
    url.hash = nextHash ? `#${nextHash}` : "";
    changed = true;
  }

  if (!changed) return;
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

export default function ResetPasswordPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const initStartedRef = useRef(false);
  const exchangedCodeRef = useRef<string | null>(null);
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;

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
      const hasRecoverySignal = Boolean(code) || type === "recovery" || hasAccessToken;

      if (code && exchangedCodeRef.current !== code) {
        exchangedCodeRef.current = code;
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError && process.env.NODE_ENV === "development") {
          console.warn("[reset-password] exchangeCodeForSession failed; waiting for settled session", {
            message: exchangeError.message,
          });
        }
      }

      const session = await waitForSessionSettle(hasRecoverySignal ? 20 : 8, 150);
      if (!active) return;

      const hasSession = Boolean(session);
      if (hasSession) {
        cleanupRecoveryUrl();
        setReady(true);
        return;
      }

      // Keep user in explicit retry/error state when recovery markers exist but no session settled.
      if (hasRecoverySignal || hasRecoveryError) {
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
      <AuthCardColumn>
        <Card className={authCardSurfaceClassName}>
          <CardHeader className={authCardHeaderClassName}>
            <CardTitle className={authCardTitleClassName}>Set a new password</CardTitle>
            <CardDescription className={authCardDescriptionClassName}>
              Choose a new password for your account.
            </CardDescription>
          </CardHeader>
          <CardContent className={`${authCardContentClassName} space-y-4`}>
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
              <form onSubmit={onSubmit} className={authFormGapClassName}>
                <div className="grid gap-1">
                  <label
                    className={`text-sm text-neutral-700 ${authFieldLabelClassName}`}
                    htmlFor="new-password"
                  >
                    New password
                  </label>
                  <PasswordInput
                    id="new-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className={authInputClassName}
                  />
                </div>
                <div className="grid gap-1">
                  <label
                    className={`text-sm text-neutral-700 ${authFieldLabelClassName}`}
                    htmlFor="confirm-password"
                  >
                    Confirm new password
                  </label>
                  <PasswordInput
                    id="confirm-password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    className={authInputClassName}
                  />
                </div>
                <Button type="submit" disabled={loading} className={authPrimaryButtonClassName}>
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
      </AuthCardColumn>
    </Container>
  );
}
