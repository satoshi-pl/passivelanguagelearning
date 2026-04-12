import { PracticeMobileHeaderMode } from "../../../components/PracticeMobileHeaderMode";

export default function FavoritesPracticeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PracticeMobileHeaderMode />
      {children}
    </>
  );
}
