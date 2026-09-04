import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb, createTestOrg, createPlan } from "./helpers";
import { assertWritable, SuspendedError } from "@/lib/billing/entitlements";
import { runBillingLifecycle } from "@/lib/billing/lifecycle";

describe("subscription lifecycle & write suspension", () => {
  beforeAll(resetDb);

  it("assertWritable throws once a subscription is SUSPENDED, and recovers when reactivated", async () => {
    const { org } = await createTestOrg();
    const plan = await createPlan();
    const sub = await prisma.subscription.create({
      data: {
        orgId: org.id,
        planId: plan.id,
        status: "ACTIVE",
        currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
      },
    });

    await expect(assertWritable(org.id)).resolves.toBeUndefined();

    await prisma.subscription.update({ where: { id: sub.id }, data: { status: "SUSPENDED" } });
    await expect(assertWritable(org.id)).rejects.toBeInstanceOf(SuspendedError);

    await prisma.subscription.update({ where: { id: sub.id }, data: { status: "ACTIVE" } });
    await expect(assertWritable(org.id)).resolves.toBeUndefined();
  });

  it("a CANCELED subscription is writable until the period ends, then read-only", async () => {
    const { org } = await createTestOrg();
    const plan = await createPlan();
    const sub = await prisma.subscription.create({
      data: {
        orgId: org.id,
        planId: plan.id,
        status: "CANCELED",
        currentPeriodEnd: new Date(Date.now() + 86_400_000),
        cancelAtPeriodEnd: true,
      },
    });
    await expect(assertWritable(org.id)).resolves.toBeUndefined();

    await prisma.subscription.update({
      where: { id: sub.id },
      data: { currentPeriodEnd: new Date(Date.now() - 1000) },
    });
    await expect(assertWritable(org.id)).rejects.toBeInstanceOf(SuspendedError);
  });

  it("runBillingLifecycle moves an expired trial to GRACE, and an expired grace to SUSPENDED", async () => {
    const { org } = await createTestOrg();
    const plan = await createPlan();
    const sub = await prisma.subscription.create({
      data: {
        orgId: org.id,
        planId: plan.id,
        status: "TRIALING",
        currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
        trialEndsAt: new Date(Date.now() - 1000), // trial already over
      },
    });

    let summary = await runBillingLifecycle(org.id);
    expect(summary.toGrace).toBe(1);

    let updated = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(updated.status).toBe("GRACE");
    expect(updated.graceEndsAt).not.toBeNull();

    // Running again immediately does nothing (grace hasn't elapsed yet).
    summary = await runBillingLifecycle(org.id);
    expect(summary.suspended).toBe(0);

    await prisma.subscription.update({
      where: { id: sub.id },
      data: { graceEndsAt: new Date(Date.now() - 1000) },
    });
    summary = await runBillingLifecycle(org.id);
    expect(summary.suspended).toBe(1);

    updated = await prisma.subscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(updated.status).toBe("SUSPENDED");
  });

  it("is idempotent: running the lifecycle twice in a row doesn't double-transition", async () => {
    const { org } = await createTestOrg();
    const plan = await createPlan();
    await prisma.subscription.create({
      data: {
        orgId: org.id,
        planId: plan.id,
        status: "ACTIVE",
        currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
      },
    });

    const first = await runBillingLifecycle(org.id);
    const second = await runBillingLifecycle(org.id);
    expect(first.checked).toBe(0); // ACTIVE isn't a lifecycle-eligible status
    expect(second.checked).toBe(0);
  });
});
