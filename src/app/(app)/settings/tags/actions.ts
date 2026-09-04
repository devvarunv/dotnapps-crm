"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { fieldErrors, formValue, type ActionState } from "@/lib/form";
import { guard } from "@/lib/crm/guard";
import { tagSchema } from "@/lib/crm/validation";

export async function createTagAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("org:manage");
  if ("error" in g) return g.error;
  const { ctx } = g;

  const parsed = tagSchema.safeParse({
    name: formValue(formData, "name"),
    color: formValue(formData, "color") || "#64748b",
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  try {
    await prisma.tag.create({
      data: { orgId: ctx.org.id, name: parsed.data.name, color: parsed.data.color },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { fieldErrors: { name: "A tag with that name already exists." } };
    }
    throw e;
  }

  await recordAudit({
    action: "tag.create",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    metadata: { name: parsed.data.name },
  });
  revalidatePath("/settings/tags");
  return { ok: true, message: "Tag created." };
}

export async function updateTagAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("org:manage");
  if ("error" in g) return g.error;
  const { ctx } = g;

  const id = formValue(formData, "id");
  const tag = await prisma.tag.findFirst({ where: { id, orgId: ctx.org.id } });
  if (!tag) return { error: "That tag no longer exists." };

  const parsed = tagSchema.safeParse({
    name: formValue(formData, "name"),
    color: formValue(formData, "color") || tag.color,
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  try {
    await prisma.tag.update({
      where: { id },
      data: { name: parsed.data.name, color: parsed.data.color },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { fieldErrors: { name: "A tag with that name already exists." } };
    }
    throw e;
  }

  await recordAudit({
    action: "tag.update",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    metadata: { id, name: parsed.data.name },
  });
  revalidatePath("/settings/tags");
  return { ok: true, message: "Tag updated." };
}

export async function deleteTagAction(formData: FormData): Promise<void> {
  const g = await guard("org:manage");
  if ("error" in g) return;
  const { ctx } = g;

  const id = String(formData.get("id") ?? "");
  const tag = await prisma.tag.findFirst({
    where: { id, orgId: ctx.org.id },
    select: { id: true, name: true },
  });
  if (!tag) return;

  await prisma.tag.delete({ where: { id: tag.id } });
  await recordAudit({
    action: "tag.delete",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    metadata: { name: tag.name },
  });
  revalidatePath("/settings/tags");
}
