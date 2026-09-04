import { requirePermission } from "@/lib/context";
import { PermissionError, type Permission } from "@/lib/rbac";
import type { ActionState } from "@/lib/form";
import type { OrgContext } from "@/lib/context";

/**
 * Run a permission check, returning either the org context or an
 * `ActionState` error suitable for returning straight from a server action.
 */
export async function guard(
  permission: Permission,
): Promise<{ ctx: OrgContext } | { error: ActionState }> {
  try {
    return { ctx: await requirePermission(permission) };
  } catch (e) {
    if (e instanceof PermissionError) {
      return { error: { error: "You don't have permission to do that." } };
    }
    throw e;
  }
}
