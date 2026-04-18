"use client";

import * as React from "react";
import { Input } from "./Input";

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export type PasswordInputProps = Omit<React.ComponentProps<typeof Input>, "type">;

function EyeIcon({ passwordRevealed }: { passwordRevealed: boolean }) {
  if (passwordRevealed) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5 shrink-0"
        aria-hidden
      >
        <path d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19 12 19c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 5c4.638 0 8.573 2.511 9.963 6.322a10.436 10.436 0 01-.053.683M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path d="M3 3l18 18" />
      </svg>
    );
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 shrink-0"
      aria-hidden
    >
      <path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 5 12 5c4.638 0 8.573 2.511 9.963 6.322a1.012 1.012 0 010 .639C20.577 16.49 16.64 19 12 19c-4.638 0-8.573-2.511-9.963-6.322z" />
      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

/**
 * Password field with show/hide toggle. Reserves right padding on the input so layout stays stable.
 */
export function PasswordInput({ className, id, ...props }: PasswordInputProps) {
  const autoId = React.useId();
  const inputId = id ?? autoId;
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <Input
        id={inputId}
        {...props}
        type={visible ? "text" : "password"}
        className={cx("pr-11", className)}
      />
      <button
        type="button"
        className="absolute right-1 top-1/2 z-[1] flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
        aria-controls={inputId}
      >
        <EyeIcon passwordRevealed={visible} />
      </button>
    </div>
  );
}
