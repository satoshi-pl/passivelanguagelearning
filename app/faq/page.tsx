import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "../components/Container";
import { FAQ_SECTIONS, faqJsonLd } from "./faq-content";

const SITE_URL = "https://passivelanguagelearning.io";

export const metadata: Metadata = {
  title: {
    absolute: "Questions & answers — Passive Language Learning",
  },
  description:
    "How Passive Language Learning’s passive-first method works, when Active Learning unlocks, review without limits, Favourites, languages (English & Spanish), support languages, audio, and learning philosophy.",
  alternates: {
    canonical: "/faq",
  },
  openGraph: {
    title: "Questions & answers — Passive Language Learning",
    description:
      "Understand Passive Language Learning’s passive-first method, active recall, review, Favourites, and which languages are available.",
    url: `${SITE_URL}/faq`,
    siteName: "Passive Language Learning",
    type: "website",
    locale: "en",
  },
};

export default function FaqPage() {
  const jsonLd = faqJsonLd();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="text-[var(--foreground)]">
        <Container>
          <article className="mx-auto max-w-3xl pb-16 pt-4 sm:pt-6 lg:max-w-4xl">
            <nav className="text-sm text-[var(--foreground-muted)]">
              <Link href="/" className="hover:text-[var(--foreground)] hover:underline">
                Home
              </Link>
              <span aria-hidden className="mx-2 text-[var(--border-strong)]">
                /
              </span>
              <span className="text-[var(--foreground)]">Q&amp;A</span>
            </nav>

            <header className="mt-8 border-b border-[var(--border)] pb-10">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-muted)]">
                Passive Language Learning
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--foreground)] sm:text-4xl">
                Questions &amp; answers
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-[var(--foreground-muted)] sm:text-lg">
                Clear explanations of how Passive Language Learning works — the passive-first path, active
                recall, review, Favourites, and the ideas behind a calmer, more structured way to learn English
                and Spanish.
              </p>
            </header>

            <div className="mt-10 space-y-14 sm:space-y-16">
              {FAQ_SECTIONS.map((section) => (
                <section key={section.id} id={section.id} className="scroll-mt-24">
                  <h2 className="text-xl font-semibold tracking-tight text-[var(--foreground)] sm:text-2xl">
                    {section.title}
                  </h2>
                  <dl className="mt-8 space-y-10">
                    {section.items.map((item) => (
                      <div key={item.id} id={item.id} className="scroll-mt-24">
                        <dt className="text-base font-semibold text-[var(--foreground)]">{item.question}</dt>
                        <dd className="mt-2 text-[15px] leading-relaxed text-[var(--foreground-muted)] sm:text-base">
                          {item.answer}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>

            <footer className="mt-16 border-t border-[var(--border)] pt-10">
              <p className="text-lg font-semibold text-[var(--foreground)]">Enjoy the progress!</p>
              <p className="mt-2 text-sm text-[var(--foreground-muted)]">
                Ready to try the method? Start from the home page — passive learning first, then active
                when you are ready, with review always available.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/"
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-6 text-sm font-medium text-white hover:bg-neutral-800"
                >
                  Back to home
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--surface-solid)] px-6 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
                >
                  Create account
                </Link>
              </div>
            </footer>
          </article>
        </Container>
      </div>
    </>
  );
}
