import type { NextRequest } from "next/server";
import { middlewareSupabase } from "./src/lib/supabase/middleware";

export function middleware(req: NextRequest) {
  return middlewareSupabase(req);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
