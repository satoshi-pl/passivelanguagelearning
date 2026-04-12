import { PracticeMobileHeaderMode } from "../../../components/PracticeMobileHeaderMode";

export default function DeckPracticeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PracticeMobileHeaderMode />
      {children}
    </>
  );
}
