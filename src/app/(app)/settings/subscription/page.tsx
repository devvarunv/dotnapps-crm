import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { requireOrgContext } from "@/lib/context";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import {
  getSubscription,
  checkLimit,
  formatPrice,
  needsAttention,
  isReadOnly,
  PLAN_METRICS,
  METRIC_LABELS,
} from "@/lib/billing/entitlements";
import { PageHeader } from "@/components/app/page-header";
import { DeniedState } from "@/components/app/denied";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui/primitives";
import { PlanPicker, CancelResume, SandboxBilling } from "./subscription-client";

export const metadata: Metadata = { title: "Subscription" };

const STATUS_TONE = {
  TRIALING: "brand",
  ACTIVE: "success",
  PAST_DUE: "warning",
  GRACE: "warning",
  SUSPENDED: "danger",
  CANCELED: "neutral",
} as const;

export default async function SubscriptionSettingsPage() {
  const ctx = await requireOrgContext();
  if (!can(ctx.role, "billing:manage")) {
    return <DeniedState message="Only owners and admins manage billing." />;
  }

  const sub = await getSubscription(ctx.org.id);
  if (!sub) {
    return (
      <div>
        <PageHeader title="Subscription" />
        <p className="text-sm text-muted-foreground">
          No subscription plans are configured yet.
        </p>
      </div>
    );
  }

  const [plans, usage] = await Promise.all([
    prisma.subscriptionPlan.findMany({
      where: { isPublic: true, active: true },
      orderBy: { sortOrder: "asc" },
    }),
    Promise.all(PLAN_METRICS.map((m) => checkLimit(ctx.org.id, m))),
  ]);

  return (
    <div>
      <Link href="/settings" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Settings
      </Link>
      <PageHeader title="Subscription" description="Plan, usage and billing lifecycle." />

      {isReadOnly(sub) && (
        <p className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          This workspace is suspended for billing. Data is retained; editing is
          disabled until the subscription is reactivated below.
        </p>
      )}
      {!isReadOnly(sub) && needsAttention(sub) && (
        <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {sub.cancelAtPeriodEnd
            ? `Scheduled to cancel on ${formatDate(sub.currentPeriodEnd)}.`
            : sub.status === "TRIALING"
              ? `Trial ends ${sub.trialEndsAt ? formatDate(sub.trialEndsAt) : "soon"}.`
              : `Payment is past due — add a plan before ${sub.graceEndsAt ? formatDate(sub.graceEndsAt) : "the grace period ends"}.`}
        </p>
      )}

      <div className="grid gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Current plan</CardTitle>
            <Badge tone={STATUS_TONE[sub.status]}>{sub.status.replace("_", " ").toLowerCase()}</Badge>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="text-lg font-semibold">{sub.plan.name}</span>
              <span className="text-sm text-muted-foreground">{formatPrice(sub.plan)}</span>
            </div>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">Current period ends</dt>
                <dd>{formatDate(sub.currentPeriodEnd)}</dd>
              </div>
              {sub.trialEndsAt && (
                <div>
                  <dt className="text-xs text-muted-foreground">Trial ends</dt>
                  <dd>{formatDate(sub.trialEndsAt)}</dd>
                </div>
              )}
              {sub.failedPaymentCount > 0 && (
                <div>
                  <dt className="text-xs text-muted-foreground">Failed payments</dt>
                  <dd>{sub.failedPaymentCount}</dd>
                </div>
              )}
            </dl>
            <div className="mt-4">
              <CancelResume cancelAtPeriodEnd={sub.cancelAtPeriodEnd} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Usage this period</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {usage.map((u) => (
                <li key={u.metric} className="text-sm">
                  <div className="flex items-baseline justify-between">
                    <span>{METRIC_LABELS[u.metric]}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {u.used}
                      {u.limit === null ? " · unlimited" : ` / ${u.limit}`}
                    </span>
                  </div>
                  {u.limit !== null && (
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={
                          "h-full rounded-full " +
                          (u.used >= u.limit ? "bg-destructive" : "bg-primary/70")
                        }
                        style={{ width: `${Math.min(100, (u.used / Math.max(1, u.limit)) * 100)}%` }}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Change plan</CardTitle></CardHeader>
          <CardContent>
            <PlanPicker
              plans={plans.map((p) => ({
                key: p.key,
                name: p.name,
                price: formatPrice(p),
                description: p.description,
                features: p.features,
                current: p.id === sub.planId,
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Sandbox billing</CardTitle></CardHeader>
          <CardContent><SandboxBilling /></CardContent>
        </Card>
      </div>
    </div>
  );
}
