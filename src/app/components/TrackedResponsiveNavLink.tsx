"use client";

import type { ComponentProps } from "react";
import ResponsiveNavLink from "@/app/components/ResponsiveNavLink";
import { trackGaEvent } from "@/lib/analytics/ga";
import { startRouteInteractionTiming } from "@/lib/analytics/interactionTiming";

type Props = ComponentProps<typeof ResponsiveNavLink> & {
  eventName: string;
  eventParams?: Record<string, string | number | boolean | null | undefined>;
  interactionTiming?: string;
};

export default function TrackedResponsiveNavLink({
  eventName,
  eventParams,
  interactionTiming,
  onClick,
  ...props
}: Props) {
  return (
    <ResponsiveNavLink
      {...props}
      preferHistoryBack={props.preferHistoryBack ?? interactionTiming === "back_navigation"}
      onClick={(event) => {
        trackGaEvent(eventName, eventParams);
        if (interactionTiming && typeof props.href === "string") {
          startRouteInteractionTiming(interactionTiming, props.href, eventParams);
        }
        onClick?.(event);
      }}
    />
  );
}
