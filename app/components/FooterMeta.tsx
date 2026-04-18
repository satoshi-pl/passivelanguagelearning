import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Container } from "./Container";

/**
 * Subtle help + legal links for signed-out visitors. Shown below main content (e.g. under auth cards).
 * Hidden on `/login` for a focused sign-in screen (pathname from middleware `x-pll-pathname`).
 */
export async function FooterMeta() {
  noStore();

  const pathname = (await headers()).get("x-pll-pathname") ?? "";
  if (pathname === "/login") return null;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return null;

  const isLanding = pathname === "/";

  const footerShellClass = isLanding
    ? "mt-0 border-t border-[var(--border)] bg-[var(--surface-muted)]/45 pb-14 pt-12 md:pb-16 md:pt-16"
    : "mt-16 border-t border-[var(--border)] pb-10 pt-8 md:mt-24 md:pb-12 md:pt-10 lg:mt-28";

  const navClass = isLanding
    ? "flex flex-wrap items-center justify-center gap-x-8 gap-y-2.5 text-center text-xs text-[var(--foreground-muted)] tracking-wide sm:gap-x-10 sm:text-[0.8125rem]"
    : "flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-center text-[11px] text-neutral-500 sm:gap-x-8 sm:text-xs";

  const linkClass = isLanding
    ? "transition-colors hover:text-[var(--foreground)]"
    : "transition-colors hover:text-neutral-700";

  return (
    <footer className={footerShellClass}>
      <Container>
        <nav className={navClass} aria-label="Help and legal">
          <Link href="/faq" prefetch={false} className={linkClass}>
            Q&amp;A
          </Link>
          <Link href="/privacy" prefetch={false} className={linkClass}>
            Privacy Policy
          </Link>
          <Link href="/terms" prefetch={false} className={linkClass}>
            Terms of Service
          </Link>
        </nav>
      </Container>
    </footer>
  );
}
