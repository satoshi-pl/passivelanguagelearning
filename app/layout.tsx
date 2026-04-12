import "./globals.css";
import { NavBar } from "./components/NavBar";

export const metadata = {
  title: "Passive Language Learning",
  description: "Words first, then sentences. Fast 0/1 practice.",
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

        <main className="pt-2 pb-8 sm:pt-3 sm:pb-10 md:py-12">
          {children}
        </main>
      </body>
    </html>
  );
}
