import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  const next = requestUrl.searchParams.get("next") || "/decks";

  const redirectTo =
    `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
    },
  });

  if (error || !data.url) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "google_start_failed");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(data.url);
}