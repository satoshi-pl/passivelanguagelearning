import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Container } from "./Container";

/**
 * Subtle help + legal links for signed-out visitors. Shown below main content (e.g. under auth cards).
 */
export async function FooterMeta() {
  noStore();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return null;

  return (
    <footer className="mt-16 border-t border-[var(--border)] pb-10 pt-8 md:mt-24 md:pb-12 md:pt-10 lg:mt-28">
      <Container>
        <nav
          className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-center text-[11px] text-neutral-500 sm:gap-x-8 sm:text-xs"
          aria-label="Help and legal"
        >
          <Link href="/faq" prefetch={false} className="transition-colors hover:text-neutral-700">
            Q&amp;A
          </Link>
          <Link href="/privacy" prefetch={false} className="transition-colors hover:text-neutral-700">
            Privacy Policy
          </Link>
          <Link href="/terms" prefetch={false} className="transition-colors hover:text-neutral-700">
            Terms of Service
          </Link>
        </nav>
      </Container>
    </footer>
  );
}
