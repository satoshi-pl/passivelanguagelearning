import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { fetchNoStore } from "./fetchNoStore";

function getPublicOrigin(req: NextRequest) {
  const protoHeader = req.headers.get("x-forwarded-proto");

  // Keep redirects on the same host that received the request (preview stays preview,
  // production stays production). Do not prioritize x-forwarded-host here.
  let host = (req.nextUrl.host || req.headers.get("host") || "").trim();
  if (!host) host = req.nextUrl.host;

  const hostLower = host.toLowerCase();
  if (hostLower.startsWith("0.0.0.0")) {
    host = host.replace(/^0\.0\.0\.0/i, "localhost");
  } else if (hostLower === "::1" || hostLower === "[::1]") {
    host = "localhost";
  }

  const protocol = (protoHeader || req.nextUrl.protocol.replace(":", "") || "http").toLowerCase();
  return `${protocol}://${host}`;
}

export async function middlewareSupabase(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");

  // Do not refresh the session on the OAuth return hop. `getUser()` can write auth cookies on
  // the middleware response while the callback route must read the PKCE verifier from the
  // incoming request and attach the new session to its own redirect — mixing these has been
  // linked to intermittent first-attempt `exchangeCodeForSession` failures (preview / new users).
  if (url.pathname === "/auth/callback") {
    return NextResponse.next();
  }

  // Some OAuth returns can land on the site root with ?code=...
  // Ensure all auth codes are processed by the dedicated callback route.
  if (code && url.pathname !== "/auth/callback") {
    const callbackUrl = new URL("/auth/callback", getPublicOrigin(req));
    callbackUrl.searchParams.set("code", code);
    callbackUrl.searchParams.set("next", "/setup");
    return NextResponse.redirect(callbackUrl);
  }

  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: fetchNoStore },
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // refresh session if needed
  await supabase.auth.getUser();

  return res;
}
