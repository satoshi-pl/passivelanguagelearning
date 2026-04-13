import { NextRequest, NextResponse } from "next/server";
import { createSupabaseOAuthCallbackClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const NO_STORE_REDIRECT_HEADERS = {
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

function redirectNoStore(url: string | URL) {
  return NextResponse.redirect(url, {
    status: 302,
    headers: NO_STORE_REDIRECT_HEADERS,
  });
}

function getPublicOrigin(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const protoHeader = request.headers.get("x-forwarded-proto");

  // Keep redirects on the same host that received the request (preview stays preview,
  // production stays production). Do not prioritize x-forwarded-host here.
  let host = (requestUrl.host || request.headers.get("host") || "").trim();
  if (!host) host = requestUrl.host;

  const hostLower = host.toLowerCase();
  if (hostLower.startsWith("0.0.0.0")) {
    host = host.replace(/^0\.0\.0\.0/i, "localhost");
  } else if (hostLower === "::1" || hostLower === "[::1]") {
    host = "localhost";
  }

  const protocol = (protoHeader || requestUrl.protocol.replace(":", "") || "http").toLowerCase();
  return `${protocol}://${host}`;
}

function truncateForLog(s: string | null, max = 160) {
  if (!s) return null;
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

function summarizeOAuthCookies(request: NextRequest) {
  const names = request.cookies.getAll().map((c) => c.name);
  return {
    cookieCount: names.length,
    hasCodeVerifierCookie: names.some((n) => n.includes("-auth-token-code-verifier")),
    hasAuthTokenCookie: names.some((n) => n.includes("-auth-token")),
    hasStateCookie: names.some((n) => n.includes("oauth-state")),
  };
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const origin = getPublicOrigin(request);
  const code = requestUrl.searchParams.get("code");
  const nextRaw = requestUrl.searchParams.get("next") || "/setup";
  const retryAttempt = requestUrl.searchParams.get("retry");
  /** OAuth 2.0 error from the provider (e.g. access_denied) when there is no `code`. */
  const oauthError = requestUrl.searchParams.get("error");
  const oauthErrorDescription = requestUrl.searchParams.get("error_description");

  console.info("[auth/callback] inbound", {
    hasCode: Boolean(code),
    codeLen: code?.length ?? 0,
    retryAttempt: retryAttempt ?? "0",
    hasRetry1: retryAttempt === "1",
    next: nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "(sanitized)",
    oauthError: oauthError ?? null,
    oauthErrorDescription: truncateForLog(oauthErrorDescription),
    secFetchSite: request.headers.get("sec-fetch-site"),
    purpose: request.headers.get("purpose"),
    ...summarizeOAuthCookies(request),
  });

  if (!code) {
    const loginUrl = new URL("/login", origin);
    // Benign: opened /auth/callback without starting OAuth, prefetch, or cancelled consent
    // (access_denied) — do not show a misleading "code was missing" error on /login.
    if (oauthError && oauthError !== "access_denied") {
      loginUrl.searchParams.set("error", "google_callback_failed");
      console.warn("[auth/callback] missing code with oauth error → login", {
        oauthError,
        oauthErrorDescription: truncateForLog(oauthErrorDescription),
      });
    } else {
      console.warn("[auth/callback] missing code (benign or prefetch)", {
        oauthError: oauthError ?? null,
      });
    }
    return redirectNoStore(loginUrl);
  }

  const nextPath =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/setup";
  const redirectTarget = new URL(nextPath, origin);

  const response = redirectNoStore(redirectTarget);
  const supabase = createSupabaseOAuthCallbackClient(request, response);

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback] exchangeCodeForSession failed", {
      message: error.message,
      name: error.name,
      status: (error as { status?: number }).status,
      code: (error as { code?: string }).code ?? null,
      retryAttempt: retryAttempt ?? "0",
    });

    // Pattern observed in preview: first callback can fail, but immediately retrying OAuth with
    // the same account often succeeds. Retry once automatically before showing login error.
    if (retryAttempt !== "1") {
      const restartUrl = new URL("/auth/sign-in/google", origin);
      restartUrl.searchParams.set("next", nextPath);
      restartUrl.searchParams.set("retry", "1");
      console.warn("[auth/callback] exchange failed -> restarting OAuth once", {
        retryAttempt: retryAttempt ?? "0",
        automaticRestartTaken: true,
        failureStage: "before_retry",
        restartUrl: restartUrl.toString(),
      });
      return redirectNoStore(restartUrl);
    }

    console.error("[auth/callback] exchange failed on retry=1 -> login error", {
      retryAttempt: retryAttempt ?? "0",
      automaticRestartTaken: false,
      failureStage: "retry_1",
    });
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "google_callback_failed");
    loginUrl.searchParams.set("retry", "1");
    return redirectNoStore(loginUrl);
  }

  console.info("[auth/callback] session established", {
    userId: data.user?.id ?? null,
    nextPath,
  });

  return response;
}
