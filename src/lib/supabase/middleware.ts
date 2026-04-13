import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { fetchNoStore } from "./fetchNoStore";

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
    const callbackPath = `/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent("/setup")}`;
    return NextResponse.redirect(callbackPath);
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
