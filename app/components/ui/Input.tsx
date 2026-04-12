import * as React from "react";

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        "h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm",
        "placeholder:text-neutral-400",
        "focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2",
        className
      )}
      {...props}
    />
  );
}
