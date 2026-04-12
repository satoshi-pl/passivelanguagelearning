import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { fetchNoStore } from "@/lib/supabase/fetchNoStore";

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

type CookieToSet = { name: string; value: string; options?: Parameters<NextResponse["cookies"]["set"]>[2] };

/**
 * PKCE + OAuth state cookies must be attached to the same {@link NextResponse} that redirects
 * to Google. Using `cookies()` from `next/headers` here can fail silently (see try/catch in
 * createSupabaseServerClient), which breaks exchangeCodeForSession intermittently — especially
 * for new users.
 */
function createSupabaseGoogleOAuthStartClient(request: NextRequest, pendingCookies: CookieToSet[]) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: fetchNoStore },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            pendingCookies.push({ name, value, options });
          }
        },
      },
    }
  );
}

function applyPendingCookies(res: NextResponse, pending: CookieToSet[]) {
  for (const { name, value, options } of pending) {
    res.cookies.set(name, value, options);
  }
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const origin = getPublicOrigin(request);
  const next = requestUrl.searchParams.get("next") || "/setup";

  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const pendingCookies: CookieToSet[] = [];
  const supabase = createSupabaseGoogleOAuthStartClient(request, pendingCookies);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        prompt: "select_account",
      },
    },
  });

  if (error || !data.url) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "google_start_failed");
    const res = NextResponse.redirect(loginUrl);
    applyPendingCookies(res, pendingCookies);
    return res;
  }

  const res = NextResponse.redirect(data.url);
  applyPendingCookies(res, pendingCookies);
  return res;
}
