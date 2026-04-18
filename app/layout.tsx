import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { GoogleAnalytics } from "@next/third-parties/google";
import type { Metadata } from "next";
import GaAuthEventBridge from "./components/GaAuthEventBridge";
import { FooterMeta } from "./components/FooterMeta";
import { NavBar } from "./components/NavBar";

const SITE_URL = "https://passivelanguagelearning.io";
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Passive Language Learning",
    template: "%s | Passive Language Learning",
  },
  description:
    "Calm English and Spanish learning: passive-first recognition, active recall after mastery, review without limits, words and sentences, categories, and audio.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en",
    siteName: "Passive Language Learning",
    url: SITE_URL,
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen transition-colors duration-200">
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var saved = localStorage.getItem("pll-theme");
                  var theme = saved === "dark" || saved === "light"
                    ? saved
                    : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
                  document.documentElement.dataset.theme = theme;
                  document.documentElement.style.colorScheme = theme;
                } catch (e) {}
              })();
            `,
          }}
        />

        <div className="app-shell-glow pointer-events-none fixed inset-0 -z-10">
          <div className="app-shell-glow__halo" />
        </div>

        <NavBar />

        <main className="pt-2 pb-6 sm:pt-3 sm:pb-8 md:py-12 md:pb-10">
          {children}
        </main>

        <FooterMeta />

        {GA_ID ? <GoogleAnalytics gaId={GA_ID} /> : null}
        <GaAuthEventBridge />

        <Analytics />
      </body>
    </html>
  );
}
