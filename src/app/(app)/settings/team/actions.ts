"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";

import { requirePermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { PermissionError, assignableRoles } from "@/lib/rbac";
import {
  changeRoleSchema,
  inviteSchema,
  membershipIdSchema,
  inviteIdSchema,
} from "@/lib/validation";
import { fieldErrors, formValue, type ActionState } from "@/lib/form";

const INVITE_TTL_DAYS = 14;

function inviteUrl(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";
  return `${base}/accept-invite/${token}`;
}

async function guard(permission: Parameters<typeof requirePermission>[0]) {
  try {
    return { ctx: await requirePermission(permission) };
  } catch (e) {
    if (e instanceof PermissionError) {
      return { error: "You don't have permission to do that." as const };
    }
    throw e;
  }
}

export async function inviteMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("members:invite");
  if ("error" in g) return { error: g.error };
  const { ctx } = g;

  const parsed = inviteSchema.safeParse({
    email: formValue(formData, "email"),
    role: formValue(formData, "role"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrors(parsed.error) };
  }
  const { email, role } = parsed.data;

  if (!assignableRoles(ctx.role).includes(role)) {
    return { fieldErrors: { role: "You can't assign that role." } };
  }

  if (email.toLowerCase() === ctx.user.email.toLowerCase()) {
    return { fieldErrors: { email: "That's your own email." } };
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existingUser) {
    const membership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: existingUser.id, orgId: ctx.org.id } },
    });
    if (membership && membership.status === "ACTIVE") {
      return { fieldErrors: { email: "That person is already a member." } };
    }
  }

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);

  await prisma.invite.upsert({
    where: { orgId_email: { orgId: ctx.org.id, email } },
    create: {
      orgId: ctx.org.id,
      email,
      role,
      token,
      invitedById: ctx.user.id,
      expiresAt,
      status: "PENDING",
    },
    update: {
      role,
      token,
      invitedById: ctx.user.id,
      expiresAt,
      status: "PENDING",
      acceptedAt: null,
    },
  });

  await recordAudit({
    action: "member.invited",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    targetType: "Invite",
    targetId: email,
    metadata: { email, role },
  });

  revalidatePath("/settings/team");
  return {
    ok: true,
    message: `Invitation ready for ${email}. Share the link below — email delivery ships in a later phase.`,
    data: { inviteUrl: inviteUrl(token), email },
  };
}

export async function revokeInviteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("members:invite");
  if ("error" in g) return { error: g.error };
  const { ctx } = g;

  const parsed = inviteIdSchema.safeParse({
    inviteId: formValue(formData, "inviteId"),
  });
  if (!parsed.success) return { error: "Invalid request." };

  const invite = await prisma.invite.findFirst({
    where: { id: parsed.data.inviteId, orgId: ctx.org.id, status: "PENDING" },
  });
  if (!invite) return { error: "That invitation no longer exists." };

  await prisma.invite.update({
    where: { id: invite.id },
    data: { status: "REVOKED" },
  });
  await recordAudit({
    action: "member.invite.revoke",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    targetType: "Invite",
    targetId: invite.email,
    metadata: { email: invite.email },
  });

  revalidatePath("/settings/team");
  return { ok: true, message: "Invitation revoked." };
}

export async function changeMemberRoleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("members:manage");
  if ("error" in g) return { error: g.error };
  const { ctx } = g;

  const parsed = changeRoleSchema.safeParse({
    membershipId: formValue(formData, "membershipId"),
    role: formValue(formData, "role"),
  });
  if (!parsed.success) return { error: "Invalid request." };
  const { membershipId, role } = parsed.data;

  const target = await prisma.membership.findFirst({
    where: { id: membershipId, orgId: ctx.org.id },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!target) return { error: "That member no longer exists." };

  if (target.userId === ctx.user.id) {
    return { error: "You can't change your own role." };
  }
  if (target.role === Role.OWNER) {
    return { error: "The owner's role can't be changed here." };
  }
  if (!assignableRoles(ctx.role).includes(role)) {
    return { error: "You can't assign that role." };
  }
  if (target.role === role) {
    return { ok: true, message: "No change." };
  }

  await prisma.membership.update({
    where: { id: target.id },
    data: { role },
  });
  await recordAudit({
    action: "member.role_change",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    targetType: "User",
    targetId: target.userId,
    metadata: { email: target.user.email, from: target.role, to: role },
  });

  revalidatePath("/settings/team");
  return { ok: true, message: `${target.user.name} is now ${role.toLowerCase()}.` };
}

export async function removeMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("members:manage");
  if ("error" in g) return { error: g.error };
  const { ctx } = g;

  const parsed = membershipIdSchema.safeParse({
    membershipId: formValue(formData, "membershipId"),
  });
  if (!parsed.success) return { error: "Invalid request." };

  const target = await prisma.membership.findFirst({
    where: { id: parsed.data.membershipId, orgId: ctx.org.id },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!target) return { error: "That member no longer exists." };

  if (target.userId === ctx.user.id) {
    return { error: "You can't remove yourself. Ask another admin." };
  }
  if (target.role === Role.OWNER) {
    return { error: "The owner can't be removed." };
  }

  await prisma.membership.delete({ where: { id: target.id } });
  await recordAudit({
    action: "member.remove",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    targetType: "User",
    targetId: target.userId,
    metadata: { email: target.user.email, role: target.role },
  });

  revalidatePath("/settings/team");
  return { ok: true, message: `${target.user.name} was removed.` };
}
