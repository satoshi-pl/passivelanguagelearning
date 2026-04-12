"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Option = {
  value: string;
  label: string;
};

export default function AutoSubmitSupportSelect({
  target,
  value,
  options,
}: {
  target: string;
  value: string;
  options: Option[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(nextValue: string) {
    const qs = new URLSearchParams(searchParams.toString());

    if (target) qs.set("target", target);
    else qs.delete("target");

    if (nextValue) qs.set("support", nextValue);
    else qs.delete("support");

    // Level is pair-specific; let /decks default to the first level for the new pair.
    qs.delete("level");

    const next = qs.toString() ? `${pathname}?${qs.toString()}` : pathname;
    router.replace(next);
  }

  return (
    <div
      style={{
        position: "relative",
        minWidth: 170,
      }}
    >
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        style={{
          width: "100%",
          height: 46,
          borderRadius: 14,
          border: "1px solid var(--border)",
          background: "var(--surface-solid)",
          padding: "0 42px 0 14px",
          fontSize: 15,
          fontWeight: 700,
          color: "var(--foreground)",
          outline: "none",
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
          boxShadow: "0 1px 0 rgba(0,0,0,0.02)",
          cursor: "pointer",
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <div
        style={{
          position: "absolute",
          right: 14,
          top: "50%",
          transform: "translateY(-50%)",
          pointerEvents: "none",
          fontSize: 12,
          color: "var(--foreground-muted)",
        }}
      >
        ▼
      </div>
    </div>
  );
}
