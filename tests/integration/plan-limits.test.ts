import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb, createTestOrg, createPlan, createLead } from "./helpers";
import { assertWithinLimit, checkLimit, LimitError } from "@/lib/billing/entitlements";

describe("plan usage limits", () => {
  beforeAll(resetDb);

  it("allows creating up to the plan limit, then throws LimitError", async () => {
    const { org } = await createTestOrg();
    const plan = await createPlan({ leads: 2 });
    await prisma.subscription.create({
      data: {
        orgId: org.id,
        planId: plan.id,
        status: "ACTIVE",
        currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
      },
    });

    await createLead(org.id);
    await expect(assertWithinLimit(org.id, "leads")).resolves.toBeUndefined();

    await createLead(org.id);
    const check = await checkLimit(org.id, "leads");
    expect(check).toEqual({ metric: "leads", used: 2, limit: 2, allowed: false, remaining: 0 });

    await expect(assertWithinLimit(org.id, "leads")).rejects.toBeInstanceOf(LimitError);
  });

  it("treats an absent metric in `limits` as unlimited", async () => {
    const { org } = await createTestOrg();
    const plan = await createPlan({ leads: 1 }); // no `deals` key at all
    await prisma.subscription.create({
      data: {
        orgId: org.id,
        planId: plan.id,
        status: "ACTIVE",
        currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
      },
    });

    const check = await checkLimit(org.id, "deals");
    expect(check.limit).toBeNull();
    expect(check.allowed).toBe(true);
  });

  it("archived leads don't count toward the live usage total", async () => {
    const { org } = await createTestOrg();
    const plan = await createPlan({ leads: 1 });
    await prisma.subscription.create({
      data: {
        orgId: org.id,
        planId: plan.id,
        status: "ACTIVE",
        currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
      },
    });

    const lead = await createLead(org.id);
    await prisma.lead.update({ where: { id: lead.id }, data: { archived: true } });

    const check = await checkLimit(org.id, "leads");
    expect(check.used).toBe(0);
    expect(check.allowed).toBe(true);
  });
});
