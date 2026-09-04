import type { NextConfig } from "next";

// Baseline security headers (spec §27). CSP is intentionally permissive on
// 'unsafe-inline' for script/style: Next.js App Router ships an inline RSC
// hydration bootstrap and we have no nonce plumbing yet — tightening this to
// a nonce-based policy is tracked in docs/OPERATIONS.md.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  // Browsers only honour this over HTTPS, so it's a no-op in local dev.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

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
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
