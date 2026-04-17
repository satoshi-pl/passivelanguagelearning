"use client";

import type { ComponentProps } from "react";
import ResponsiveNavLink from "@/app/components/ResponsiveNavLink";
import { trackGaEvent } from "@/lib/analytics/ga";

type Props = ComponentProps<typeof ResponsiveNavLink> & {
  eventName: string;
  eventParams?: Record<string, string | number | boolean | null | undefined>;
};

export default function TrackedResponsiveNavLink({
  eventName,
  eventParams,
  onClick,
  ...props
}: Props) {
  return (
    <ResponsiveNavLink
      {...props}
      onClick={(event) => {
        trackGaEvent(eventName, eventParams);
        onClick?.(event);
      }}
    />
  );
}
