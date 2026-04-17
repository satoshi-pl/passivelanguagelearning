"use client";

import { useEffect } from "react";
import { trackGaEvent } from "@/lib/analytics/ga";

function readCookie(name: string) {
  if (typeof document === "undefined") return "";
  const parts = document.cookie.split(";").map((part) => part.trim());
  const match = parts.find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

function clearCookie(name: string) {
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
}

export default function GaAuthEventBridge() {
  useEffect(() => {
    const authEvent = readCookie("pll_ga_auth");
    if (authEvent !== "login" && authEvent !== "sign_up") return;

    trackGaEvent(authEvent, { method: "google" });
    clearCookie("pll_ga_auth");
  }, []);

  return null;
}
