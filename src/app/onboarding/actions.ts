"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { requireUser, ACTIVE_ORG_COOKIE } from "@/lib/context";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { createOrgSchema } from "@/lib/validation";
import { fieldErrors, formValue, type ActionState } from "@/lib/form";
import { slugify } from "@/lib/utils";
import { setActiveOrg } from "@/app/(app)/actions";

export async function createOrganizationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = createOrgSchema.safeParse({
    name: formValue(formData, "name"),
  });
  if (!parsed.success) {
    return { error: "Check the fields below.", fieldErrors: fieldErrors(parsed.error) };
  }

  const name = parsed.data.name;
  const base = slugify(name) || "workspace";
  let slug = base;
  for (let i = 2; await prisma.organization.findUnique({ where: { slug } }); i++) {
    slug = `${base}-${i}`;
  }

  const org = await prisma.$transaction(async (tx) => {
    const created = await tx.organization.create({
      data: { name, slug, createdById: user.id },
    });
    await tx.membership.create({
      data: { userId: user.id, orgId: created.id, role: "OWNER" },
    });
    return created;
  });

  await recordAudit({
    action: "org.create",
    orgId: org.id,
    actorId: user.id,
    targetType: "Organization",
    targetId: org.id,
    metadata: { name, slug },
  });

  await setActiveOrg(org.id);
  redirect("/dashboard");
}

/**
 * Accept a pending invite that was addressed to the signed-in user's email.
 * Shared by the onboarding screen and the /accept-invite/[token] page.
 */
export async function acceptInviteAction(token: string): Promise<ActionState> {
  const user = await requireUser();

  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { org: true },
  });

  if (!invite || invite.status !== "PENDING") {
    return { error: "This invite is no longer valid." };
  }
  if (invite.expiresAt < new Date()) {
    await prisma.invite.update({
      where: { id: invite.id },
      data: { status: "EXPIRED" },
    });
    return { error: "This invite has expired. Ask an admin to send a new one." };
  }
  if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
    return {
      error: `This invite was sent to ${invite.email}. Log in with that email to accept it.`,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.membership.upsert({
      where: { userId_orgId: { userId: user.id, orgId: invite.orgId } },
      create: { userId: user.id, orgId: invite.orgId, role: invite.role },
      update: { status: "ACTIVE" },
    });
    await tx.invite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });
  });

  await recordAudit({
    action: "member.invite.accept",
    orgId: invite.orgId,
    actorId: user.id,
    targetType: "User",
    targetId: user.id,
    metadata: { role: invite.role },
  });

  await setActiveOrg(invite.orgId);
  redirect("/dashboard");
}

export async function acceptInviteFormAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return acceptInviteAction(formValue(formData, "token"));
}
