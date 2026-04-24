import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { headers } from "next/headers";
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

  const pathname = (await headers()).get("x-pll-pathname") ?? "";
  /** Contextual guest ribbon: `/` → Login+Sign up; `/login` → Home+Sign up; `/signup` → Home+Login; else → all three. */
  const showHomeNavLink = pathname !== "/";
  const showLoginNavLink = pathname !== "/login";
  const showSignupNavLink = pathname !== "/signup";

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
                <LogoHomeLink className="flex items-center gap-3 whitespace-nowrap font-semibold leading-none tracking-tight md:focus:outline-none md:focus-visible:outline md:focus-visible:outline-2 md:focus-visible:outline-offset-4 md:focus-visible:outline-neutral-400">
                  <span
                    data-top-nav-target="logo"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black text-[11px] font-extrabold leading-none text-white"
                  >
                    PLL
                  </span>
                  <span data-top-nav-target="brand" className="text-[19px] font-semibold leading-none">
                    Passive Language Learning
                  </span>
                </LogoHomeLink>
              </div>

              <div className="flex min-w-0 flex-1 items-center justify-end gap-2 lg:gap-3">
                <div className="min-w-0 shrink">
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
          <div className="flex min-h-14 items-center justify-between gap-3 py-2 md:min-h-[3.75rem] md:py-3">
            <div className="min-w-0 shrink-0">
              <LogoHomeLink className="flex items-center gap-3 whitespace-nowrap font-semibold tracking-tight md:leading-none md:focus:outline-none md:focus-visible:outline md:focus-visible:outline-2 md:focus-visible:outline-offset-4 md:focus-visible:outline-neutral-400">
                <span
                  data-top-nav-target="logo"
                  className="inline-flex h-7 w-7 max-sm:h-8 max-sm:w-8 max-sm:text-xs items-center justify-center rounded-full bg-black text-[11px] font-extrabold text-white md:h-8 md:w-8 md:text-xs md:leading-none"
                >
                  PLL
                </span>
                <span
                  data-top-nav-target="brand"
                  className="hidden text-[19px] font-semibold leading-none md:inline md:text-[1.05rem]"
                >
                  Passive Language Learning
                </span>
              </LogoHomeLink>
            </div>

            <nav
              className="flex min-w-0 flex-1 flex-nowrap items-center justify-end gap-x-1.5 sm:gap-x-2 md:gap-x-3"
              aria-label="Site and account"
            >
              <div className="shrink-0">
                <ThemeToggle />
              </div>
              {showHomeNavLink ? (
                <Link
                  href="/"
                  prefetch={false}
                  className="hidden shrink-0 rounded-xl px-2.5 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-100 sm:inline-flex sm:px-3 md:px-4 md:py-2.5 md:text-[0.9375rem] md:tracking-tight"
                >
                  Home
                </Link>
              ) : null}
              <div className="flex shrink-0 flex-nowrap items-center gap-0.5 sm:gap-2">
                {showLoginNavLink ? (
                  <Link
                    href="/login"
                    prefetch={false}
                    className="rounded-lg px-2 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-100/90 max-sm:px-2.5 max-sm:py-2 max-sm:text-sm max-sm:font-semibold max-sm:text-neutral-800 sm:rounded-xl sm:px-2.5 sm:py-2 sm:text-sm sm:font-medium sm:text-neutral-800 md:px-4 md:py-2.5 md:text-[0.9375rem] md:tracking-tight"
                  >
                    Login
                  </Link>
                ) : null}
                {showSignupNavLink ? (
                  <Link
                    href="/signup"
                    prefetch={false}
                    className="hidden rounded-xl bg-black px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800 sm:inline-flex sm:items-center sm:px-3 sm:py-2 sm:text-sm md:px-4 md:py-2.5 md:text-[0.9375rem] md:tracking-tight"
                  >
                    Sign up
                  </Link>
                ) : null}
              </div>
            </nav>
          </div>
        )}
      </Container>
    </header>
  );
}
