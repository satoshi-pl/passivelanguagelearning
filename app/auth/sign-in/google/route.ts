import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { fetchNoStore } from "@/lib/supabase/fetchNoStore";

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

function toAbsoluteUrl(path: string, origin: string) {
  return new URL(path, origin);
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
  const next = requestUrl.searchParams.get("next") || "/setup";
  const retry = requestUrl.searchParams.get("retry");

  const callbackUrl = new URL("/auth/callback", requestUrl.origin);
  callbackUrl.searchParams.set("next", next);
  callbackUrl.searchParams.set("app_origin", requestUrl.origin);
  if (retry === "1") {
    callbackUrl.searchParams.set("retry", "1");
  }
  const redirectTo = callbackUrl.toString();

  console.info("[auth/google/start] begin", {
    next,
    retryAttempt: retry ?? "0",
    appOrigin: requestUrl.origin,
    redirectToHasRetry: callbackUrl.searchParams.get("retry") === "1",
  });

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
    console.error("[auth/google/start] signInWithOAuth failed", {
      message: error?.message ?? "missing_data_url",
      retryAttempt: retry ?? "0",
    });
    const loginUrl = new URL("/login", requestUrl.origin);
    loginUrl.searchParams.set("error", "google_start_failed");
    const res = redirectNoStore(toAbsoluteUrl(`${loginUrl.pathname}${loginUrl.search}`, requestUrl.origin));
    applyPendingCookies(res, pendingCookies);
    return res;
  }

  console.info("[auth/google/start] redirecting_to_provider", {
    retryAttempt: retry ?? "0",
    appOrigin: requestUrl.origin,
    redirectToHasRetry: callbackUrl.searchParams.get("retry") === "1",
  });

  const res = redirectNoStore(data.url);
  applyPendingCookies(res, pendingCookies);
  return res;
}
