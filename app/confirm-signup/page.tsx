"use client";

import Link from "next/link";
import { Suspense, useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AuthCardColumn,
  authCardContentClassName,
  authCardDescriptionClassName,
  authCardHeaderClassName,
  authCardSurfaceClassName,
  authCardTitleClassName,
  authPrimaryButtonClassName,
} from "../components/auth/AuthCardColumn";
import { Container } from "../components/Container";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card";

function getCanonicalSiteOrigin() {
  const origin = new URL(window.location.origin);
  const host = origin.hostname.toLowerCase();
  if (host === "passivelanguagelearning.io" || host === "www.passivelanguagelearning.io") {
    origin.protocol = "https:";
    origin.hostname = "passivelanguagelearning.io";
    origin.port = "";
  }
  return origin.toString().replace(/\/$/, "");
}

/** Supabase verifyOtp uses `signup` for email confirmation; allow `email` as a friendly alias. */
function normalizeSignupTypeParam(raw: string | null): "signup" | null {
  const t = (raw ?? "").trim().toLowerCase();
  if (t === "signup" || t === "email") return "signup";
  return null;
}

function isSafeNextPath(next: string | null): next is string {
  if (!next) return false;
  const t = next.trim();
  return t.startsWith("/") && !t.startsWith("//");
}

function ConfirmSignupInner() {
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);

  const tokenHash = (searchParams.get("token_hash") ?? "").trim();
  const typeRaw = searchParams.get("type");
  const otpType = useMemo(() => normalizeSignupTypeParam(typeRaw), [typeRaw]);
  const nextParam = searchParams.get("next");
  const nextPath = isSafeNextPath(nextParam) ? nextParam.trim() : "/login?verified=1";

  const missingParams = !tokenHash || !otpType;

  const onConfirm = useCallback(() => {
    if (missingParams || busy) return;
    setBusy(true);
    try {
      const appOrigin = getCanonicalSiteOrigin();
      const url = new URL("/auth/callback", appOrigin);
      url.searchParams.set("token_hash", tokenHash);
      url.searchParams.set("type", otpType);
      url.searchParams.set("flow", "email_verify");
      url.searchParams.set("app_origin", appOrigin);
      url.searchParams.set("next", nextPath);
      window.location.assign(url.toString());
    } catch {
      setBusy(false);
    }
  }, [busy, missingParams, nextPath, otpType, tokenHash]);

  return (
    <Container>
      <AuthCardColumn>
        <Card className={authCardSurfaceClassName}>
          <CardHeader className={authCardHeaderClassName}>
            <CardTitle className={authCardTitleClassName}>Confirm your email</CardTitle>
            <CardDescription className={authCardDescriptionClassName}>
              Some email providers open links automatically. We only complete sign-up when you press the
              button below.
            </CardDescription>
          </CardHeader>
          <CardContent className={`${authCardContentClassName} space-y-4`}>
            {missingParams ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                This confirmation link is incomplete or has expired. Request a new sign-up email, or try
                logging in if you already have an account.
              </div>
            ) : (
              <p className="text-sm text-neutral-600">
                You are almost done. When you are ready, confirm your email address to continue.
              </p>
            )}

            <Button
              type="button"
              disabled={missingParams || busy}
              onClick={onConfirm}
              className={`w-full ${authPrimaryButtonClassName}`}
            >
              {busy ? "Continuing…" : "Confirm email"}
            </Button>

            <p className="text-center text-sm text-neutral-600">
              <Link href="/signup" className="font-medium text-black underline">
                Back to sign up
              </Link>
              <span className="mx-2 text-neutral-400">·</span>
              <Link href="/login" className="font-medium text-black underline">
                Log in
              </Link>
            </p>
          </CardContent>
        </Card>
      </AuthCardColumn>
    </Container>
  );
}

function ConfirmSignupFallback() {
  return (
    <Container>
      <AuthCardColumn>
        <Card className={authCardSurfaceClassName}>
          <CardHeader className={authCardHeaderClassName}>
            <CardTitle className={authCardTitleClassName}>Confirm your email</CardTitle>
            <CardDescription className={authCardDescriptionClassName}>One moment…</CardDescription>
          </CardHeader>
          <CardContent className={authCardContentClassName}>
            <p className="text-sm text-neutral-500">Preparing this page.</p>
          </CardContent>
        </Card>
      </AuthCardColumn>
    </Container>
  );
}

export default function ConfirmSignupPage() {
  return (
    <Suspense fallback={<ConfirmSignupFallback />}>
      <ConfirmSignupInner />
    </Suspense>
  );
}
