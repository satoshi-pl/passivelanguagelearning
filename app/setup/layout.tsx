import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Setting up your decks | Passive Language Learning",
  description: "One-time setup for your practice library.",
};

export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
