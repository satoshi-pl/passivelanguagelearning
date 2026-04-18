import type { ReactNode } from "react";
import Link from "next/link";
import { Container } from "../Container";

type LandingViewProps = {
  isLoggedIn: boolean;
};

function SectionShell({
  id,
  eyebrow,
  title,
  children,
  className = "",
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-24 border-t border-[var(--border)] py-14 sm:py-16 ${className}`}
    >
      <div className="mx-auto max-w-3xl lg:max-w-4xl">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-muted)]">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">
          {title}
        </h2>
        <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-[var(--foreground-muted)] sm:text-base">
          {children}
        </div>
      </div>
    </section>
  );
}

function ValueCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-solid)] p-4 shadow-[var(--shadow)] sm:p-5">
      <h3 className="text-sm font-semibold text-[var(--foreground)]">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">{text}</p>
    </div>
  );
}

const btnPrimary =
  "inline-flex h-11 w-full items-center justify-center rounded-xl bg-black px-6 text-base font-medium text-white transition hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 sm:w-auto";

const btnSecondary =
  "inline-flex h-11 w-full items-center justify-center rounded-xl bg-neutral-100 px-6 text-base font-medium text-neutral-900 transition hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 sm:w-auto";

export default function LandingView({ isLoggedIn }: LandingViewProps) {
  const primaryHref = isLoggedIn ? "/decks" : "/signup";
  const primaryLabel = isLoggedIn ? "Go to my decks" : "Create free account";
  const secondaryHref = isLoggedIn ? "/account" : "/login";
  const secondaryLabel = isLoggedIn ? "Account" : "Log in";

  return (
    <div className="text-[var(--foreground)]">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[var(--border)] pb-14 pt-6 sm:pb-16 sm:pt-10">
        <Container>
          <div className="relative mx-auto max-w-3xl lg:max-w-4xl">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-24 -top-16 h-72 w-72 rounded-full opacity-[0.14]"
              style={{
                background:
                  "radial-gradient(circle at 30% 30%, rgba(59, 130, 246, 0.35), transparent 55%)",
              }}
            />
            <div className="relative">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground-muted)]">
                Passive Language Learning
              </p>
              <h1 className="mt-3 text-[1.75rem] font-semibold leading-[1.12] tracking-[-0.03em] text-[var(--foreground)] sm:text-4xl lg:text-[2.65rem]">
                Calm, structured English and Spanish learning — understanding first, recall when
                you are ready.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-[var(--foreground-muted)] sm:text-lg">
                PLL is a focused, deck-based practice space for words and sentences. You begin in{" "}
                <strong className="font-semibold text-[var(--foreground)]">Passive Learning</strong>{" "}
                (see the target language first), then unlock{" "}
                <strong className="font-semibold text-[var(--foreground)]">Active Learning</strong>{" "}
                when an item is mastered — with open-ended review whenever you want.
              </p>
              <p className="mt-6 text-lg font-medium tracking-tight text-[var(--foreground)] sm:text-xl">
                Enjoy the progress!
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link href={primaryHref} className={`${btnPrimary}`}>
                  {primaryLabel}
                </Link>
                <Link href={secondaryHref} className={`${btnSecondary}`}>
                  {secondaryLabel}
                </Link>
                <Link
                  href="/faq"
                  className="text-center text-sm font-medium text-[var(--foreground-muted)] underline-offset-4 hover:text-[var(--foreground)] hover:underline sm:ml-2"
                >
                  Read Q&amp;A
                </Link>
              </div>
            </div>

            {/* Product composition — abstract, calm */}
            <div className="relative mt-12 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-solid)] p-4 shadow-[var(--shadow)] sm:col-span-2 sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
                  Session flow
                </p>
                <ol className="mt-4 space-y-3 text-sm text-[var(--foreground-muted)]">
                  <li className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] text-xs font-bold text-[var(--foreground)]">
                      1
                    </span>
                    <span>
                      <span className="font-medium text-[var(--foreground)]">Passive</span> — target
                      language first, connect to meaning in your support language.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] text-xs font-bold text-[var(--foreground)]">
                      2
                    </span>
                    <span>
                      <span className="font-medium text-[var(--foreground)]">Active</span> — unlocks
                      after passive mastery; recall from support back into the target language.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] text-xs font-bold text-[var(--foreground)]">
                      3
                    </span>
                    <span>
                      <span className="font-medium text-[var(--foreground)]">Review</span> — revisit
                      passive or active material whenever you like.
                    </span>
                  </li>
                </ol>
              </div>
              <div className="flex flex-col justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4 sm:p-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-muted)]">
                    Designed for focus
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">
                    No streaks, levels, or noisy reward loops — just clear stages and room to think.
                  </p>
                </div>
                <p className="text-xs leading-relaxed text-[var(--foreground-muted)]">
                  Words · Words + sentences · Sentences · Categories · Audio
                </p>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Value strip */}
      <section className="border-b border-[var(--border)] bg-[var(--surface-muted)]/50 py-10 sm:py-12">
        <Container>
          <div className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-2 lg:max-w-5xl lg:grid-cols-4 lg:gap-4">
            <ValueCard
              title="Calm by design"
              text="A quiet interface so attention stays on language — not notifications or pressure."
            />
            <ValueCard
              title="Words and sentences"
              text="Practice vocabulary alone, in context, or both in a structured path."
            />
            <ValueCard
              title="Structured progress"
              text="Passive mastery unlocks active work; review stays available without limits."
            />
            <ValueCard
              title="Review that matters"
              text="Revisit what you have already learned to reinforce it — progress is not erased."
            />
          </div>
        </Container>
      </section>

      <Container>
        <SectionShell eyebrow="Overview" title="What PLL is">
          <p>
            PLL is deck-based language learning: you choose a{" "}
            <strong className="font-medium text-[var(--foreground)]">target language</strong>{" "}
            (English or Spanish) and a{" "}
            <strong className="font-medium text-[var(--foreground)]">support language</strong> for
            explanations and translations. Each deck offers practice modes for{" "}
            <strong className="font-medium text-[var(--foreground)]">words</strong>,{" "}
            <strong className="font-medium text-[var(--foreground)]">words + sentences</strong>, or{" "}
            <strong className="font-medium text-[var(--foreground)]">sentences</strong> alone, with
            optional <strong className="font-medium text-[var(--foreground)]">categories</strong> to
            narrow focus, <strong className="font-medium text-[var(--foreground)]">audio</strong> for
            listening, and <strong className="font-medium text-[var(--foreground)]">Favourites</strong>{" "}
            for a personal set you return to often.
          </p>
        </SectionShell>

        <SectionShell id="passive-first" eyebrow="Method" title="Why start with Passive Learning?">
          <p>
            In Passive Learning you see the{" "}
            <strong className="font-medium text-[var(--foreground)]">target language first</strong>{" "}
            and connect it to meaning in your support language. That direction emphasises{" "}
            <strong className="font-medium text-[var(--foreground)]">recognition and understanding</strong>{" "}
            before you have to produce the language yourself — so early sessions feel lighter, clearer,
            and more naturally rewarding.
          </p>
          <p>
            PLL is <strong className="font-medium text-[var(--foreground)]">not passive-only</strong>: it
            uses this stage as a foundation, then invites stronger recall when you are ready.
          </p>
        </SectionShell>

        <SectionShell eyebrow="Product" title="How PLL works">
          <ul className="list-none space-y-4 pl-0">
            <li className="rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] p-4 sm:p-5">
              <h3 className="text-base font-semibold text-[var(--foreground)]">Passive Learning</h3>
              <p className="mt-2">
                Target language first → support language meaning. Mark items{" "}
                <strong className="font-medium text-[var(--foreground)]">Mastered</strong> when you
                recognise them confidently.
              </p>
            </li>
            <li className="rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] p-4 sm:p-5">
              <h3 className="text-base font-semibold text-[var(--foreground)]">Active Learning</h3>
              <p className="mt-2">
                Unlocks only after an item is mastered in Passive Learning. You work from the support
                language back into the target language — more demanding, and built on understanding
                you have already established.
              </p>
            </li>
            <li className="rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] p-4 sm:p-5">
              <h3 className="text-base font-semibold text-[var(--foreground)]">Review</h3>
              <p className="mt-2">
                Separate flows for reviewing passive material and active material. Use review as much as
                you want — there is no cap. Marking something mastered does not remove it from your life;
                you can always revisit it.
              </p>
            </li>
            <li className="rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] p-4 sm:p-5">
              <h3 className="text-base font-semibold text-[var(--foreground)]">Favourites</h3>
              <p className="mt-2">
                Save important words or sentences and practise them on their own, alongside your regular
                deck flow.
              </p>
            </li>
          </ul>
        </SectionShell>

        <SectionShell eyebrow="Path" title="Passive first, active next">
          <p>
            Active Learning unlocks{" "}
            <strong className="font-medium text-[var(--foreground)]">only after</strong> passive
            mastery. That order keeps recall grounded in something you already recognise, instead of
            forcing production too early.
          </p>
          <p>
            Review stays available afterward — so the path is{" "}
            <strong className="font-medium text-[var(--foreground)]">passive → active → review on your terms</strong>
            , without pressure to rush.
          </p>
        </SectionShell>

        <SectionShell eyebrow="Philosophy" title="Focused learning, not gamification">
          <p>
            PLL is designed for learners who benefit from a calmer rhythm:{" "}
            <strong className="font-medium text-[var(--foreground)]">no streaks</strong>,{" "}
            <strong className="font-medium text-[var(--foreground)]">no levels</strong>,{" "}
            <strong className="font-medium text-[var(--foreground)]">no confetti</strong>, and no noisy
            reward mechanics. The reward is meant to be the work itself — clearer understanding, steadier
            recall, and a sense of real movement.{" "}
            <span className="font-medium text-[var(--foreground)]">Enjoy the progress!</span>
          </p>
          <p>
            That is a deliberate choice: many people learn better when the app gets out of the way and
            leaves room for attention, reflection, and honest practice.
          </p>
        </SectionShell>

        <SectionShell eyebrow="Practice" title="What you can practise">
          <ul className="list-disc space-y-2 pl-5 marker:text-[var(--foreground-muted)]">
            <li>Words only, sentences only, or words and sentences together</li>
            <li>Category filters for targeted sessions</li>
            <li>Favourites for a personal shortlist</li>
            <li>Audio alongside text</li>
            <li>Passive review and active review without limits</li>
          </ul>
        </SectionShell>

        <SectionShell eyebrow="Fit" title="Who PLL is for">
          <p>
            PLL suits learners who want structure without spectacle: people who prefer calm screens,
            meaningful repetition, and progress they can feel — not pressure to maintain artificial
            scores. It is for anyone who wants to improve English or Spanish in a thoughtful, sustained
            way.
          </p>
        </SectionShell>

        <SectionShell eyebrow="Availability" title="Currently available">
          <p>
            <strong className="font-medium text-[var(--foreground)]">Target languages:</strong> English
            and Spanish.
          </p>
          <p>
            <strong className="font-medium text-[var(--foreground)]">Support languages:</strong> English,
            Spanish, German, French, Italian, Portuguese, Turkish, and Polish.
          </p>
        </SectionShell>

        {/* Q&A teaser */}
        <section className="border-t border-[var(--border)] py-14 sm:py-16">
          <div className="mx-auto max-w-3xl lg:max-w-4xl">
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">
              Common questions
            </h2>
            <p className="mt-3 text-[var(--foreground-muted)]">
              Short answers below — the full Q&amp;A goes deeper on the method, review, and philosophy.
            </p>
            <dl className="mt-8 space-y-6">
              <div>
                <dt className="font-semibold text-[var(--foreground)]">When does Active Learning unlock?</dt>
                <dd className="mt-1 text-[var(--foreground-muted)]">
                  After you master an item in Passive Learning — so active recall builds on recognition.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-[var(--foreground)]">Can I review without limits?</dt>
                <dd className="mt-1 text-[var(--foreground-muted)]">
                  Yes. Passive and active review are available whenever you want.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-[var(--foreground)]">What if I mark something mastered too early?</dt>
                <dd className="mt-1 text-[var(--foreground-muted)]">
                  You can still review it anytime. Nothing is taken away from you.
                </dd>
              </div>
            </dl>
            <div className="mt-10">
              <Link
                href="/faq"
                className="inline-flex items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--surface-solid)] px-5 py-2.5 text-sm font-semibold text-[var(--foreground)] shadow-sm hover:bg-[var(--surface-muted)]"
              >
                Open full Q&amp;A
              </Link>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-[var(--border)] bg-[var(--surface-muted)]/40 py-16 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">
              Enjoy the progress!
            </p>
            <p className="mx-auto mt-4 max-w-lg text-[var(--foreground-muted)]">
              Start with understanding. Build recall when PLL unlocks the next step. Practise and review
              on your own terms.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href={primaryHref} className={`${btnPrimary} min-w-[200px]`}>
                {primaryLabel}
              </Link>
              <Link href="/faq" className={`${btnSecondary} min-w-[200px]`}>
                Read Q&amp;A
              </Link>
            </div>
          </div>
        </section>
      </Container>
    </div>
  );
}
