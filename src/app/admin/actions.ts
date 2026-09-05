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

/** Grant or revoke platform-level Super Admin access. Guarded against
 * locking the platform out: an admin can't demote themselves, and the last
 * remaining super admin can't be demoted by anyone. */
export async function toggleSuperAdminAction(formData: FormData): Promise<ActionState> {
  const actor = await requireSuperAdmin();
  const userId = String(formData.get("userId") ?? "");
  const makeAdmin = formData.get("makeAdmin") === "true";
  if (!userId) return { error: "Missing user." };

  if (!makeAdmin) {
    if (userId === actor.id) {
      return { error: "You can't revoke your own Super Admin access." };
    }
    const adminCount = await prisma.user.count({ where: { isSuperAdmin: true } });
    if (adminCount <= 1) {
      return { error: "At least one Super Admin must remain." };
    }
  }

  const target = await prisma.user.update({
    where: { id: userId },
    data: { isSuperAdmin: makeAdmin },
    select: { email: true },
  });
  await recordAudit({
    action: makeAdmin ? "admin.super_admin.grant" : "admin.super_admin.revoke",
    actorId: actor.id,
    targetType: "User",
    targetId: userId,
    metadata: { email: target.email },
  });
  revalidatePath("/admin/users");
  revalidatePath("/admin/security");
  return { ok: true, message: makeAdmin ? "Granted Super Admin." : "Revoked Super Admin." };
}

/** Extend a struggling org's trial/grace period by N days — the core
 * "support tooling" action for a business that calls in asking for more time. */
export async function extendTrialAction(formData: FormData): Promise<ActionState> {
  const actor = await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const days = Number(formData.get("days") ?? 7);
  if (!id || !Number.isFinite(days) || days <= 0 || days > 90) {
    return { error: "Invalid request." };
  }

  const sub = await prisma.subscription.findUnique({ where: { id } });
  if (!sub) return { error: "Subscription not found." };

  const extend = (d: Date | null) =>
    new Date(Math.max(d?.getTime() ?? Date.now(), Date.now()) + days * 86_400_000);

  await prisma.subscription.update({
    where: { id },
    data: {
      currentPeriodEnd: extend(sub.currentPeriodEnd),
      ...(sub.trialEndsAt ? { trialEndsAt: extend(sub.trialEndsAt) } : {}),
      ...(sub.graceEndsAt ? { graceEndsAt: extend(sub.graceEndsAt) } : {}),
      ...(sub.status === "PAST_DUE" || sub.status === "GRACE" ? { status: "ACTIVE" as const } : {}),
    },
  });
  await recordAudit({
    action: "billing.admin.extend_trial",
    orgId: sub.orgId,
    actorId: actor.id,
    metadata: { days },
  });
  revalidatePath("/admin/businesses");
  revalidatePath(`/admin/businesses/${sub.orgId}`);
  revalidatePath("/admin/subscriptions");
  return { ok: true, message: `Extended by ${days} day${days === 1 ? "" : "s"}.` };
}

/** Revoke a pending invite from the admin side (support case: wrong email,
 * abandoned invite, etc). */
export async function revokeInviteAdminAction(formData: FormData): Promise<ActionState> {
  const actor = await requireSuperAdmin();
  const id = String(formData.get("id") ?? "");
  const invite = await prisma.invite.findUnique({ where: { id } });
  if (!invite || invite.status !== "PENDING") return { error: "Invite not found." };

  await prisma.invite.update({ where: { id }, data: { status: "REVOKED" } });
  await recordAudit({
    action: "member.invite.revoke",
    orgId: invite.orgId,
    actorId: actor.id,
    targetType: "Invite",
    targetId: id,
    metadata: { email: invite.email, viaAdmin: true },
  });
  revalidatePath(`/admin/businesses/${invite.orgId}`);
  return { ok: true, message: "Invite revoked." };
}
