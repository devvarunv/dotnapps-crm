import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";

import { requireOrgContext } from "@/lib/context";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";
import { OPEN_LEAD_STATUSES } from "@/lib/crm/labels";
import { formatMoney } from "@/lib/crm/sales";
import { getInvoiceIntegration } from "@/lib/integrations/invoice";
import { PageHeader } from "@/components/app/page-header";
import { Card } from "@/components/ui/primitives";
import { buttonClassName } from "@/components/ui/button";
import { AUDIT_LABELS } from "@/lib/audit-labels";

export const metadata: Metadata = { title: "Dashboard" };

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export default async function DashboardPage() {
  const ctx = await requireOrgContext();
  const since = new Date(Date.now() - THIRTY_DAYS_MS);

  const [
    memberCount,
    pendingInvites,
    recentAudit,
    newLeads,
    openLeads,
    wonLeads,
    totalLeads,
    convertedLeads,
    recentLeads,
  ] = await Promise.all([
    prisma.membership.count({ where: { orgId: ctx.org.id, status: "ACTIVE" } }),
    prisma.invite.count({ where: { orgId: ctx.org.id, status: "PENDING" } }),
    prisma.auditLog.findMany({
      where: { orgId: ctx.org.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { actor: { select: { name: true } } },
    }),
    prisma.lead.count({
      where: { orgId: ctx.org.id, archived: false, createdAt: { gte: since } },
    }),
    prisma.lead.count({
      where: { orgId: ctx.org.id, archived: false, status: { in: OPEN_LEAD_STATUSES } },
    }),
    prisma.lead.count({
      where: { orgId: ctx.org.id, archived: false, status: "WON" },
    }),
    prisma.lead.count({ where: { orgId: ctx.org.id, archived: false } }),
    prisma.lead.count({
      where: { orgId: ctx.org.id, archived: false, convertedAt: { not: null } },
    }),
    prisma.lead.findMany({
      where: { orgId: ctx.org.id, archived: false },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, companyName: true, status: true, createdAt: true },
    }),
  ]);

  const [openDealCount, wonDealCount, openDealValue, wonDealValue, closingSoon, myOpenTasks] =
    await Promise.all([
      prisma.deal.count({ where: { orgId: ctx.org.id, archived: false, status: "OPEN" } }),
      prisma.deal.count({ where: { orgId: ctx.org.id, archived: false, status: "WON" } }),
      prisma.deal.aggregate({
        where: { orgId: ctx.org.id, archived: false, status: "OPEN" },
        _sum: { value: true },
      }),
      prisma.deal.aggregate({
        where: { orgId: ctx.org.id, archived: false, status: "WON" },
        _sum: { value: true },
      }),
      prisma.deal.findMany({
        where: {
          orgId: ctx.org.id,
          archived: false,
          status: "OPEN",
          expectedCloseDate: {
            gte: new Date(),
            lte: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { expectedCloseDate: "asc" },
        take: 5,
        select: { id: true, name: true, value: true, currency: true, expectedCloseDate: true },
      }),
      prisma.task.count({
        where: {
          orgId: ctx.org.id,
          assigneeId: ctx.user.id,
          status: { notIn: ["COMPLETED", "CANCELLED"] },
        },
      }),
    ]);

  const integration = await getInvoiceIntegration(ctx.org.id);
  const revenue = integration.enabled
    ? await prisma.paymentEvent.aggregate({
        where: { orgId: ctx.org.id },
        _sum: { amount: true },
      })
    : null;

  const conversion =
    totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : null;

  const kpis = [
    { label: "New leads", value: String(newLeads), hint: "Last 30 days" },
    { label: "Open leads", value: String(openLeads), hint: "Still workable" },
    { label: "Open deals", value: String(openDealCount), hint: "In pipeline" },
    { label: "Open pipeline", value: formatMoney(openDealValue._sum.value), hint: "Sum of open deals" },
    { label: "Won deals", value: String(wonDealCount), hint: formatMoney(wonDealValue._sum.value) },
    revenue
      ? {
          label: "Revenue collected",
          value: formatMoney(revenue._sum.amount),
          hint:
            integration.mode === "MOCK"
              ? "Dotnapps Invoice (sandbox)"
              : "From Dotnapps Invoice",
        }
      : { label: "Conversion rate", value: conversion === null ? "—" : `${conversion}%`, hint: "Leads converted" },
  ];

  const canInvite = can(ctx.role, "members:invite");
  const canCreateLead = can(ctx.role, "leads:create");

  const checklist = [
    { done: true, label: "Create your workspace" },
    {
      done: memberCount > 1 || pendingInvites > 0,
      label: "Invite your team",
      href: canInvite ? "/settings/team" : undefined,
    },
    {
      done: totalLeads > 0,
      label: "Add your first lead",
      href: canCreateLead ? "/leads/new" : undefined,
    },
  ];

  return (
    <div>
      <PageHeader
        title={`Welcome, ${ctx.user.name.split(" ")[0]}`}
        description={`${ctx.org.name} · you're signed in as ${ctx.role.toLowerCase()}`}
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{k.value}</p>
            <p className="text-xs text-muted-foreground">{k.hint}</p>
          </Card>
        ))}
      </section>
      <p className="mt-2 text-xs text-muted-foreground">
        Snapshot for {ctx.org.name}.{" "}
        <Link href="/reports" className="font-medium text-primary hover:underline">
          Open full reports
        </Link>{" "}
        for conversion, pipeline, win rate and salesperson performance.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Deals closing soon</h2>
            <Link href="/pipeline" className="text-xs font-medium text-primary hover:underline">
              Open board
            </Link>
          </div>
          {closingSoon.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Nothing due in the next 14 days.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {closingSoon.map((d) => (
                <li key={d.id} className="flex items-center justify-between text-sm">
                  <Link href={`/deals/${d.id}`} className="font-medium hover:underline">
                    {d.name}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {formatMoney(d.value, d.currency)} ·{" "}
                    {d.expectedCloseDate ? formatDate(d.expectedCloseDate) : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Your open tasks</h2>
            <Link href="/tasks?view=my" className="text-xs font-medium text-primary hover:underline">
              View
            </Link>
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{myOpenTasks}</p>
          <p className="text-xs text-muted-foreground">
            Assigned to you and not yet done
          </p>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Get set up</h2>
          <ul className="mt-3 space-y-2.5">
            {checklist.map((item) => (
              <li key={item.label} className="flex items-center gap-2.5 text-sm">
                {item.done ? (
                  <CheckCircle2 className="size-4 shrink-0 text-primary" />
                ) : (
                  <Circle className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className={item.done ? "text-muted-foreground line-through" : ""}>
                  {item.label}
                </span>
                {item.href && !item.done && (
                  <Link
                    href={item.href}
                    className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    Do it <ArrowRight className="size-3" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent leads</h2>
            <Link href="/leads" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
          {recentLeads.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No leads yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {recentLeads.map((l) => (
                <li key={l.id} className="flex items-center justify-between text-sm">
                  <Link href={`/leads/${l.id}`} className="font-medium hover:underline">
                    {l.name}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {l.companyName ?? "—"} · {formatDate(l.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <h2 className="text-sm font-semibold">Recent activity</h2>
        {recentAudit.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nothing yet. Actions in this workspace are recorded here.
          </p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {recentAudit.map((log) => (
              <li key={log.id} className="flex items-baseline gap-2 text-sm">
                <span className="text-foreground">
                  {AUDIT_LABELS[log.action] ?? log.action}
                </span>
                <span className="text-xs text-muted-foreground">
                  {log.actor?.name ?? "System"} · {formatDate(log.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
