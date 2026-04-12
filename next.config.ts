import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hides the floating Next.js dev indicator (bottom-left "N") in `next dev` only.
  // Production builds do not include this UI.
  devIndicators: false,

  // Expose signup diagnostic UI only for local dev and Vercel Preview (not Production).
  env: {
    NEXT_PUBLIC_SIGNUP_DEBUG_V2:
      process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "preview"
        ? "1"
        : "",
  },
};

export default nextConfig;
