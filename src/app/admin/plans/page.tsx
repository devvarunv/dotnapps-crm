import type { Metadata } from "next";

import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { CreatePlan, PlanRowItem, type PlanRow } from "./plan-form";

export const metadata: Metadata = { title: "Plans · Super Admin" };

export default async function AdminPlansPage() {
  const plans = await prisma.subscriptionPlan.findMany({
    orderBy: { sortOrder: "asc" },
  });

  const rows: PlanRow[] = plans.map((p) => ({
    id: p.id,
    key: p.key,
    name: p.name,
    description: p.description,
    priceCents: p.priceCents,
    interval: p.interval,
    trialDays: p.trialDays,
    isPublic: p.isPublic,
    isDefault: p.isDefault,
    active: p.active,
    sortOrder: p.sortOrder,
    features: p.features,
    limits: (p.limits ?? {}) as Record<string, number>,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Subscription plans</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Limits drive server-side entitlement checks. Absent metric = unlimited.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>New plan</CardTitle></CardHeader>
        <CardContent><CreatePlan /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Plans ({rows.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {rows.map((p) => (
              <PlanRowItem key={p.id} plan={p} />
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
