import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset your password",
  robots: { index: false, follow: false },
};

export default function ConfirmResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
