import { describe, it, expect } from "vitest";
import {
  formatPrice,
  monthlyCents,
  isReadOnly,
  needsAttention,
  limitFor,
  planLimits,
} from "@/lib/billing/entitlements";
import type { Subscription, SubscriptionPlan } from "@prisma/client";

function plan(overrides: Partial<SubscriptionPlan> = {}): SubscriptionPlan {
  return {
    id: "plan_1",
    key: "growth",
    name: "Growth",
    description: null,
    priceCents: 2900,
    currency: "USD",
    interval: "MONTHLY",
    trialDays: 14,
    isPublic: true,
    isDefault: false,
    active: true,
    sortOrder: 1,
    limits: { leads: 5000, integrations: 1 },
    features: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function sub(overrides: Partial<Subscription> = {}): Subscription {
  const now = new Date();
  return {
    id: "sub_1",
    orgId: "org_1",
    planId: "plan_1",
    status: "ACTIVE",
    currentPeriodStart: now,
    currentPeriodEnd: new Date(now.getTime() + 30 * 86_400_000),
    trialEndsAt: null,
    graceEndsAt: null,
    canceledAt: null,
    cancelAtPeriodEnd: false,
    failedPaymentCount: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("billing entitlements — pure helpers", () => {
  it("formatPrice shows Free for a zero-price plan", () => {
    expect(formatPrice(plan({ priceCents: 0 }))).toBe("Free");
  });

  it("formatPrice renders monthly and yearly cadence", () => {
    expect(formatPrice(plan({ priceCents: 2900, interval: "MONTHLY" }))).toMatch(/\/mo$/);
    expect(formatPrice(plan({ priceCents: 99900, interval: "YEARLY" }))).toMatch(/\/yr$/);
  });

  it("monthlyCents divides a yearly price by 12", () => {
    expect(monthlyCents(plan({ priceCents: 12000, interval: "YEARLY" }))).toBe(1000);
    expect(monthlyCents(plan({ priceCents: 2900, interval: "MONTHLY" }))).toBe(2900);
  });

  it("limitFor reads a metric from the plan's limits JSON, else unlimited", () => {
    const p = plan({ limits: { leads: 200, integrations: 0 } });
    expect(limitFor(p, "leads")).toBe(200);
    expect(limitFor(p, "integrations")).toBe(0);
    expect(limitFor(p, "deals")).toBeNull(); // absent metric = unlimited
  });

  it("planLimits tolerates a missing/malformed limits value", () => {
    expect(planLimits(plan({ limits: null as never }))).toEqual({});
  });

  it("isReadOnly is true only when SUSPENDED, or CANCELED past the period", () => {
    expect(isReadOnly(sub({ status: "ACTIVE" }))).toBe(false);
    expect(isReadOnly(sub({ status: "SUSPENDED" }))).toBe(true);
    expect(
      isReadOnly(
        sub({ status: "CANCELED", currentPeriodEnd: new Date(Date.now() - 1000) }),
      ),
    ).toBe(true);
    expect(
      isReadOnly(
        sub({ status: "CANCELED", currentPeriodEnd: new Date(Date.now() + 86_400_000) }),
      ),
    ).toBe(false);
  });

  it("needsAttention flags grace, past-due, near-end trial, and pending cancellation", () => {
    expect(needsAttention(sub({ status: "GRACE" }))).toBe(true);
    expect(needsAttention(sub({ status: "PAST_DUE" }))).toBe(true);
    expect(needsAttention(sub({ status: "ACTIVE", cancelAtPeriodEnd: true }))).toBe(true);
    expect(
      needsAttention(
        sub({ status: "TRIALING", trialEndsAt: new Date(Date.now() + 2 * 86_400_000) }),
      ),
    ).toBe(true);
    expect(
      needsAttention(
        sub({ status: "TRIALING", trialEndsAt: new Date(Date.now() + 10 * 86_400_000) }),
      ),
    ).toBe(false);
    expect(needsAttention(sub({ status: "ACTIVE" }))).toBe(false);
  });
});
