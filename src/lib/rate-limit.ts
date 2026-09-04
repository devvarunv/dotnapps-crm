/**
 * In-process sliding-window rate limiter for sensitive endpoints (login,
 * signup, password change, webhooks, cron jobs).
 *
 * This is intentionally simple: state lives in a Map in the Node process.
 * That's correct for this app's single-process deployment model, but it does
 * NOT share state across multiple instances — a horizontally-scaled
 * deployment needs a shared store (Redis, etc.) instead. Documented in
 * docs/OPERATIONS.md.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Periodically forget stale buckets so the Map doesn't grow unbounded.
let lastSweep = Date.now();
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, b] of buckets) {
    if (b.resetAt < now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

/**
 * `key` should identify the caller + action, e.g. `login:1.2.3.4` or
 * `webhook:<orgId>`. `limit` requests are allowed per `windowMs`.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;
  const allowed = bucket.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

/** Best-effort client IP from standard proxy headers (or "unknown"). */
export async function clientIp(): Promise<string> {
  const { headers } = await import("next/headers");
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

export const RATE_LIMITS = {
  login: { limit: 10, windowMs: 5 * 60_000 }, // 10 attempts / 5 min / IP+email
  signup: { limit: 5, windowMs: 60 * 60_000 }, // 5 signups / hour / IP
  passwordChange: { limit: 5, windowMs: 15 * 60_000 },
  webhook: { limit: 60, windowMs: 60_000 }, // 60 / min / org
  cron: { limit: 30, windowMs: 60_000 },
} as const;
