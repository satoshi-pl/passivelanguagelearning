import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import LandingView from "./components/marketing/LandingView";

const SITE_URL = "https://passivelanguagelearning.io";

export const metadata: Metadata = {
  title: {
    absolute:
      "Passive Language Learning — calm English & Spanish practice (passive first, then active)",
  },
  description:
    "PLL is a calm, structured way to learn English or Spanish: Passive Learning (target language first), then Active Learning after mastery, open-ended review, words and sentences, categories, audio, and Favourites. Enjoy the progress!",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Passive Language Learning — calm English & Spanish practice",
    description:
      "Passive-first understanding, then active recall. Review without limits. Words, sentences, categories, audio — no streaks or noisy gamification.",
    url: SITE_URL,
    siteName: "Passive Language Learning",
    type: "website",
    locale: "en",
  },
};

export default async function HomePage() {
  noStore();

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const isLoggedIn = Boolean(userData.user);

  const showDebug = process.env.PLL_DEBUG === "1";
  const count = showDebug
    ? (await supabase.from("decks").select("*", { count: "exact", head: true })).count
    : null;

  return (
    <>
      {showDebug ? (
        <div className="mx-auto mb-4 max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700 dark:border-[var(--border)] dark:bg-[var(--surface-soft)] dark:text-[var(--foreground-muted)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>
                Supabase: <b>connected</b>
              </span>
              <span>
                Decks in DB: <b>{count ?? 0}</b>
              </span>
            </div>
          </div>
        </div>
      ) : null}
      <LandingView isLoggedIn={isLoggedIn} />
    </>
  );
}
