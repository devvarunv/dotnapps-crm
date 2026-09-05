import type { Metadata } from "next";

import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/app/page-header";
import { Card, Badge } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Integrations · Super Admin" };

export default async function AdminIntegrationsPage() {
  const since7d = new Date(Date.now() - 7 * 86_400_000);

  const [integrations, eventCounts, recentFailed] = await Promise.all([
    prisma.integration.findMany({
      orderBy: { updatedAt: "desc" },
      include: { org: { select: { id: true, name: true } } },
    }),
    prisma.integrationEvent.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: { receivedAt: { gte: since7d } },
    }),
    prisma.integrationEvent.findMany({
      where: { status: "FAILED" },
      orderBy: { receivedAt: "desc" },
      take: 20,
      include: { org: { select: { name: true } } },
    }),
  ]);

  const counts = { PROCESSED: 0, IGNORED: 0, FAILED: 0 } as Record<string, number>;
  for (const c of eventCounts) counts[c.status] = c._count._all;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        description="Provider connections and webhook processing health across every business."
      />

      <section className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Processed (7d)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{counts.PROCESSED}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Ignored (7d)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{counts.IGNORED}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Failed (7d)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-destructive">{counts.FAILED}</p>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Connections</h2>
        <Card className="divide-y divide-border">
          {integrations.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No business has configured an integration yet.
            </p>
          ) : (
            integrations.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                <span className="font-medium">{i.org.name}</span>
                <span className="text-xs text-muted-foreground">{i.provider}</span>
                <Badge
                  tone={i.status === "CONNECTED" ? "success" : i.status === "ERROR" ? "danger" : "warning"}
                >
                  {i.status.toLowerCase()}
                </Badge>
                <Badge tone="neutral">{i.mode.toLowerCase()}</Badge>
                {i.lastError && <span className="text-xs text-destructive">{i.lastError}</span>}
                <span className="ml-auto text-xs text-muted-foreground">
                  {i.lastCheckedAt ? `checked ${formatDate(i.lastCheckedAt)}` : "not checked"}
                </span>
              </div>
            ))
          )}
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Recent failed webhook events</h2>
        <Card className="divide-y divide-border">
          {recentFailed.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No failed events. That's good.
            </p>
          ) : (
            recentFailed.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                <span className="font-medium">{e.org.name}</span>
                <Badge tone="neutral">{e.eventType}</Badge>
                <span className="text-xs text-destructive">{e.error ?? "Unknown error"}</span>
                <span className="ml-auto text-xs text-muted-foreground">{formatDate(e.receivedAt)}</span>
              </div>
            ))
          )}
        </Card>
      </section>
    </div>
  );
}
