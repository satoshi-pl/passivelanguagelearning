import { NextRequest, NextResponse } from "next/server";
import { createSupabaseOAuthCallbackClient } from "@/lib/supabase/server";

function getPublicOrigin(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const hostHeader = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const protoHeader = request.headers.get("x-forwarded-proto");

  let host = (hostHeader || requestUrl.host || "").trim();
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

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const origin = getPublicOrigin(request);
  const code = requestUrl.searchParams.get("code");
  const nextRaw = requestUrl.searchParams.get("next") || "/setup";
  /** OAuth 2.0 error from the provider (e.g. access_denied) when there is no `code`. */
  const oauthError = requestUrl.searchParams.get("error");
  const oauthErrorDescription = requestUrl.searchParams.get("error_description");

  console.info("[auth/callback] inbound", {
    hasCode: Boolean(code),
    codeLen: code?.length ?? 0,
    next: nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "(sanitized)",
    oauthError: oauthError ?? null,
    oauthErrorDescription: truncateForLog(oauthErrorDescription),
    secFetchSite: request.headers.get("sec-fetch-site"),
    purpose: request.headers.get("purpose"),
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
    return NextResponse.redirect(loginUrl);
  }

  const nextPath =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/setup";
  const redirectTarget = new URL(nextPath, origin);

  const response = NextResponse.redirect(redirectTarget);
  const supabase = createSupabaseOAuthCallbackClient(request, response);

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback] exchangeCodeForSession failed", {
      message: error.message,
      name: error.name,
      status: (error as { status?: number }).status,
      code: (error as { code?: string }).code ?? null,
    });
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "google_callback_failed");
    return NextResponse.redirect(loginUrl);
  }

  console.info("[auth/callback] session established", {
    userId: data.user?.id ?? null,
    nextPath,
  });

  return response;
}
