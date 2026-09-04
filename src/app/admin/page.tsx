import type { Metadata } from "next";

import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { AUDIT_LABELS } from "@/lib/audit-labels";
import { Card, Badge } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Super Admin" };

export default async function AdminDashboardPage() {
  const [userCount, orgCount, memberCount, pendingInvites, orgs, recentAudit] =
    await Promise.all([
      prisma.user.count(),
      prisma.organization.count(),
      prisma.membership.count({ where: { status: "ACTIVE" } }),
      prisma.invite.count({ where: { status: "PENDING" } }),
      prisma.organization.findMany({
        orderBy: { createdAt: "desc" },
        take: 25,
        include: {
          createdBy: { select: { name: true, email: true } },
          _count: { select: { memberships: true } },
        },
      }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 15,
        include: {
          actor: { select: { name: true } },
          org: { select: { name: true } },
        },
      }),
    ]);

  const integrations = await prisma.integration.findMany({
    orderBy: { updatedAt: "desc" },
    include: { org: { select: { name: true } } },
  });
  const failedEvents = await prisma.integrationEvent.count({ where: { status: "FAILED" } });

  const stats = [
    { label: "Users", value: userCount },
    { label: "Businesses", value: orgCount },
    { label: "Active memberships", value: memberCount },
    { label: "Pending invites", value: pendingInvites },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Platform overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Read-only platform metrics. Subscription, MRR and provider-health
          tooling arrive with the SaaS phase.
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
          </Card>
        ))}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Businesses</h2>
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Slug</th>
                <th className="px-4 py-2 font-medium">Members</th>
                <th className="px-4 py-2 font-medium">Owner</th>
                <th className="px-4 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orgs.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-2 font-medium">{o.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{o.slug}</td>
                  <td className="px-4 py-2 tabular-nums">{o._count.memberships}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {o.createdBy.email}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {formatDate(o.createdAt)}
                  </td>
                </tr>
              ))}
              {orgs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    No businesses yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">
          Integration health
          {failedEvents > 0 && (
            <span className="ml-2 text-xs font-normal text-destructive">
              {failedEvents} failed webhook event{failedEvents === 1 ? "" : "s"}
            </span>
          )}
        </h2>
        <Card className="divide-y divide-border">
          {integrations.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No organisations have configured an integration.
            </p>
          ) : (
            integrations.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                <span className="font-medium">{i.org.name}</span>
                <span className="text-xs text-muted-foreground">{i.provider}</span>
                <Badge
                  tone={
                    i.status === "CONNECTED"
                      ? "success"
                      : i.status === "ERROR"
                        ? "danger"
                        : "warning"
                  }
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
        <h2 className="mb-3 text-sm font-semibold">Recent platform activity</h2>
        <Card className="divide-y divide-border">
          {recentAudit.map((log) => (
            <div key={log.id} className="flex items-baseline gap-2 px-4 py-2 text-sm">
              <span>{AUDIT_LABELS[log.action] ?? log.action}</span>
              <span className="text-xs text-muted-foreground">
                {log.actor?.name ?? "System"}
                {log.org?.name ? ` · ${log.org.name}` : ""} ·{" "}
                {formatDate(log.createdAt)}
              </span>
            </div>
          ))}
          {recentAudit.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No activity recorded yet.
            </p>
          )}
        </Card>
      </section>
    </div>
  );
}
