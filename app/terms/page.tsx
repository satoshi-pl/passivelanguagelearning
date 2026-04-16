import type { Metadata } from "next";
import { Container } from "../components/Container";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card";

const CONTACT_EMAIL = "m.kaczmarek890@gmail.com";
const LAST_UPDATED = "April 16, 2026";

export const metadata: Metadata = {
  title: "Terms of Service | Passive Language Learning",
  description: "Draft terms of service for Passive Language Learning.",
};

export default function TermsPage() {
  return (
    <Container>
      <div className="mx-auto max-w-3xl py-6 sm:py-8">
        <Card>
          <CardHeader className="space-y-2 pb-3">
            <CardTitle className="text-2xl sm:text-3xl">Terms of Service</CardTitle>
            <CardDescription>
              These are simple draft terms for using Passive Language Learning.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-sm leading-6 text-neutral-700 sm:text-[15px]">
            <section className="space-y-2">
              <h2 className="text-base font-semibold text-neutral-900 sm:text-lg">Use of the service</h2>
              <p>
                Passive Language Learning is provided for personal educational and language-learning use. Please use
                the service lawfully and respectfully.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-neutral-900 sm:text-lg">Acceptable behavior</h2>
              <p>You agree not to misuse the service, including attempts to:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>abuse, disrupt, or interfere with normal app operation,</li>
                <li>scrape content or access data in unauthorized ways,</li>
                <li>reverse engineer or probe the service beyond lawful, permitted use.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-neutral-900 sm:text-lg">Accounts</h2>
              <p>You are responsible for activity on your account and for keeping your sign-in access secure.</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-neutral-900 sm:text-lg">Product changes and availability</h2>
              <p>
                Features may change over time. The service is provided on an &quot;as is&quot; and &quot;as
                available&quot; basis.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-neutral-900 sm:text-lg">Suspension for misuse</h2>
              <p>We may limit or suspend access if we reasonably believe the service is being misused.</p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-neutral-900 sm:text-lg">Your content</h2>
              <p>
                You keep ownership of content you submit. You grant permission for us to process that content as needed
                to run and improve the service.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-neutral-900 sm:text-lg">Questions</h2>
              <p>
                For terms-related questions, contact:{" "}
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
