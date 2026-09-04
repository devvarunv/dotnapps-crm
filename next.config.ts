import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pin the workspace root so an unrelated lockfile in a parent directory
  // doesn't get picked up for build tracing.
  outputFileTracingRoot: process.cwd(),
  experimental: {
    // Server Actions are used for all mutations in the app.
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
