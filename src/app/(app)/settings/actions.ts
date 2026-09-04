"use server";

import { revalidatePath } from "next/cache";

import { requireOrgContext, requirePermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { PermissionError } from "@/lib/rbac";
import {
  changePasswordSchema,
  renameOrgSchema,
  updateProfileSchema,
} from "@/lib/validation";
import { fieldErrors, formValue, type ActionState } from "@/lib/form";

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireOrgContext();

  const parsed = updateProfileSchema.safeParse({
    name: formValue(formData, "name"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error) };
  }

  await prisma.user.update({
    where: { id: ctx.user.id },
    data: { name: parsed.data.name },
  });
  await recordAudit({
    action: "profile.update",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    targetType: "User",
    targetId: ctx.user.id,
  });

  revalidatePath("/settings/profile");
  return { ok: true, message: "Profile updated." };
}

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireOrgContext();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formValue(formData, "currentPassword"),
    newPassword: formValue(formData, "newPassword"),
    confirmPassword: formValue(formData, "confirmPassword"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error) };
  }

  const fresh = await prisma.user.findUniqueOrThrow({
    where: { id: ctx.user.id },
  });
  const ok = await verifyPassword(parsed.data.currentPassword, fresh.passwordHash);
  if (!ok) {
    return { fieldErrors: { currentPassword: "That password is incorrect." } };
  }

  await prisma.user.update({
    where: { id: ctx.user.id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword) },
  });
  await recordAudit({
    action: "profile.password_change",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    targetType: "User",
    targetId: ctx.user.id,
  });

  return { ok: true, message: "Password changed." };
}

export async function renameOrganizationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let ctx;
  try {
    ctx = await requirePermission("org:manage");
  } catch (e) {
    if (e instanceof PermissionError) {
      return { error: "You don't have permission to rename this workspace." };
    }
    throw e;
  }

  const parsed = renameOrgSchema.safeParse({ name: formValue(formData, "name") });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error) };
  }

  const previous = ctx.org.name;
  if (previous === parsed.data.name) {
    return { ok: true, message: "No changes." };
  }

  await prisma.organization.update({
    where: { id: ctx.org.id },
    data: { name: parsed.data.name },
  });
  await recordAudit({
    action: "org.rename",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    targetType: "Organization",
    targetId: ctx.org.id,
    metadata: { from: previous, to: parsed.data.name },
  });

  revalidatePath("/", "layout");
  return { ok: true, message: "Workspace renamed." };
}
