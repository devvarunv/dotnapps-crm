import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { notifyMany } from "@/lib/automation/notify";

const GRACE_DAYS = 7;

export type LifecycleSummary = { checked: number; toGrace: number; suspended: number };

async function notifyAdmins(orgId: string, title: string, body: string) {
  const admins = await prisma.membership.findMany({
    where: { orgId, status: "ACTIVE", role: { in: ["OWNER", "ADMIN"] } },
    select: { userId: true },
  });
  await notifyMany(admins.map((a) => a.userId), {
    orgId,
    type: "GENERIC",
    title,
    body,
    url: "/settings/subscription",
  });
}

/**
 * Advance every subscription according to its dates. No real payments:
 *   TRIALING (trial ended)         -> GRACE   (graceEndsAt = +7d)
 *   GRACE / PAST_DUE (grace ended) -> SUSPENDED
 */
export async function runBillingLifecycle(orgId?: string): Promise<LifecycleSummary> {
  const now = new Date();
  const subs = await prisma.subscription.findMany({
    where: {
      ...(orgId ? { orgId } : {}),
      status: { in: ["TRIALING", "GRACE", "PAST_DUE"] },
    },
  });

  const summary: LifecycleSummary = { checked: subs.length, toGrace: 0, suspended: 0 };

  for (const sub of subs) {
    if (sub.status === "TRIALING" && sub.trialEndsAt && sub.trialEndsAt <= now) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: "GRACE",
          graceEndsAt: new Date(sub.trialEndsAt.getTime() + GRACE_DAYS * 86_400_000),
        },
      });
      await recordAudit({ action: "billing.trial_ended", orgId: sub.orgId });
      await notifyAdmins(
        sub.orgId,
        "Your trial has ended",
        `You have ${GRACE_DAYS} days to add a plan before the workspace is suspended.`,
      );
      summary.toGrace++;
      continue;
    }

    if (
      (sub.status === "GRACE" || sub.status === "PAST_DUE") &&
      sub.graceEndsAt &&
      sub.graceEndsAt <= now
    ) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: "SUSPENDED" },
      });
      await recordAudit({ action: "billing.suspended", orgId: sub.orgId });
      await notifyAdmins(
        sub.orgId,
        "Workspace suspended",
        "Editing is disabled until the subscription is reactivated. Your data is retained.",
      );
      summary.suspended++;
    }
  }

  if (summary.toGrace || summary.suspended) {
    await recordAudit({ action: "billing.lifecycle_run", orgId: orgId ?? null, metadata: { ...summary } });
  }
  return summary;
}
