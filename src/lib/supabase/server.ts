import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { fetchNoStore } from "./fetchNoStore";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: fetchNoStore },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // ignore if cookies can't be set in this context
          }
        },
      },
    }
  );
}

/**
 * OAuth PKCE callback: attach session cookies to the same {@link NextResponse} as the
 * redirect. Using `cookies()` from `next/headers` here can fail silently (see try/catch
 * in {@link createSupabaseServerClient}), which breaks first-time sign-in when the
 * session must be written in this single response.
 */
export function createSupabaseOAuthCallbackClient(
  request: NextRequest,
  response: NextResponse
) {
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
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              if (value) {
                response.cookies.set(name, value, options);
              } else {
                response.cookies.delete(name);
              }
            });
          } catch (err) {
            console.error("[supabase] OAuth callback: response.cookies.set failed:", err);
          }
        },
      },
    }
  );
}
