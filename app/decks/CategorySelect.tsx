"use client";

import { useRouter } from "next/navigation";

type Mode = "words" | "ws" | "sentences";

type CategoryOption = {
  value: string;
  label: string;
};

type Props = {
  deckId: string;
  mode: Mode;
  backToDecksHref: string;
  selectedCategory: string | null;
  categories: CategoryOption[];
};

export default function CategorySelect({
  deckId,
  mode,
  backToDecksHref,
  selectedCategory,
  categories,
}: Props) {
  const router = useRouter();

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Category</div>

      <select
        value={selectedCategory ?? ""}
        onChange={(e) => {
          const value = e.currentTarget.value.trim();
          const qs = new URLSearchParams();

          qs.set("mode", mode);
          qs.set("back", backToDecksHref);

          if (value) {
            qs.set("category", value);
          }

          router.push(`/decks/${deckId}?${qs.toString()}`);
        }}
        style={{
          minWidth: 240,
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid #E7E7E7",
          background: "#FFF",
          color: "#111",
          fontWeight: 600,
        }}
      >
        <option value="">All</option>
        {categories.map((category) => (
          <option key={category.value} value={category.value}>
            {category.label}
          </option>
        ))}
      </select>
    </div>
  );
}