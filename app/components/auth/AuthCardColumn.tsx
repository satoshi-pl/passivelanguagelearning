import type { ReactNode } from "react";

/** Desktop-only card surface depth (auth flows). */
export const authCardSurfaceClassName = "md:shadow-[0_2px_28px_rgba(0,0,0,0.07)]";

/** Extra padding on md+ (merged with `CardHeader` / `CardContent` defaults). */
export const authCardHeaderClassName = "md:p-7 lg:p-8";
export const authCardContentClassName = "md:px-7 md:pb-7 lg:px-8 lg:pb-8";

export const authCardTitleClassName = "md:text-xl";
export const authCardDescriptionClassName = "md:text-[0.9375rem]";
export const authFormGapClassName = "grid gap-3 md:gap-4";
export const authPrimaryButtonClassName = "md:h-11 md:px-5 md:text-[0.9375rem]";
export const authFieldLabelClassName = "md:text-[0.9375rem]";
/** Slightly larger fields on md+ (merged with `Input` / `PasswordInput` defaults). */
export const authInputClassName = "md:h-11 md:text-[0.9375rem]";

/**
 * Centered column for sign-in, sign-up, password reset, and email interstitial flows.
 * Slightly wider and roomier on md+; mobile widths stay close to the previous `max-w-md` feel.
 */
export function AuthCardColumn({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto mt-10 w-full max-w-md md:mt-12 md:max-w-lg lg:mt-14 lg:max-w-xl">
      {children}
    </div>
  );
}
