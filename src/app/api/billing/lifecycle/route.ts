import { NextRequest } from "next/server";
import { runBillingLifecycle } from "@/lib/billing/lifecycle";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * Scheduler entrypoint for subscription lifecycle transitions (trial → grace →
 * suspended). Point a daily cron at:
 *   POST /api/billing/lifecycle   Authorization: Bearer $AUTOMATION_SECRET
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(`cron:billing:${ip}`, RATE_LIMITS.cron.limit, RATE_LIMITS.cron.windowMs);
  if (!rl.allowed) return json({ error: "Rate limit exceeded" }, 429);

  const secret = process.env.AUTOMATION_SECRET;
  if (!secret) return json({ error: "AUTOMATION_SECRET is not set" }, 500);

  const provided =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    req.nextUrl.searchParams.get("key") ??
    "";
  if (provided !== secret) return json({ error: "Unauthorized" }, 401);

  const orgId = req.nextUrl.searchParams.get("org") ?? undefined;
  const summary = await runBillingLifecycle(orgId);
  return json(summary, 200);
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
