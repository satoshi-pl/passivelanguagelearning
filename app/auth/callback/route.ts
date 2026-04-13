import { NextRequest, NextResponse } from "next/server";
import { createSupabaseOAuthCallbackClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const NO_STORE_REDIRECT_HEADERS = {
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

function redirectNoStore(url: string | URL, appOriginForRelative?: string) {
  const target =
    typeof url === "string" && appOriginForRelative
      ? new URL(url, appOriginForRelative)
      : url;
  return NextResponse.redirect(target, {
    status: 302,
    headers: NO_STORE_REDIRECT_HEADERS,
  });
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

function getSafeAppOrigin(appOriginRaw: string | null, fallbackOrigin: string) {
  if (!appOriginRaw) return fallbackOrigin;
  try {
    const appOriginUrl = new URL(appOriginRaw);
    const fallbackUrl = new URL(fallbackOrigin);
    const host = appOriginUrl.hostname.toLowerCase();
    const fallbackHost = fallbackUrl.hostname.toLowerCase();
    const allowed =
      host === fallbackHost ||
      host === "passivelanguagelearning.io" ||
      host === "www.passivelanguagelearning.io" ||
      host.endsWith(".vercel.app") ||
      host === "localhost" ||
      host === "127.0.0.1";
    if (!allowed) return fallbackOrigin;
    return `${appOriginUrl.protocol}//${appOriginUrl.host}`;
  } catch {
    return fallbackOrigin;
  }
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const appOriginRaw = requestUrl.searchParams.get("app_origin");
  const appOrigin = getSafeAppOrigin(appOriginRaw, requestUrl.origin);
  const code = requestUrl.searchParams.get("code");
  const nextRaw = requestUrl.searchParams.get("next") || "/setup";
  const retryAttempt = requestUrl.searchParams.get("retry");
  const flow = requestUrl.searchParams.get("flow") ?? "unknown";
  /** OAuth 2.0 error from the provider (e.g. access_denied) when there is no `code`. */
  const oauthError = requestUrl.searchParams.get("error");
  const oauthErrorDescription = requestUrl.searchParams.get("error_description");

  console.info("[auth/callback] inbound", {
    hasCode: Boolean(code),
    codeLen: code?.length ?? 0,
    appOriginRaw,
    appOriginEffective: appOrigin,
    crossOriginCallback: appOrigin !== requestUrl.origin,
    retryAttempt: retryAttempt ?? "0",
    hasRetry1: retryAttempt === "1",
    flow,
    next: nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "(sanitized)",
    oauthError: oauthError ?? null,
    oauthErrorDescription: truncateForLog(oauthErrorDescription),
    secFetchSite: request.headers.get("sec-fetch-site"),
    purpose: request.headers.get("purpose"),
    ...summarizeOAuthCookies(request),
  });

  if (!code) {
    const loginUrl = new URL("/login", requestUrl.origin);
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
    return redirectNoStore(`${loginUrl.pathname}${loginUrl.search}`, appOrigin);
  }

  const nextPath =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/setup";
  const successRedirectTarget = new URL(nextPath, appOrigin);
  console.info("[auth/callback] preparing success redirect response", {
    nextPath,
    successRedirectTarget: successRedirectTarget.toString(),
  });
  const response = redirectNoStore(successRedirectTarget);
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

    // Google-only retry: email verification and other callback flows should not bounce into Google.
    if (flow === "google" && retryAttempt !== "1") {
      const restartUrl = new URL("/auth/sign-in/google", requestUrl.origin);
      restartUrl.searchParams.set("next", nextPath);
      restartUrl.searchParams.set("retry", "1");
      restartUrl.searchParams.set("app_origin", appOrigin);
      console.warn("[auth/callback] exchange failed -> restarting OAuth once", {
        retryAttempt: retryAttempt ?? "0",
        automaticRestartTaken: true,
        failureStage: "before_retry",
        restartUrl: restartUrl.toString(),
      });
      return redirectNoStore(`${restartUrl.pathname}${restartUrl.search}`, appOrigin);
    }

    console.error("[auth/callback] exchange failed -> login error", {
      retryAttempt: retryAttempt ?? "0",
      automaticRestartTaken: flow === "google" ? false : null,
      failureStage: flow === "google" ? "retry_1" : "non_google",
      flow,
    });
    const loginUrl = new URL("/login", requestUrl.origin);
    if (flow === "email_verify") {
      loginUrl.searchParams.set("verified", "error");
    } else {
      loginUrl.searchParams.set("error", "google_callback_failed");
      loginUrl.searchParams.set("retry", "1");
    }
    return redirectNoStore(`${loginUrl.pathname}${loginUrl.search}`, appOrigin);
  }

  console.info("[auth/callback] session established", {
    userId: data.user?.id ?? null,
    nextPath,
  });

  return response;
}
