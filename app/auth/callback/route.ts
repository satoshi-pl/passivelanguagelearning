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
  const normalizeAllowedOrigin = (origin: string) => {
    const out = new URL(origin);
    if (out.hostname.toLowerCase() === "www.passivelanguagelearning.io") {
      out.hostname = "passivelanguagelearning.io";
    }
    return out.toString().replace(/\/$/, "");
  };

  const safeFallback = (() => {
    try {
      return normalizeAllowedOrigin(fallbackOrigin);
    } catch {
      return fallbackOrigin;
    }
  })();

  if (!appOriginRaw) return safeFallback;
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
    if (!allowed) return safeFallback;
    return normalizeAllowedOrigin(`${appOriginUrl.protocol}//${appOriginUrl.host}`);
  } catch {
    return safeFallback;
  }
}

function getGoogleAuthEventType(createdAt: string | null | undefined, lastSignInAt: string | null | undefined) {
  if (!createdAt || !lastSignInAt) return "login";

  const createdMs = Date.parse(createdAt);
  const lastSignInMs = Date.parse(lastSignInAt);
  if (!Number.isFinite(createdMs) || !Number.isFinite(lastSignInMs)) return "login";

  // Newly created Supabase users typically have both timestamps nearly identical.
  return Math.abs(lastSignInMs - createdMs) <= 120000 ? "sign_up" : "login";
}

function normalizeOtpType(raw: string | null): "signup" | "recovery" | "invite" | "magiclink" | "email_change" | null {
  const t = (raw ?? "").trim().toLowerCase();
  // Friendly alias used by PLL confirm-signup interstitial links in email templates
  if (t === "email") return "signup";
  if (t === "signup") return "signup";
  if (t === "recovery") return "recovery";
  if (t === "invite") return "invite";
  if (t === "magiclink") return "magiclink";
  if (t === "email_change") return "email_change";
  return null;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const appOriginRaw = requestUrl.searchParams.get("app_origin");
  const appOrigin = getSafeAppOrigin(appOriginRaw, requestUrl.origin);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const otpType = normalizeOtpType(requestUrl.searchParams.get("type"));
  const nextRaw = requestUrl.searchParams.get("next") || "/setup";
  const retryAttempt = requestUrl.searchParams.get("retry");
  const flow = requestUrl.searchParams.get("flow") ?? "unknown";
  /** OAuth 2.0 error from the provider (e.g. access_denied) when there is no `code`. */
  const oauthError = requestUrl.searchParams.get("error");
  const oauthErrorDescription = requestUrl.searchParams.get("error_description");

  console.info("[auth/callback] inbound", {
    hasCode: Boolean(code),
    codeLen: code?.length ?? 0,
    hasTokenHash: Boolean(tokenHash),
    otpType: otpType ?? null,
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

  const nextPath =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/setup";
  const successRedirectTarget = new URL(nextPath, appOrigin);
  const response = redirectNoStore(successRedirectTarget);
  const supabase = createSupabaseOAuthCallbackClient(request, response);

  if (!code) {
    if (tokenHash && otpType) {
      console.info("[auth/callback] preparing success redirect response", {
        nextPath,
        successRedirectTarget: successRedirectTarget.toString(),
        method: "otp_verify",
      });
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: otpType,
      });
      if (!error) {
        console.info("[auth/callback] session established", {
          userId: data.user?.id ?? null,
          nextPath,
          method: "otp_verify",
        });
        return response;
      }
      console.error("[auth/callback] verifyOtp failed", {
        message: error.message,
        name: error.name,
        status: (error as { status?: number }).status,
        code: (error as { code?: string }).code ?? null,
      });
      const verifyFailLogin = new URL("/login", requestUrl.origin);
      if (flow === "email_verify") {
        verifyFailLogin.searchParams.set("verified", "error");
      }
      return redirectNoStore(`${verifyFailLogin.pathname}${verifyFailLogin.search}`, appOrigin);
    }

    const loginUrl = new URL("/login", requestUrl.origin);
    // Benign: opened /auth/callback without starting OAuth, prefetch, or cancelled consent
    // (access_denied) — do not show a misleading "code was missing" error on /login.
    if (oauthError && oauthError !== "access_denied") {
      if (flow === "email_verify") {
        loginUrl.searchParams.set("verified", "error");
      } else {
        loginUrl.searchParams.set("error", "google_callback_failed");
      }
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

    // Email verification can occasionally fail on first callback hit due to transient exchange timing.
    // Retry the exact callback once before surfacing "invalid or expired" to the user.
    if (flow === "email_verify" && retryAttempt !== "1") {
      const retryUrl = new URL(requestUrl.toString());
      retryUrl.searchParams.set("retry", "1");
      console.warn("[auth/callback] exchange failed -> retrying email verification callback once", {
        retryAttempt: retryAttempt ?? "0",
        retryUrl: retryUrl.toString(),
      });
      return redirectNoStore(`${retryUrl.pathname}${retryUrl.search}`, appOrigin);
    }

    console.error("[auth/callback] exchange failed -> login error", {
      retryAttempt: retryAttempt ?? "0",
      automaticRestartTaken: flow === "google" ? false : null,
      failureStage:
        flow === "google" ? "retry_1" : flow === "email_verify" ? "email_verify_retry_1" : "non_google",
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

  if (flow === "google") {
    const authEvent = getGoogleAuthEventType(data.user?.created_at, data.user?.last_sign_in_at);
    response.cookies.set("pll_ga_auth", authEvent, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 5,
      secure: requestUrl.protocol === "https:",
      httpOnly: false,
    });
  }

  return response;
}
