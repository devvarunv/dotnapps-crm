"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { formValue, type ActionState } from "@/lib/form";
import { guard } from "@/lib/crm/guard";
import { getSubscription } from "@/lib/billing/entitlements";

const bump = () => {
  revalidatePath("/settings/subscription");
  revalidatePath("/", "layout");
};

export async function changePlanAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("billing:manage", { allowSuspended: true });
  if ("error" in g) return g.error;
  const { ctx } = g;

  const key = formValue(formData, "planKey");
  const plan = await prisma.subscriptionPlan.findFirst({
    where: { key, active: true, isPublic: true },
  });
  if (!plan) return { error: "That plan is not available." };

  const sub = await getSubscription(ctx.org.id);
  if (!sub) return { error: "No subscription to change." };
  if (sub.planId === plan.id) return { ok: true, message: "Already on that plan." };

  const now = new Date();
  await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      planId: plan.id,
      // Moving onto a paid plan clears a trial/grace lapse (no real payment
      // provider — this is the mock "checkout completed" transition).
      ...(plan.priceCents > 0
        ? {
            status: "ACTIVE",
            trialEndsAt: null,
            graceEndsAt: null,
            failedPaymentCount: 0,
            currentPeriodStart: now,
            currentPeriodEnd: new Date(now.getTime() + 30 * 86_400_000),
          }
        : {}),
    },
  });

  await recordAudit({
    action: "billing.change_plan",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    metadata: { to: plan.key },
  });
  bump();
  return { ok: true, message: `Switched to ${plan.name}.` };
}

export async function cancelSubscriptionAction(): Promise<void> {
  const g = await guard("billing:manage", { allowSuspended: true });
  if ("error" in g) return;
  const { ctx } = g;

  const sub = await getSubscription(ctx.org.id);
  if (!sub) return;
  await prisma.subscription.update({
    where: { id: sub.id },
    data: { cancelAtPeriodEnd: true, canceledAt: new Date() },
  });
  await recordAudit({ action: "billing.cancel", orgId: ctx.org.id, actorId: ctx.user.id });
  bump();
}

export async function resumeSubscriptionAction(): Promise<void> {
  const g = await guard("billing:manage", { allowSuspended: true });
  if ("error" in g) return;
  const { ctx } = g;

  const sub = await getSubscription(ctx.org.id);
  if (!sub) return;
  await prisma.subscription.update({
    where: { id: sub.id },
    data: { cancelAtPeriodEnd: false, canceledAt: null },
  });
  await recordAudit({ action: "billing.resume", orgId: ctx.org.id, actorId: ctx.user.id });
  bump();
}

/**
 * Sandbox billing action — there is no real payment provider. Lets an admin
 * exercise the failed-payment → grace → suspension path and recovery.
 */
export async function simulatePaymentAction(formData: FormData): Promise<ActionState> {
  const g = await guard("billing:manage", { allowSuspended: true });
  if ("error" in g) return g.error;
  const { ctx } = g;

  const outcome = formValue(formData, "outcome");
  const sub = await getSubscription(ctx.org.id);
  if (!sub) return { error: "No subscription." };
  const now = new Date();

  if (outcome === "success") {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: "ACTIVE",
        failedPaymentCount: 0,
        graceEndsAt: null,
        trialEndsAt: null,
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 86_400_000),
      },
    });
    await recordAudit({ action: "billing.payment_success", orgId: ctx.org.id, actorId: ctx.user.id });
    bump();
    return { ok: true, message: "Payment recorded — subscription active." };
  }

  if (outcome === "fail") {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: sub.status === "SUSPENDED" ? "SUSPENDED" : "PAST_DUE",
        failedPaymentCount: { increment: 1 },
        graceEndsAt: sub.graceEndsAt ?? new Date(now.getTime() + 7 * 86_400_000),
      },
    });
    await recordAudit({ action: "billing.payment_failed", orgId: ctx.org.id, actorId: ctx.user.id });
    bump();
    return { ok: true, message: "Simulated a failed payment — subscription is past due." };
  }

  return { error: "Unknown outcome." };
}
