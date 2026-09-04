"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

import { requireSuperAdmin } from "@/lib/context";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { fieldErrors, formValue, type ActionState } from "@/lib/form";
import { runBillingLifecycle } from "@/lib/billing/lifecycle";
import { PLAN_METRICS } from "@/lib/billing/entitlements";

const planSchema = z.object({
  id: z.string().optional(),
  key: z.string().trim().regex(/^[a-z0-9-]{2,40}$/, "lowercase, digits and dashes"),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(200).optional(),
  priceCents: z.coerce.number().int().min(0).max(10_000_00),
  interval: z.enum(["MONTHLY", "YEARLY"]),
  trialDays: z.coerce.number().int().min(0).max(90),
  isPublic: z.string().optional(),
  isDefault: z.string().optional(),
  active: z.string().optional(),
  sortOrder: z.coerce.number().int().min(0).max(999),
  features: z.string().optional(),
  limits: z.string().optional(),
});

function parseLimits(raw: string | undefined): Prisma.InputJsonValue {
  if (!raw) return {};
  const out: Record<string, number> = {};
  for (const line of raw.split(/[\n,]/)) {
    const [k, v] = line.split(/[:=]/).map((s) => s.trim());
    if (PLAN_METRICS.includes(k as never) && v && !Number.isNaN(Number(v))) {
      out[k] = Number(v);
    }
  }
  return out;
}

export async function savePlanAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireSuperAdmin();
  const parsed = planSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;

  const data = {
    key: d.key,
    name: d.name,
    description: d.description ?? null,
    priceCents: d.priceCents,
    interval: d.interval as Prisma.SubscriptionPlanCreateInput["interval"],
    trialDays: d.trialDays,
    isPublic: d.isPublic === "on",
    isDefault: d.isDefault === "on",
    active: d.active === "on",
    sortOrder: d.sortOrder,
    features: (d.features ?? "").split("\n").map((s) => s.trim()).filter(Boolean),
    limits: parseLimits(d.limits),
  };

  await prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.subscriptionPlan.updateMany({ data: { isDefault: false }, where: {} });
    }
    if (d.id) {
      await tx.subscriptionPlan.update({ where: { id: d.id }, data });
    } else {
      await tx.subscriptionPlan.create({ data });
    }
  });

  await recordAudit({
    action: d.id ? "billing.plan.update" : "billing.plan.create",
    actorId: user.id,
    metadata: { key: d.key },
  });
  revalidatePath("/admin/plans");
  revalidatePath("/pricing");
  return { ok: true, message: "Plan saved." };
}

export async function setSubscriptionStatusAction(formData: FormData): Promise<void> {
  const user = await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const valid = ["TRIALING", "ACTIVE", "PAST_DUE", "GRACE", "SUSPENDED", "CANCELED"];
  if (!valid.includes(status)) return;

  const sub = await prisma.subscription.findUnique({ where: { id }, select: { orgId: true } });
  if (!sub) return;

  await prisma.subscription.update({
    where: { id },
    data: {
      status: status as Prisma.SubscriptionUpdateInput["status"],
      ...(status === "ACTIVE"
        ? { graceEndsAt: null, trialEndsAt: null, failedPaymentCount: 0 }
        : {}),
      ...(status === "GRACE" || status === "PAST_DUE"
        ? { graceEndsAt: new Date(Date.now() + 7 * 86_400_000) }
        : {}),
    },
  });
  await recordAudit({
    action: "billing.admin.set_status",
    orgId: sub.orgId,
    actorId: user.id,
    metadata: { status },
  });
  revalidatePath("/admin/subscriptions");
}

export async function changeSubscriptionPlanAction(formData: FormData): Promise<void> {
  const user = await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const planId = String(formData.get("planId") ?? "");
  const [sub, plan] = await Promise.all([
    prisma.subscription.findUnique({ where: { id }, select: { orgId: true } }),
    prisma.subscriptionPlan.findUnique({ where: { id: planId }, select: { id: true, key: true } }),
  ]);
  if (!sub || !plan) return;
  await prisma.subscription.update({ where: { id }, data: { planId: plan.id } });
  await recordAudit({
    action: "billing.admin.change_plan",
    orgId: sub.orgId,
    actorId: user.id,
    metadata: { to: plan.key },
  });
  revalidatePath("/admin/subscriptions");
}

export async function runLifecycleAction(): Promise<ActionState> {
  const user = await requireSuperAdmin();
  const summary = await runBillingLifecycle();
  await recordAudit({ action: "billing.admin.run_lifecycle", actorId: user.id, metadata: { ...summary } });
  revalidatePath("/admin/subscriptions");
  return {
    ok: true,
    message: `Checked ${summary.checked}: ${summary.toGrace} moved to grace, ${summary.suspended} suspended.`,
  };
}
