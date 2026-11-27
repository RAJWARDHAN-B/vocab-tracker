import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Never proxy external image URLs through the Next.js server.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
