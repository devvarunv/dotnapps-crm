import type { Metadata } from "next";
import { Activity } from "lucide-react";

import { prisma } from "@/lib/db";
import { Card, Badge } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "System health · Super Admin" };

async function checkDb(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, error: (err as Error).message };
  }
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export default async function AdminHealthPage() {
  const since24h = new Date(Date.now() - 24 * 3600_000);
  const since7d = new Date(Date.now() - 7 * 86_400_000);

  const [db, lastReminderExec, failedReminders24h, lastLifecycleRun, integrationEventStats24h] =
    await Promise.all([
      checkDb(),
      prisma.reminderExecution.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      prisma.reminderExecution.count({ where: { status: "FAILED", createdAt: { gte: since7d } } }),
      prisma.auditLog.findFirst({
        where: { action: { in: ["billing.admin.run_lifecycle", "billing.lifecycle_run"] } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.integrationEvent.groupBy({
        by: ["status"],
        _count: { _all: true },
        where: { receivedAt: { gte: since24h } },
      }),
    ]);

  const events24h = { PROCESSED: 0, IGNORED: 0, FAILED: 0 } as Record<string, number>;
  for (const c of integrationEventStats24h) events24h[c.status] = c._count._all;
  const totalEvents24h = events24h.PROCESSED + events24h.IGNORED + events24h.FAILED;
  const failRate = totalEvents24h > 0 ? Math.round((events24h.FAILED / totalEvents24h) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Activity className="size-5 text-primary" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">System health</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live checks against this process and the database — not a substitute for real uptime
            monitoring (see docs/OPERATIONS.md).
          </p>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Database</p>
          <p className="mt-1 flex items-center gap-2 text-lg font-semibold">
            {db.ok ? <Badge tone="success">connected</Badge> : <Badge tone="danger">error</Badge>}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {db.ok ? `${db.latencyMs}ms round-trip` : db.error}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Process uptime</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {formatDuration(process.uptime() * 1000)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Since this server process started (resets on redeploy).
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Webhook failure rate (24h)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{failRate}%</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {events24h.FAILED} failed of {totalEvents24h} events
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Automation failures (7d)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{failedReminders24h}</p>
          <p className="mt-1 text-xs text-muted-foreground">Failed rule executions</p>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Scheduled jobs</h2>
        <Card className="divide-y divide-border">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
            <div>
              <p className="font-medium">Automation run</p>
              <p className="text-xs text-muted-foreground">POST /api/automation/run — every 5–15 min</p>
            </div>
            <span className="text-xs text-muted-foreground">
              Last execution seen:{" "}
              {lastReminderExec ? lastReminderExec.createdAt.toLocaleString() : "never"}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
            <div>
              <p className="font-medium">Billing lifecycle</p>
              <p className="text-xs text-muted-foreground">
                POST /api/billing/lifecycle · GET (Vercel Cron) — daily
              </p>
            </div>
            <span className="text-xs text-muted-foreground">
              Last run: {lastLifecycleRun ? lastLifecycleRun.createdAt.toLocaleString() : "never"}
            </span>
          </div>
        </Card>
        <p className="mt-2 text-xs text-muted-foreground">
          These read real activity, not a scheduler status API — a scheduled job that hasn't fired in
          a while (nothing due, or the scheduler is broken) looks identical here. Cross-check your
          hosting platform's cron dashboard if a run looks overdue.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Runtime</h2>
        <Card className="divide-y divide-border">
          <div className="flex items-center justify-between px-4 py-2 text-sm">
            <span>Node.js</span>
            <span className="text-muted-foreground">{process.version}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-2 text-sm">
            <span>Environment</span>
            <span className="text-muted-foreground">{process.env.NODE_ENV}</span>
          </div>
        </Card>
      </section>
    </div>
  );
}
