import type { Metadata } from "next";

import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { monthlyCents } from "@/lib/billing/entitlements";
import { Card } from "@/components/ui/primitives";
import { RunLifecycle, StatusPicker, PlanPicker } from "./subs-client";

export const metadata: Metadata = { title: "Subscriptions · Super Admin" };

const money = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default async function AdminSubscriptionsPage() {
  const [subs, plans, orgCount] = await Promise.all([
    prisma.subscription.findMany({
      include: { plan: true, org: { select: { name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.subscriptionPlan.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.organization.count(),
  ]);

  const mrr = subs
    .filter((s) => ["ACTIVE", "PAST_DUE", "GRACE"].includes(s.status))
    .reduce((a, s) => a + monthlyCents(s.plan), 0);

  const byStatus = subs.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Subscriptions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {subs.length} of {orgCount} orgs · lifecycle transitions run on dates.
          </p>
        </div>
        <RunLifecycle />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">MRR</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums">{money(mrr)}</p>
        </div>
        {["TRIALING", "ACTIVE", "SUSPENDED"].map((s) => (
          <div key={s} className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">{s.toLowerCase()}</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums">{byStatus[s] ?? 0}</p>
          </div>
        ))}
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Business</th>
              <th className="px-4 py-2 font-medium">Plan</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Period ends</th>
              <th className="px-4 py-2 font-medium">MRR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {subs.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2 font-medium">{s.org.name}</td>
                <td className="px-4 py-2">
                  <PlanPicker id={s.id} planId={s.planId} plans={plans.map((p) => ({ id: p.id, name: p.name }))} />
                </td>
                <td className="px-4 py-2">
                  <StatusPicker id={s.id} status={s.status} />
                </td>
                <td className="px-4 py-2 text-muted-foreground">{formatDate(s.currentPeriodEnd)}</td>
                <td className="px-4 py-2 tabular-nums text-muted-foreground">{money(monthlyCents(s.plan))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
