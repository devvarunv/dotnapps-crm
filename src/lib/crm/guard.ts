import { requirePermission } from "@/lib/context";
import { PermissionError, type Permission } from "@/lib/rbac";
import {
  assertWithinLimit,
  assertWritable,
  LimitError,
  SuspendedError,
  type PlanMetric,
} from "@/lib/billing/entitlements";
import type { ActionState } from "@/lib/form";
import type { OrgContext } from "@/lib/context";

/**
 * Run a permission check plus a billing/suspension check, returning either the
 * org context or an `ActionState` error suitable for returning straight from a
 * server action. Pass `allowSuspended` for the handful of actions that must
 * keep working on a suspended workspace (e.g. managing the subscription).
 */
export async function guard(
  permission: Permission,
  opts?: { allowSuspended?: boolean },
): Promise<{ ctx: OrgContext } | { error: ActionState }> {
  let ctx: OrgContext;
  try {
    ctx = await requirePermission(permission);
  } catch (e) {
    if (e instanceof PermissionError) {
      return { error: { error: "You don't have permission to do that." } };
    }
    throw e;
  }

  if (!opts?.allowSuspended) {
    try {
      await assertWritable(ctx.org.id);
    } catch (e) {
      if (e instanceof SuspendedError) return { error: { error: e.message } };
      throw e;
    }
  }

  return { ctx };
}

/**
 * Returns an ActionState error when creating one more `metric` would exceed the
 * org's plan limit, otherwise null.
 */
export async function planLimitError(
  orgId: string,
  metric: PlanMetric,
): Promise<ActionState | null> {
  try {
    await assertWithinLimit(orgId, metric);
    return null;
  } catch (e) {
    if (e instanceof LimitError) return { error: e.message };
    throw e;
  }
}
