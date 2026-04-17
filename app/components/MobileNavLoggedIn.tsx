"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import DictionaryHeaderSearch from "./DictionaryHeaderSearch";
import LogoHomeLink from "./LogoHomeLink";
import MobileAccountMenu from "./MobileAccountMenu";
import ThemeToggle from "./ThemeToggle";

function isPracticePath(pathname: string | null) {
  if (!pathname) return false;
  return (
    /\/decks\/[^/]+\/practice(?:\/|$)/.test(pathname) ||
    /\/favorites\/[^/]+\/practice(?:\/|$)/.test(pathname)
  );
}

type Props = {
  accountLabel: string;
  email: string;
  langs: string[];
};

export default function MobileNavLoggedIn({ accountLabel, email, langs }: Props) {
  const pathname = usePathname();
  const practice = isPracticePath(pathname);
  const [dictOpen, setDictOpen] = useState(false);

  useEffect(() => {
    setDictOpen(false);
  }, [pathname]);

  if (practice) {
    return (
      <div className="md:hidden">
        <div className="flex min-h-11 items-center justify-between gap-2 py-1">
          <div className="min-w-0 shrink-0">
            <LogoHomeLink className="flex items-center gap-2 font-semibold tracking-tight">
              <span
                data-top-nav-target="logo"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black text-[11px] font-extrabold text-white"
              >
                PLL
              </span>
            </LogoHomeLink>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setDictOpen((v) => !v)}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-solid)] px-2.5 py-1.5 text-xs font-semibold text-[var(--foreground)] shadow-sm hover:bg-[var(--surface-muted)]"
              aria-expanded={dictOpen}
              aria-controls="pll-mobile-dictionary-panel"
            >
              Dictionary
            </button>
            <ThemeToggle />
            <MobileAccountMenu email={email} accountLabel={accountLabel} />
          </div>
        </div>

        {dictOpen ? (
          <div
            id="pll-mobile-dictionary-panel"
            className="border-t border-[var(--border)] bg-[var(--surface-solid)]/95 px-2 py-2 backdrop-blur-md"
          >
            <DictionaryHeaderSearch
              langs={langs}
              layout="panel"
              onRequestClose={() => setDictOpen(false)}
            />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 py-2 sm:gap-3 sm:py-3 md:hidden">
      <div className="flex min-w-0 items-center justify-between gap-3 sm:gap-4">
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

        <div className="flex items-center gap-2.5">
          <ThemeToggle />
          <MobileAccountMenu email={email} accountLabel={accountLabel} />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <DictionaryHeaderSearch langs={langs} />
      </div>
    </div>
  );
}
