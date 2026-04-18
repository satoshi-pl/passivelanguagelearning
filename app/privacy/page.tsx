import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "../components/Container";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card";

const CONTACT_EMAIL = "m.kaczmarek890@gmail.com";
const LAST_UPDATED = "April 16, 2026";

export const metadata: Metadata = {
  title: "Privacy Policy | Passive Language Learning",
  description: "Privacy policy for Passive Language Learning.",
};

export default function PrivacyPage() {
  return (
    <Container>
      <div className="mx-auto max-w-3xl py-6 sm:py-8">
        <Card>
          <CardHeader className="space-y-2 pb-3">
            <CardTitle className="text-2xl sm:text-3xl">Privacy Policy</CardTitle>
            <CardDescription>
              This privacy policy explains how Passive Language Learning handles your information.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-sm leading-6 text-neutral-700 sm:text-[15px]">
            <section className="space-y-2">
              <h2 className="text-base font-semibold text-neutral-900 sm:text-lg">Who we are</h2>
              <p>
                Passive Language Learning is a language-learning app operated at{" "}
                <Link href="/" className="underline underline-offset-2">
                  passivelanguagelearning.io
                </Link>
                .
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-neutral-900 sm:text-lg">What data we may process</h2>
              <p>To run the app, we may collect or store information such as:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>account information used for sign-in (for example name, email, and auth identifier),</li>
                <li>learning data (for example decks, progress, favorites, preferences, and session-related app data),</li>
                <li>technical information needed to operate, diagnose, and secure the service.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-neutral-900 sm:text-lg">How data is used</h2>
              <p>
                We use data to operate the service, improve the learning experience, and help maintain account and
                platform security.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-neutral-900 sm:text-lg">Third-party services</h2>
              <p>
                Authentication and backend infrastructure may be provided by third-party services such as Google
                Sign-In and Supabase.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-neutral-900 sm:text-lg">Advertising and sales of data</h2>
              <p>We do not sell personal data to advertisers.</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-neutral-900 sm:text-lg">Questions</h2>
              <p>
                If you have privacy questions, contact:{" "}
                <a className="underline underline-offset-2" href={`mailto:${CONTACT_EMAIL}`}>
                  {CONTACT_EMAIL}
                </a>
              </p>
            </section>

            <p className="text-xs text-neutral-500">Last updated: {LAST_UPDATED}</p>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
