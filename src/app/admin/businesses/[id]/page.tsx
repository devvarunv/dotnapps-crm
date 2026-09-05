import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { AUDIT_LABELS } from "@/lib/audit-labels";
import {
  PLAN_METRICS,
  METRIC_LABELS,
  checkLimit,
  getSubscription,
  monthlyCents,
  formatPrice,
} from "@/lib/billing/entitlements";
import { Card, Badge } from "@/components/ui/primitives";
import { StatusPicker, PlanPicker } from "../../subscriptions/subs-client";
import { ExtendTrialForm, RevokeInviteButton } from "../business-client";

export const metadata: Metadata = { title: "Business · Super Admin" };

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  TRIALING: "neutral",
  ACTIVE: "success",
  PAST_DUE: "warning",
  GRACE: "warning",
  SUSPENDED: "danger",
  CANCELED: "neutral",
};

export default async function AdminBusinessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true, email: true } },
      subscription: { include: { plan: true } },
      memberships: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
      invites: { where: { status: "PENDING" }, orderBy: { createdAt: "desc" } },
      integrations: true,
    },
  });
  if (!org) notFound();

  // Ensure the subscription row exists before checking metrics in parallel
  // below — otherwise every metric races to lazily create one.
  await getSubscription(org.id);

  const [plans, recentAudit, usage] = await Promise.all([
    prisma.subscriptionPlan.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.auditLog.findMany({
      where: { orgId: org.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { actor: { select: { name: true } } },
    }),
    Promise.all(PLAN_METRICS.map((m) => checkLimit(org.id, m))),
  ]);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/businesses"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Businesses
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{org.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {org.slug} · created {formatDate(org.createdAt)} by {org.createdBy.email}
          </p>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Subscription</h2>
        <Card className="space-y-4 p-4">
          {org.subscription ? (
            <>
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Plan</p>
                  <PlanPicker
                    id={org.subscription.id}
                    planId={org.subscription.planId}
                    plans={plans.map((p) => ({ id: p.id, name: p.name }))}
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <StatusPicker id={org.subscription.id} status={org.subscription.status} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">MRR</p>
                  <p className="mt-1 text-sm font-medium tabular-nums">
                    {formatPrice({
                      ...org.subscription.plan,
                      priceCents: monthlyCents(org.subscription.plan),
                      interval: "MONTHLY",
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Period ends</p>
                  <p className="mt-1 text-sm">{formatDate(org.subscription.currentPeriodEnd)}</p>
                </div>
                {org.subscription.trialEndsAt && (
                  <div>
                    <p className="text-xs text-muted-foreground">Trial ends</p>
                    <p className="mt-1 text-sm">{formatDate(org.subscription.trialEndsAt)}</p>
                  </div>
                )}
                {org.subscription.graceEndsAt && (
                  <div>
                    <p className="text-xs text-muted-foreground">Grace ends</p>
                    <p className="mt-1 text-sm">{formatDate(org.subscription.graceEndsAt)}</p>
                  </div>
                )}
              </div>
              <div className="border-t border-border pt-3">
                <p className="mb-2 text-xs text-muted-foreground">
                  Support action — extend the trial/grace/current period (e.g. while a payment issue is
                  resolved):
                </p>
                <ExtendTrialForm subscriptionId={org.subscription.id} />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No subscription record yet.</p>
          )}
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">Usage vs. plan limits</h2>
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Metric</th>
                <th className="px-4 py-2 font-medium">Used</th>
                <th className="px-4 py-2 font-medium">Limit</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {usage.map((u) => (
                <tr key={u.metric}>
                  <td className="px-4 py-2">{METRIC_LABELS[u.metric]}</td>
                  <td className="px-4 py-2 tabular-nums">{u.used}</td>
                  <td className="px-4 py-2 tabular-nums text-muted-foreground">
                    {u.limit === null ? "Unlimited" : u.limit}
                  </td>
                  <td className="px-4 py-2">
                    {u.limit !== null && u.used >= u.limit ? (
                      <Badge tone="danger">at limit</Badge>
                    ) : u.limit !== null && u.used >= u.limit * 0.8 ? (
                      <Badge tone="warning">near limit</Badge>
                    ) : (
                      <Badge tone="neutral">ok</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold">
          Members <span className="font-normal text-muted-foreground">({org.memberships.length})</span>
        </h2>
        <Card className="divide-y divide-border">
          {org.memberships.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
              <span className="font-medium">{m.user.name}</span>
              <span className="text-xs text-muted-foreground">{m.user.email}</span>
              <Badge tone="neutral">{m.role.toLowerCase()}</Badge>
              {m.status === "SUSPENDED" && <Badge tone="danger">suspended</Badge>}
              <span className="ml-auto text-xs text-muted-foreground">
                joined {formatDate(m.createdAt)}
              </span>
            </div>
          ))}
          {org.memberships.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No members.</p>
          )}
        </Card>
      </section>

      {org.invites.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold">Pending invites</h2>
          <Card className="divide-y divide-border">
            {org.invites.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                <span className="font-medium">{i.email}</span>
                <Badge tone="neutral">{i.role.toLowerCase()}</Badge>
                <span className="text-xs text-muted-foreground">expires {formatDate(i.expiresAt)}</span>
                <div className="ml-auto">
                  <RevokeInviteButton id={i.id} />
                </div>
              </div>
            ))}
          </Card>
        </section>
      )}

      {org.integrations.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold">Integrations</h2>
          <Card className="divide-y divide-border">
            {org.integrations.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                <span className="font-medium">{i.provider}</span>
                <Badge
                  tone={i.status === "CONNECTED" ? "success" : i.status === "ERROR" ? "danger" : "warning"}
                >
                  {i.status.toLowerCase()}
                </Badge>
                <Badge tone="neutral">{i.mode.toLowerCase()}</Badge>
                {i.lastError && <span className="text-xs text-destructive">{i.lastError}</span>}
              </div>
            ))}
          </Card>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold">Recent activity</h2>
        <Card className="divide-y divide-border">
          {recentAudit.map((log) => (
            <div key={log.id} className="flex items-baseline gap-2 px-4 py-2 text-sm">
              <span>{AUDIT_LABELS[log.action] ?? log.action}</span>
              <span className="text-xs text-muted-foreground">
                {log.actor?.name ?? "System"} · {formatDate(log.createdAt)}
              </span>
            </div>
          ))}
          {recentAudit.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No activity recorded yet.</p>
          )}
        </Card>
      </section>
    </div>
  );
}
