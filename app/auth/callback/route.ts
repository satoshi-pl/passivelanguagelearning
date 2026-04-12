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

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const origin = getPublicOrigin(request);
  const code = requestUrl.searchParams.get("code");
  const nextRaw = requestUrl.searchParams.get("next") || "/decks";
  /** OAuth 2.0 error from the provider (e.g. access_denied) when there is no `code`. */
  const oauthError = requestUrl.searchParams.get("error");

  if (!code) {
    const loginUrl = new URL("/login", origin);
    // Benign: opened /auth/callback without starting OAuth, prefetch, or cancelled consent
    // (access_denied) — do not show a misleading "code was missing" error on /login.
    if (oauthError && oauthError !== "access_denied") {
      loginUrl.searchParams.set("error", "google_callback_failed");
    }
    return NextResponse.redirect(loginUrl);
  }

  const nextPath =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/decks";
  const redirectTarget = new URL(nextPath, origin);

  const response = NextResponse.redirect(redirectTarget);
  const supabase = createSupabaseOAuthCallbackClient(request, response);

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback] exchangeCodeForSession failed", {
      message: error.message,
      name: error.name,
      status: (error as { status?: number }).status,
    });
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "google_callback_failed");
    return NextResponse.redirect(loginUrl);
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[auth/callback] session established", { userId: data.user?.id ?? null });
  }

  return response;
}