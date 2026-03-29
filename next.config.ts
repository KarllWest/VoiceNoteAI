import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Stripe SDK must run outside Next.js module bundler to avoid fetch
  // instrumentation breaking its HTTP client (StripeConnectionError in dev)
  serverExternalPackages: ["stripe", "@prisma/client", "@prisma/adapter-pg", "pg"],
  turbopack: {
    root: __dirname,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "images.clerk.dev" },
    ],
  },
};

export default nextConfig;
