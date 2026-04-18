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
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] pll-landing__muted">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">
          {title}
        </h2>
        <div className="mt-6 space-y-4 text-[15px] leading-relaxed sm:text-base pll-landing__body">
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
      <p className="mt-2 text-sm leading-relaxed pll-landing__body">{text}</p>
    </div>
  );
}

const btnPrimary =
  "inline-flex h-11 w-full items-center justify-center rounded-xl bg-black px-6 text-base font-medium text-white transition hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 sm:w-auto";

/** Hero primary only — larger than default `btnPrimary` */
const heroBtnPrimary =
  "inline-flex h-12 w-full min-h-12 shrink-0 items-center justify-center rounded-xl bg-black px-8 text-base font-semibold text-white transition hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 sm:w-auto sm:min-w-[12rem] sm:text-lg";

export default function LandingView({ isLoggedIn }: LandingViewProps) {
  const primaryHref = isLoggedIn ? "/decks" : "/signup";
  const primaryLabel = isLoggedIn ? "Go to my decks" : "Create account";

  return (
    <div className="pll-landing text-[var(--foreground)]">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[var(--border)] pb-12 pt-5 sm:pb-14 sm:pt-8 md:pt-10">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative mx-auto max-w-3xl lg:max-w-none">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-24 -top-16 h-72 w-72 rounded-full opacity-[0.14]"
              style={{
                background:
                  "radial-gradient(circle at 30% 30%, rgba(59, 130, 246, 0.35), transparent 55%)",
              }}
            />
            <div className="relative">
              <p className="max-w-3xl text-[11px] font-semibold uppercase tracking-[0.14em] pll-landing__muted">
                Passive Language Learning
              </p>
              <h1 className="mt-2 text-[1.65rem] font-semibold leading-snug tracking-[-0.03em] text-[var(--foreground)] sm:mt-3 sm:text-[1.95rem] md:text-[2.15rem] lg:text-[2.45rem] xl:text-[2.6rem] lg:whitespace-nowrap">
                Understand first. Learn with less friction. Enjoy more.
              </h1>
              <div className="mt-4 max-w-3xl sm:mt-5">
                <p className="text-base leading-relaxed sm:text-lg pll-landing__body">
                  A focused, deck-based space for <span className="pll-k">words</span> and{" "}
                  <span className="pll-k">sentences</span>. Start with{" "}
                  <span className="pll-k">Passive Learning</span>, unlock{" "}
                  <span className="pll-k">Active Learning</span> after mastery, and use{" "}
                  <span className="pll-k">Review</span> whenever you want extra reinforcement.
                </p>
              </div>
              <div
                className="mt-7 flex w-full max-w-3xl flex-col-reverse items-center gap-2.5 pl-0 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6 sm:pl-4 md:pl-8 lg:gap-8 lg:pl-12"
                role="group"
                aria-label="Signature and primary action"
              >
                <span className="inline-flex items-center justify-center rounded-full border border-[var(--border)]/70 bg-transparent px-3 py-1.5 text-xs font-medium tracking-wide text-[var(--foreground-muted)] sm:border-[var(--border)] sm:bg-[var(--surface-muted)]/55 sm:px-6 sm:py-3 sm:text-base sm:font-semibold sm:tracking-[0.08em] sm:text-[var(--foreground)] sm:shadow-sm">
                  Enjoy the progress!
                </span>
                <Link href={primaryHref} className={heroBtnPrimary}>
                  {primaryLabel}
                </Link>
              </div>
            </div>

            {/* Product composition */}
            <div className="relative mt-9 grid grid-cols-1 gap-4 md:mt-10 md:grid-cols-2 md:items-stretch md:gap-5 lg:gap-6">
              <div className="flex min-h-0 flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface-solid)] p-5 shadow-[var(--shadow)] md:p-6">
                <p className="text-xs font-semibold uppercase tracking-wide pll-landing__muted">
                  Session flow
                </p>
                <ol className="mt-3 flex-1 space-y-2.5 text-sm pll-landing__body sm:space-y-3">
                  <li className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] text-xs font-bold text-[var(--foreground)]">
                      1
                    </span>
                    <span>
                      <span className="pll-k">Passive</span> — see the{" "}
                      <span className="pll-k">target language</span> first and connect it to meaning.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] text-xs font-bold text-[var(--foreground)]">
                      2
                    </span>
                    <span>
                      <span className="pll-k">Active</span> — unlocks after passive mastery and builds{" "}
                      <span className="pll-k">recall</span>.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] text-xs font-bold text-[var(--foreground)]">
                      3
                    </span>
                    <span>
                      <span className="pll-k">Review</span> — revisit material whenever you want.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] text-xs font-bold text-[var(--foreground)]">
                      4
                    </span>
                    <span>
                      <span className="pll-k">Favourites</span> — keep important words and sentences close
                      for learning and review.
                    </span>
                  </li>
                </ol>
              </div>
              <div className="flex min-h-0 flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-solid)] p-5 shadow-[var(--shadow)] md:p-6">
                <p className="text-xs font-semibold uppercase tracking-wide pll-landing__muted">
                  Designed for focused learning
                </p>
                <ul className="list-none space-y-2.5 text-[0.8125rem] leading-relaxed text-[var(--foreground-muted)] sm:text-sm">
                  <li className="flex gap-2.5">
                    <span className="shrink-0 font-normal text-[var(--foreground-muted)]/80" aria-hidden>
                      •
                    </span>
                    <span>
                      <span className="font-semibold text-[var(--foreground)]">No streak pressure</span>
                      {" → you learn at your own rhythm"}
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="shrink-0 font-normal text-[var(--foreground-muted)]/80" aria-hidden>
                      •
                    </span>
                    <span>
                      <span className="font-semibold text-[var(--foreground)]">No levels or gamification</span>
                      {" → focus stays on the language"}
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="shrink-0 font-normal text-[var(--foreground-muted)]/80" aria-hidden>
                      •
                    </span>
                    <span>
                      <span className="font-semibold text-[var(--foreground)]">No noise</span>
                      {" → just repetition, clarity, and progress"}
                    </span>
                  </li>
                </ul>
                <p className="text-sm leading-relaxed pll-landing__body">
                  Just a clear structure, meaningful repetition, and space to focus on the language itself.
                </p>
              </div>
            </div>
          </div>
        </div>
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
        <SectionShell eyebrow="Overview" title="What is Passive Language Learning?">
          <p>
            Passive Language Learning is a structured way to learn languages through{" "}
            <span className="pll-k">words</span> and <span className="pll-k">sentences</span>.
          </p>
          <p className="mt-4">
            You choose a <span className="pll-k">target language</span> (English or Spanish) and a{" "}
            <span className="pll-k">support language</span> for meaning and explanations. Each deck lets
            you practise:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 marker:text-[var(--foreground-muted)]">
            <li>
              <span className="pll-k">words</span>
            </li>
            <li>
              <span className="pll-k">words + sentences</span>
            </li>
            <li>
              <span className="pll-k">sentences</span>
            </li>
          </ul>
          <p className="mt-4">
            You can also use <span className="pll-k">categories</span> to focus your learning,{" "}
            <span className="pll-k">audio</span> to support listening, and{" "}
            <span className="pll-k">Favourites</span> to revisit important items.
          </p>
        </SectionShell>

        <SectionShell id="passive-first" eyebrow="Method" title="Why start with Passive Learning?">
          <p>
            In <span className="pll-k">Passive Learning</span> you see the{" "}
            <span className="pll-k">target language</span> first and connect it to meaning in your{" "}
            <span className="pll-k">support language</span>. That direction emphasises{" "}
            <span className="pll-k">recognition</span> and <span className="pll-k">understanding</span>{" "}
            before you have to produce the language yourself — so early sessions feel lighter, clearer,
            and more naturally rewarding.
          </p>
          <p className="mt-4">
            The approach is <span className="pll-k">not passive-only</span>: it uses this stage as a
            foundation, then invites stronger <span className="pll-k">recall</span> when you are ready.
          </p>
        </SectionShell>

        <SectionShell eyebrow="Product" title="How it works">
          <ul className="list-none space-y-4 pl-0">
            <li className="rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] p-4 sm:p-5">
              <h3 className="text-base font-semibold text-[var(--foreground)]">Passive Learning</h3>
              <p className="mt-2 pll-landing__body">
                <span className="pll-k">Target language</span> first →{" "}
                <span className="pll-k">support language</span> meaning. Mark items{" "}
                <span className="pll-k">Mastered</span> when you recognise them confidently.
              </p>
            </li>
            <li className="rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] p-4 sm:p-5">
              <h3 className="text-base font-semibold text-[var(--foreground)]">Active Learning</h3>
              <p className="mt-2 pll-landing__body">
                Unlocks only after an item is mastered in Passive Learning. You work from the{" "}
                <span className="pll-k">support language</span> back into the{" "}
                <span className="pll-k">target language</span> — more demanding, and built on
                understanding you have already established.
              </p>
            </li>
            <li className="rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] p-4 sm:p-5">
              <h3 className="text-base font-semibold text-[var(--foreground)]">Review</h3>
              <p className="mt-2 pll-landing__body">
                Separate flows for reviewing passive material and active material. Use{" "}
                <span className="pll-k">Review</span> as much as you want — there is no cap. Marking
                something mastered does not remove it from your life; you can always revisit it.
              </p>
            </li>
            <li className="rounded-xl border border-[var(--border)] bg-[var(--surface-solid)] p-4 sm:p-5">
              <h3 className="text-base font-semibold text-[var(--foreground)]">Favourites</h3>
              <p className="mt-2 pll-landing__body">
                Save important <span className="pll-k">words</span> or{" "}
                <span className="pll-k">sentences</span> and practise them on their own, alongside your
                regular deck flow.
              </p>
            </li>
          </ul>
        </SectionShell>

        <SectionShell eyebrow="Path" title="Passive first, active next">
          <p>
            <span className="pll-k">Active Learning</span> unlocks{" "}
            <span className="pll-k">only after</span> passive mastery. That order keeps recall grounded
            in something you already recognise, instead of forcing production too early.
          </p>
          <p className="mt-4">
            <span className="pll-k">Review</span> stays available afterward — so the path is{" "}
            <span className="pll-k">passive → active → review on your terms</span>, without pressure to
            rush.
          </p>
        </SectionShell>

        <SectionShell eyebrow="Philosophy" title="Focused learning, not gamification">
          <p>
            Passive Language Learning is built for learners who benefit from a calmer rhythm:{" "}
            <span className="pll-k">no streaks</span>,{" "}
            <span className="pll-k">no levelling-up systems</span>,{" "}
            <span className="pll-k">no confetti</span>, and no noisy reward mechanics. The reward is
            meant to be the work itself — clearer <span className="pll-k">understanding</span>, steadier{" "}
            <span className="pll-k">recall</span>, and a sense of real movement.{" "}
            <span className="pll-k">Enjoy the progress!</span>
          </p>
          <p className="mt-4">
            That is a deliberate choice: many people learn better when the app gets out of the way and
            leaves room for attention, reflection, and honest practice.
          </p>
        </SectionShell>

        <SectionShell eyebrow="Practice" title="What you can practise">
          <ul className="list-disc space-y-2 pl-5 marker:text-[var(--foreground-muted)]">
            <li>
              <span className="pll-k">Words</span> only, <span className="pll-k">sentences</span> only, or{" "}
              <span className="pll-k">words and sentences</span> together
            </li>
            <li>
              <span className="pll-k">Category</span> filters for targeted sessions
            </li>
            <li>
              <span className="pll-k">Favourites</span> for a personal shortlist
            </li>
            <li>
              <span className="pll-k">Audio</span> alongside text
            </li>
            <li>
              Passive <span className="pll-k">review</span> and active <span className="pll-k">review</span>{" "}
              without limits
            </li>
          </ul>
        </SectionShell>

        <SectionShell eyebrow="Fit" title="Who is it for?">
          <p>
            It suits learners who want structure without spectacle: people who prefer calm screens,
            meaningful repetition, and progress they can feel — not pressure to maintain artificial
            scores. It is for anyone who wants to improve English or Spanish in a thoughtful, sustained way.
          </p>
        </SectionShell>

        <SectionShell eyebrow="Availability" title="Currently available">
          <p>
            <span className="pll-k">Target languages:</span> English and Spanish.
          </p>
          <p className="mt-3">
            <span className="pll-k">Support languages:</span> English, Spanish, German, French, Italian,
            Portuguese, Turkish, and Polish.
          </p>
        </SectionShell>

        {/* Q&A teaser */}
        <section className="border-t border-[var(--border)] py-14 sm:py-16">
          <div className="mx-auto max-w-3xl lg:max-w-4xl">
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--foreground)] sm:text-3xl">
              Common questions
            </h2>
            <p className="mt-3 pll-landing__muted">
              Short answers below — the full Q&amp;A goes deeper on the method, review, and philosophy.
            </p>
            <dl className="mt-8 space-y-6">
              <div>
                <dt className="font-semibold text-[var(--foreground)]">When does Active Learning unlock?</dt>
                <dd className="mt-1 pll-landing__body">
                  After you master an item in Passive Learning — so active recall builds on recognition.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-[var(--foreground)]">Can I review without limits?</dt>
                <dd className="mt-1 pll-landing__body">
                  Yes. Passive and active review are available whenever you want.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-[var(--foreground)]">
                  What if I mark something mastered too early?
                </dt>
                <dd className="mt-1 pll-landing__body">
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
            <p className="mx-auto mt-4 max-w-lg pll-landing__body">
              Start with <span className="pll-k">understanding</span>. Build{" "}
              <span className="pll-k">recall</span> when the next stage unlocks. Practise and{" "}
              <span className="pll-k">review</span> on your own terms.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-5 sm:flex-row sm:gap-10">
              <Link href={primaryHref} className={`${btnPrimary} min-w-[200px]`}>
                {primaryLabel}
              </Link>
              <Link
                href="/faq"
                className="text-sm font-medium text-[var(--foreground-muted)] underline decoration-[var(--border-strong)] underline-offset-[5px] transition hover:text-[var(--foreground)] hover:decoration-[var(--foreground-muted)]"
              >
                Read Q&amp;A
              </Link>
            </div>
          </div>
        </section>
      </Container>
    </div>
  );
}
