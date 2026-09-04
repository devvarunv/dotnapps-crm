import type { Subscription, SubscriptionPlan } from "@prisma/client";
import { prisma } from "@/lib/db";

export const PLAN_METRICS = [
  "users",
  "leads",
  "contacts",
  "companies",
  "deals",
  "automationRules",
  "integrations",
  "exportsPerMonth",
] as const;
export type PlanMetric = (typeof PLAN_METRICS)[number];

export const METRIC_LABELS: Record<PlanMetric, string> = {
  users: "Team members",
  leads: "Leads",
  contacts: "Contacts",
  companies: "Companies",
  deals: "Deals",
  automationRules: "Automation rules",
  integrations: "Integrations",
  exportsPerMonth: "CSV exports / month",
};

export class LimitError extends Error {
  constructor(
    public metric: PlanMetric,
    public limit: number,
  ) {
    super(
      `Your plan allows ${limit} ${METRIC_LABELS[metric].toLowerCase()}. Upgrade in Settings → Subscription to add more.`,
    );
    this.name = "LimitError";
  }
}

export class SuspendedError extends Error {
  constructor() {
    super(
      "This workspace is suspended for billing. Your data is retained — reactivate the subscription to make changes again.",
    );
    this.name = "SuspendedError";
  }
}

export type SubWithPlan = Subscription & { plan: SubscriptionPlan };

/** Every org has exactly one Subscription; create a trialing one lazily. */
export async function getSubscription(orgId: string): Promise<SubWithPlan | null> {
  const existing = await prisma.subscription.findUnique({
    where: { orgId },
    include: { plan: true },
  });
  if (existing) return existing;

  const plan =
    (await prisma.subscriptionPlan.findFirst({ where: { isDefault: true, active: true } })) ??
    (await prisma.subscriptionPlan.findFirst({ where: { active: true }, orderBy: { sortOrder: "asc" } }));
  if (!plan) return null;

  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + plan.trialDays * 86_400_000);
  return prisma.subscription.create({
    data: {
      orgId,
      planId: plan.id,
      status: plan.trialDays > 0 ? "TRIALING" : "ACTIVE",
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 30 * 86_400_000),
      trialEndsAt: plan.trialDays > 0 ? trialEndsAt : null,
    },
    include: { plan: true },
  });
}

export function planLimits(plan: SubscriptionPlan): Partial<Record<PlanMetric, number>> {
  return (plan.limits as Partial<Record<PlanMetric, number>>) ?? {};
}

export function limitFor(plan: SubscriptionPlan, metric: PlanMetric): number | null {
  const v = planLimits(plan)[metric];
  return typeof v === "number" ? v : null; // null = unlimited
}

export function periodStart(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export async function usageFor(orgId: string, metric: PlanMetric): Promise<number> {
  switch (metric) {
    case "users": {
      const [members, invites] = await Promise.all([
        prisma.membership.count({ where: { orgId, status: "ACTIVE" } }),
        prisma.invite.count({ where: { orgId, status: "PENDING" } }),
      ]);
      return members + invites;
    }
    case "leads":
      return prisma.lead.count({ where: { orgId, archived: false } });
    case "contacts":
      return prisma.contact.count({ where: { orgId, archived: false } });
    case "companies":
      return prisma.company.count({ where: { orgId, archived: false } });
    case "deals":
      return prisma.deal.count({ where: { orgId, archived: false } });
    case "automationRules":
      return prisma.reminderRule.count({ where: { orgId } });
    case "integrations":
      return prisma.integration.count({
        where: { orgId, status: { not: "NOT_CONFIGURED" } },
      });
    case "exportsPerMonth": {
      const agg = await prisma.usageRecord.aggregate({
        where: { orgId, metric: "export", periodStart: periodStart() },
        _sum: { quantity: true },
      });
      return agg._sum.quantity ?? 0;
    }
  }
}

export type LimitCheck = {
  metric: PlanMetric;
  used: number;
  limit: number | null;
  allowed: boolean;
  remaining: number | null;
};

export async function checkLimit(orgId: string, metric: PlanMetric): Promise<LimitCheck> {
  const sub = await getSubscription(orgId);
  const limit = sub ? limitFor(sub.plan, metric) : null;
  const used = await usageFor(orgId, metric);
  return {
    metric,
    used,
    limit,
    allowed: limit === null || used < limit,
    remaining: limit === null ? null : Math.max(0, limit - used),
  };
}

/** Throw if adding one more of `metric` would exceed the plan limit. */
export async function assertWithinLimit(orgId: string, metric: PlanMetric): Promise<void> {
  const c = await checkLimit(orgId, metric);
  if (!c.allowed && c.limit !== null) throw new LimitError(metric, c.limit);
}

export async function recordUsage(orgId: string, metric: string, quantity = 1): Promise<void> {
  await prisma.usageRecord.create({
    data: { orgId, metric, quantity, periodStart: periodStart() },
  });
}

/**
 * Route-handler gate for CSV exports: returns a 429 Response when the monthly
 * export allowance is spent, and a `commit()` to call after a successful export
 * to record one use.
 */
export async function exportGate(orgId: string): Promise<
  | { blocked: Response }
  | { blocked: null; commit: () => Promise<void> }
> {
  const c = await checkLimit(orgId, "exportsPerMonth");
  if (!c.allowed && c.limit !== null) {
    return {
      blocked: new Response(
        JSON.stringify({
          error: `Monthly export limit reached (${c.limit}). Upgrade your plan for more.`,
        }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      ),
    };
  }
  return { blocked: null, commit: () => recordUsage(orgId, "export") };
}

/* --------------------------------------------------------- status ------- */

export function isReadOnly(sub: Subscription): boolean {
  if (sub.status === "SUSPENDED") return true;
  if (sub.status === "CANCELED" && sub.currentPeriodEnd < new Date()) return true;
  return false;
}

export function needsAttention(sub: Subscription): boolean {
  return (
    sub.status === "GRACE" ||
    sub.status === "PAST_DUE" ||
    (sub.status === "TRIALING" &&
      !!sub.trialEndsAt &&
      sub.trialEndsAt.getTime() - Date.now() < 5 * 86_400_000) ||
    sub.cancelAtPeriodEnd
  );
}

export async function assertWritable(orgId: string): Promise<void> {
  const sub = await getSubscription(orgId);
  if (sub && isReadOnly(sub)) throw new SuspendedError();
}

export function monthlyCents(plan: SubscriptionPlan): number {
  return plan.interval === "YEARLY" ? Math.round(plan.priceCents / 12) : plan.priceCents;
}

export function formatPrice(plan: SubscriptionPlan): string {
  if (plan.priceCents === 0) return "Free";
  const dollars = (plan.priceCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: plan.currency,
    maximumFractionDigits: 0,
  });
  return `${dollars}/${plan.interval === "YEARLY" ? "yr" : "mo"}`;
}
