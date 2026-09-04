import { NextRequest } from "next/server";
import { runBillingLifecycle } from "@/lib/billing/lifecycle";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * Scheduler entrypoint for subscription lifecycle transitions (trial → grace →
 * suspended). Two ways to trigger it:
 *   - POST /api/billing/lifecycle   Authorization: Bearer $AUTOMATION_SECRET
 *     (any external cron/scheduler)
 *   - GET  /api/billing/lifecycle   (Vercel Cron — see vercel.json). Vercel
 *     automatically sends `Authorization: Bearer $CRON_SECRET` on requests it
 *     triggers, so this only fires for genuine Vercel Cron invocations.
 */
export async function POST(req: NextRequest) {
  return handle(req, process.env.AUTOMATION_SECRET, "AUTOMATION_SECRET");
}

export async function GET(req: NextRequest) {
  return handle(req, process.env.CRON_SECRET, "CRON_SECRET");
}

async function handle(req: NextRequest, secret: string | undefined, secretName: string) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(`cron:billing:${ip}`, RATE_LIMITS.cron.limit, RATE_LIMITS.cron.windowMs);
  if (!rl.allowed) return json({ error: "Rate limit exceeded" }, 429);

  if (!secret) return json({ error: `${secretName} is not set` }, 500);

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
