import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hides the floating Next.js dev indicator (bottom-left "N") in `next dev` only.
  // Production builds do not include this UI.
  devIndicators: false,
};

export default nextConfig;
