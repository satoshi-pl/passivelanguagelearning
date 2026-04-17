import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Container } from "./Container";
import DictionaryHeaderSearch from "./DictionaryHeaderSearch";
import LogoHomeLink from "./LogoHomeLink";
import MobileNavLoggedIn from "./MobileNavLoggedIn";
import MobileAccountMenu from "./MobileAccountMenu";
import ThemeToggle from "./ThemeToggle";

export const dynamic = "force-dynamic";

type DeckLangRow = {
  target_lang: string | null;
};

type ProfileRow = {
  display_name: string | null;
};

export async function NavBar() {
  noStore();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email ?? null;
  let accountLabel = email;
  if (user) {
    const { error: ensureProfileErr } = await supabase
      .from("profiles")
      .upsert({ id: user.id }, { onConflict: "id" });
    if (ensureProfileErr && process.env.NODE_ENV === "development") {
      console.warn("[navbar] ensure profile failed", ensureProfileErr.message);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();

    const displayName = ((profile as ProfileRow | null)?.display_name || "").trim();
    if (displayName) accountLabel = displayName;
  }

  let langs: string[] = [];
  if (user) {
    const { data: decks } = await supabase
      .from("decks")
      .select("target_lang")
      .eq("user_id", user.id);

    langs = Array.from(
      new Set(
        (decks || [])
          .map((d: DeckLangRow) => (d.target_lang || "").trim().toLowerCase())
          .filter(Boolean)
      )
    );
  }

  return (
    <header
      className="
        sticky top-0 z-40
        border-b border-neutral-200
        bg-white/80 backdrop-blur
        shadow-[0_1px_0_rgba(0,0,0,0.04)]
      "
    >
      <Container>
        {email ? (
          <>
            <MobileNavLoggedIn email={email} accountLabel={accountLabel ?? email} langs={langs} />

            <div className="hidden min-h-14 items-center justify-between gap-4 py-2 md:flex">
              <div className="min-w-0 shrink-0">
                <LogoHomeLink className="flex items-center gap-3 whitespace-nowrap font-semibold tracking-tight">
                  <span
                    data-top-nav-target="logo"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black text-[11px] font-extrabold text-white"
                  >
                    PLL
                  </span>
                  <span data-top-nav-target="brand" className="text-[19px] font-semibold">
                    Passive Language Learning
                  </span>
                </LogoHomeLink>
              </div>

              <div className="flex min-w-0 flex-1 items-center justify-end gap-2 lg:gap-3">
                <div className="shrink-0">
                  <DictionaryHeaderSearch langs={langs} />
                </div>

                <div className="flex shrink-0 items-center gap-2 lg:gap-3">
                  <ThemeToggle />
                  <MobileAccountMenu email={email} accountLabel={accountLabel ?? email} />
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex min-h-14 items-center justify-between gap-3 py-2">
            <div className="min-w-0 shrink-0">
              <LogoHomeLink className="flex items-center gap-3 whitespace-nowrap font-semibold tracking-tight">
                <span
                  data-top-nav-target="logo"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black text-[11px] font-extrabold text-white"
                >
                  PLL
                </span>
                <span data-top-nav-target="brand" className="hidden text-[19px] font-semibold md:inline">
                  Passive Language Learning
                </span>
              </LogoHomeLink>
            </div>

            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <Link
                  href="/login"
                  className="rounded-xl px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  className="rounded-xl bg-black px-3 py-2 text-sm text-white hover:bg-neutral-800"
                >
                  Sign up
                </Link>
              </div>
              <div className="flex items-center gap-3 text-xs text-neutral-500">
                <Link href="/privacy" className="hover:text-neutral-700 hover:underline">
                  Privacy Policy
                </Link>
                <Link href="/terms" className="hover:text-neutral-700 hover:underline">
                  Terms of Service
                </Link>
              </div>
            </div>
          </div>
        )}
      </Container>
    </header>
  );
}
