import { NextRequest } from "next/server";
import { runAutomation } from "@/lib/automation/engine";

/**
 * Scheduler entrypoint. Point a cron job at:
 *   POST /api/automation/run   Authorization: Bearer $AUTOMATION_SECRET
 * Optionally scope to one org with ?org=<id>.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.AUTOMATION_SECRET;
  if (!secret) {
    return json({ error: "AUTOMATION_SECRET is not set" }, 500);
  }

  const auth = req.headers.get("authorization");
  const provided =
    auth?.replace(/^Bearer\s+/i, "") ?? req.nextUrl.searchParams.get("key") ?? "";
  if (provided !== secret) {
    return json({ error: "Unauthorized" }, 401);
  }

  const orgId = req.nextUrl.searchParams.get("org") ?? undefined;
  const summary = await runAutomation(orgId);
  return json(summary, 200);
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
