"use client";

import { useEffect, useRef, useState } from "react";
import { trackGaEvent } from "@/lib/analytics/ga";

type Props = {
  accountLabel: string;
  email: string;
};

export default function MobileAccountMenu({ accountLabel, email }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      const target = event.target as Node | null;
      if (target && !root.contains(target)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          trackGaEvent("account_click", { location: "top_nav" });
          setOpen((v) => !v);
        }}
        className="
          flex h-10 w-10 items-center justify-center
          rounded-full border border-neutral-200 bg-white text-neutral-700
          hover:bg-neutral-100
        "
        aria-label="Account menu"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold leading-none">
          {(accountLabel?.trim().charAt(0) || email?.trim().charAt(0) || "U").toUpperCase()}
        </span>
      </button>

      {open && (
        <div
          className="
            absolute right-0 top-[calc(100%+8px)] z-50 w-[min(18rem,80vw)]
            rounded-2xl border border-neutral-200 bg-white p-3 shadow-lg
          "
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--foreground-muted)]">
            Signed in as
          </div>
          <div
            className="mt-1 break-words text-sm font-semibold text-[var(--foreground)]"
            title={accountLabel}
          >
            {accountLabel}
          </div>
          {accountLabel !== email ? (
            <div className="mt-0.5 break-words text-xs text-[var(--foreground-muted)]" title={email}>
              {email}
            </div>
          ) : null}

          <a
            href="/faq"
            onClick={() => setOpen(false)}
            className="mt-3 block rounded-xl px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
          >
            Q&amp;A
          </a>

          <a
            href="/account"
            onClick={() => setOpen(false)}
            className="mt-1 block rounded-xl px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
          >
            Account
          </a>

          <a
            href="/api/logout"
            onClick={() => {
              setOpen(false);
            }}
            className="mt-1 block rounded-xl px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
          >
            Logout
          </a>
        </div>
      )}
    </div>
  );
}
