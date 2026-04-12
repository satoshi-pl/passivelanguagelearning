/**
 * Serialize Supabase auth.signUp results and unknown errors for debug UI / logs.
 * Stack only when includeStack is true (local `next dev`).
 */

function serializeValueForDebug(v: unknown): unknown {
  const t = typeof v;
  if (t === "function") return "[function]";
  if (t === "symbol") return String(v);
  if (t === "object" && v !== null) return "[object]";
  return v;
}

export function serializeUnknownErrorForDebug(
  err: unknown,
  opts: { includeStack: boolean }
): Record<string, unknown> {
  if (err === null || err === undefined) {
    return { value: err };
  }

  const typeofErr = typeof err;
  const constructorName =
    typeof err === "object" && err !== null && err.constructor?.name
      ? err.constructor.name
      : undefined;

  const base: Record<string, unknown> = {
    typeof: typeofErr,
    constructorName,
  };

  if (typeof err !== "object" || err === null) {
    base.primitive = String(err);
    return base;
  }

  const o = err as object;
  const rec = o as Record<string, unknown>;
  const names = Object.getOwnPropertyNames(o);
  base.ownPropertyNames = names;

  /** Top-level copies of common Auth / fetch error fields for quick scanning. */
  for (const k of ["name", "message", "status", "code", "error_description"] as const) {
    if (!names.includes(k)) continue;
    try {
      base[k] = serializeValueForDebug(rec[k]);
    } catch {
      base[k] = "[unreadable]";
    }
  }

  const enumerableShallow: Record<string, unknown> = {};
  for (const k of Object.keys(o)) {
    try {
      enumerableShallow[k] = serializeValueForDebug((o as Record<string, unknown>)[k]);
    } catch {
      enumerableShallow[k] = "[unreadable]";
    }
  }
  base.enumerableShallow = enumerableShallow;

  const ownValues: Record<string, unknown> = {};
  for (const n of names) {
    try {
      const desc = Object.getOwnPropertyDescriptor(o, n);
      let val: unknown = desc?.value;
      if (desc && "get" in desc && typeof desc.get === "function") {
        try {
          val = desc.get.call(o);
        } catch {
          val = "[getter threw]";
        }
      }
      ownValues[n] = serializeValueForDebug(val);
    } catch {
      ownValues[n] = "[unreadable]";
    }
  }
  base.ownPropertyValues = ownValues;

  if (opts.includeStack && err instanceof Error && err.stack) {
    base.stack = err.stack;
  }

  return base;
}

export function serializeSignUpDataForDebug(data: {
  user: unknown;
  session: unknown;
} | null): Record<string, unknown> {
  if (!data) return { data: null };

  const user = data.user;
  const session = data.session;

  let userSummary: Record<string, unknown> | string = "null";
  if (user && typeof user === "object") {
    const u = user as Record<string, unknown>;
    userSummary = {
      id: u.id,
      email: u.email,
      aud: u.aud,
      role: u.role,
    };
  }

  let sessionSummary: Record<string, unknown> | string = "null";
  if (session && typeof session === "object") {
    const s = session as Record<string, unknown>;
    sessionSummary = {
      hasAccessToken: typeof s.access_token === "string" && s.access_token.length > 0,
      hasRefreshToken: typeof s.refresh_token === "string" && s.refresh_token.length > 0,
      expires_at: s.expires_at,
      token_type: s.token_type,
    };
  }

  return {
    user: userSummary,
    session: sessionSummary,
  };
}

export function getSupabasePublicEnvDebug(): {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY_present: boolean;
  NEXT_PUBLIC_SUPABASE_ANON_KEY_prefix: string;
} {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY_present: key.length > 0,
    NEXT_PUBLIC_SUPABASE_ANON_KEY_prefix: key.slice(0, 12),
  };
}
