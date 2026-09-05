import Link from "next/link";
import type { Metadata } from "next";

import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { monthlyCents } from "@/lib/billing/entitlements";
import { AUDIT_LABELS } from "@/lib/audit-labels";
import { Card, Badge } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Super Admin" };

export default async function AdminDashboardPage() {
  const [userCount, orgCount, memberCount, pendingInvites, recentOrgs, recentAudit] =
    await Promise.all([
      prisma.user.count(),
      prisma.organization.count(),
      prisma.membership.count({ where: { status: "ACTIVE" } }),
      prisma.invite.count({ where: { status: "PENDING" } }),
      prisma.organization.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          createdBy: { select: { email: true } },
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

  const failedEvents7d = await prisma.integrationEvent.count({
    where: { status: "FAILED", receivedAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
  });

  const subscriptions = await prisma.subscription.findMany({ include: { plan: true } });
  const mrr = subscriptions
    .filter((s) => ["ACTIVE", "PAST_DUE", "GRACE"].includes(s.status))
    .reduce((a, s) => a + monthlyCents(s.plan), 0);
  const suspended = subscriptions.filter((s) => s.status === "SUSPENDED").length;
  const needsAttention = subscriptions.filter((s) =>
    ["PAST_DUE", "GRACE", "SUSPENDED"].includes(s.status),
  ).length;

  const stats = [
    { label: "Users", value: userCount, href: "/admin/users" },
    { label: "Businesses", value: orgCount, href: "/admin/businesses" },
    { label: "MRR", value: `$${Math.round(mrr / 100)}`, href: "/admin/subscriptions" },
    { label: "Needs attention", value: needsAttention, href: "/admin/support" },
    { label: "Active memberships", value: memberCount, href: "/admin/users" },
    { label: "Pending invites", value: pendingInvites, href: "/admin/support" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Platform overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Snapshot of the whole platform. Use the tabs above to manage businesses, users, plans,
          usage, integrations, support cases, security, and system health.
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="p-4 transition-colors hover:border-foreground/20">
              <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
            </Card>
          </Link>
        ))}
      </section>

      {(suspended > 0 || failedEvents7d > 0) && (
        <section className="flex flex-wrap gap-3">
          {suspended > 0 && (
            <Link href="/admin/subscriptions">
              <Badge tone="danger">{suspended} business{suspended === 1 ? "" : "es"} suspended</Badge>
            </Link>
          )}
          {failedEvents7d > 0 && (
            <Link href="/admin/integrations">
              <Badge tone="danger">
                {failedEvents7d} failed webhook event{failedEvents7d === 1 ? "" : "s"} (7d)
              </Badge>
            </Link>
          )}
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recently created businesses</h2>
          <Link href="/admin/businesses" className="text-xs text-muted-foreground hover:underline">
            View all
          </Link>
        </div>
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
              {recentOrgs.map((o) => (
                <tr key={o.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2 font-medium">
                    <Link href={`/admin/businesses/${o.id}`} className="hover:underline">
                      {o.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{o.slug}</td>
                  <td className="px-4 py-2 tabular-nums">{o._count.memberships}</td>
                  <td className="px-4 py-2 text-muted-foreground">{o.createdBy.email}</td>
                  <td className="px-4 py-2 text-muted-foreground">{formatDate(o.createdAt)}</td>
                </tr>
              ))}
              {recentOrgs.length === 0 && (
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
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent platform activity</h2>
          <Link href="/admin/security" className="text-xs text-muted-foreground hover:underline">
            Full audit log
          </Link>
        </div>
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
