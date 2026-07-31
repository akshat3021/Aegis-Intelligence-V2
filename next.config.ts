import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // !! IMPORTANT !!
  // Do NOT add output: 'export' here - that breaks all /api routes on Vercel.
  // Only add output: 'export' temporarily when building the Android APK.

  images: {
    unoptimized: true,
  },
};

export default nextConfig;