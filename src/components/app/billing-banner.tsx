import Link from "next/link";
import { getSubscription, isReadOnly, needsAttention } from "@/lib/billing/entitlements";
import { formatDate } from "@/lib/utils";

export async function BillingBanner({ orgId }: { orgId: string }) {
  const sub = await getSubscription(orgId);
  if (!sub) return null;

  if (isReadOnly(sub)) {
    return (
      <div className="border-b border-red-300 bg-red-50 px-4 py-2 text-center text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
        This workspace is <strong>suspended for billing</strong>. Data is
        retained; editing is disabled.{" "}
        <Link href="/settings/subscription" className="font-medium underline">
          Reactivate
        </Link>
      </div>
    );
  }

  if (needsAttention(sub)) {
    const msg = sub.cancelAtPeriodEnd
      ? `Subscription cancels on ${formatDate(sub.currentPeriodEnd)}.`
      : sub.status === "TRIALING"
        ? `Trial ends ${sub.trialEndsAt ? formatDate(sub.trialEndsAt) : "soon"}.`
        : `Payment past due — add a plan before ${sub.graceEndsAt ? formatDate(sub.graceEndsAt) : "the grace period ends"}.`;
    return (
      <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        {msg}{" "}
        <Link href="/settings/subscription" className="font-medium underline">
          Manage subscription
        </Link>
      </div>
    );
  }

  return null;
}
