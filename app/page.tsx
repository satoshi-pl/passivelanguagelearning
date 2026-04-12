import Link from "next/link";
import { Container } from "./components/Container";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./components/ui/Card";
import { Button } from "./components/ui/Button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { unstable_noStore as noStore } from "next/cache";

export default async function HomePage() {
  noStore(); // avoid any stale caching

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  // ✅ debug flag (OFF by default)
  const showDebug = process.env.PLL_DEBUG === "1";

  // only query count if we will actually show it
  const count = showDebug
    ? (
        await supabase
          .from("decks")
          .select("*", { count: "exact", head: true })
      ).count
    : null;

  return (
    <Container>
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader className="pb-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
              Passive Language Learning
            </div>

            <CardTitle className="mt-3 text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
              <span className="hero-slogan bg-gradient-to-r from-neutral-900 via-neutral-800 to-blue-700 bg-clip-text text-transparent">
                Enjoy the progress.
              </span>
            </CardTitle>

            <CardDescription className="mt-4 text-base leading-relaxed">
              Passive Language Learning that helps you build vocabulary naturally, step by step.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {showDebug && (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
                <div className="flex items-center justify-between gap-3">
                  <span>
                    Supabase: <b>connected</b>
                  </span>
                  <span>
                    Decks in DB: <b>{count ?? 0}</b>
                  </span>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2.5 sm:flex-row">
              {user ? (
                <>
                  <Link href="/decks" className="w-full sm:w-auto">
                    <Button className="w-full">Start learning</Button>
                  </Link>
                  <Link href="/api/logout" className="w-full sm:w-auto">
                    <Button variant="secondary" className="w-full">
                      Logout
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/login" className="w-full sm:w-auto">
                    <Button className="w-full">Start learning</Button>
                  </Link>
                  <Link href="/signup" className="w-full sm:w-auto">
                    <Button variant="secondary" className="w-full">
                      Create account
                    </Button>
                  </Link>
                </>
              )}
            </div>

            <div className="text-xs text-neutral-500">
              Learn in short, focused sessions.
            </div>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
