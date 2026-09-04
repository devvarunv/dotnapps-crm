"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { isRedirectError } from "@/lib/next";
import { fieldErrors, formValue, type ActionState } from "@/lib/form";
import { guard, planLimitError } from "@/lib/crm/guard";
import { contactSchema } from "@/lib/crm/validation";
import {
  resolveOwnerId,
  resolveTagIds,
  parseTagNames,
  assertCompanyInOrg,
} from "@/lib/crm/service";
import { logActivity } from "@/lib/crm/sales";

export async function createContactAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("contacts:create");
  if ("error" in g) return g.error;
  const { ctx } = g;

  const limit = await planLimitError(ctx.org.id, "contacts");
  if (limit) return limit;

  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  let ownerId: string | null;
  let companyId: string | null;
  try {
    ownerId = await resolveOwnerId(ctx.org.id, parsed.data.ownerId);
    companyId = await assertCompanyInOrg(ctx.org.id, parsed.data.companyId);
  } catch (e) {
    return { error: (e as Error).message };
  }

  const tagNames = parseTagNames(formValue(formData, "tags"));

  const contact = await prisma.$transaction(async (tx) => {
    const created = await tx.contact.create({
      data: {
        orgId: ctx.org.id,
        name: parsed.data.name,
        title: parsed.data.title ?? null,
        email: parsed.data.email ?? null,
        phone: parsed.data.phone ?? null,
        whatsapp: parsed.data.whatsapp ?? null,
        source: (parsed.data.source ?? null) as Prisma.ContactUncheckedCreateInput["source"],
        ownerId,
        companyId,
        tags: { connect: await resolveTagIds(tx, ctx.org.id, tagNames) },
      },
    });
    if (parsed.data.notesText) {
      await logActivity(tx, {
        orgId: ctx.org.id,
        type: "NOTE",
        body: parsed.data.notesText,
        createdById: ctx.user.id,
        contactId: created.id,
      });
    }
    return created;
  });

  await recordAudit({
    action: "contact.create",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    targetType: "Contact",
    targetId: contact.id,
    metadata: { name: contact.name },
  });

  revalidatePath("/contacts");
  redirect(`/contacts/${contact.id}`);
}

export async function updateContactAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("contacts:edit");
  if ("error" in g) return g.error;
  const { ctx } = g;

  const id = formValue(formData, "id");
  const existing = await prisma.contact.findFirst({ where: { id, orgId: ctx.org.id } });
  if (!existing) return { error: "That contact no longer exists." };

  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  let ownerId: string | null;
  let companyId: string | null;
  try {
    ownerId = await resolveOwnerId(ctx.org.id, parsed.data.ownerId);
    companyId = await assertCompanyInOrg(ctx.org.id, parsed.data.companyId);
  } catch (e) {
    return { error: (e as Error).message };
  }

  const tagNames = parseTagNames(formValue(formData, "tags"));

  try {
    await prisma.$transaction(async (tx) => {
      await tx.contact.update({
        where: { id },
        data: {
          name: parsed.data.name,
          title: parsed.data.title ?? null,
          email: parsed.data.email ?? null,
          phone: parsed.data.phone ?? null,
          whatsapp: parsed.data.whatsapp ?? null,
          source: (parsed.data.source ?? null) as Prisma.ContactUncheckedCreateInput["source"],
          ownerId,
          companyId,
          tags: { set: await resolveTagIds(tx, ctx.org.id, tagNames) },
        },
      });
    });
  } catch (e) {
    if (isRedirectError(e)) throw e;
    return { error: "Could not save changes." };
  }

  await recordAudit({
    action: "contact.update",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    targetType: "Contact",
    targetId: id,
  });

  revalidatePath(`/contacts/${id}`);
  revalidatePath("/contacts");
  redirect(`/contacts/${id}`);
}

export async function setContactArchivedAction(formData: FormData): Promise<void> {
  const g = await guard("contacts:edit");
  if ("error" in g) return;
  const { ctx } = g;

  const id = String(formData.get("id") ?? "");
  const archived = String(formData.get("archived") ?? "") === "true";
  const existing = await prisma.contact.findFirst({
    where: { id, orgId: ctx.org.id },
    select: { id: true },
  });
  if (!existing) return;

  await prisma.contact.update({ where: { id }, data: { archived } });
  await recordAudit({
    action: archived ? "contact.archive" : "contact.unarchive",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    targetType: "Contact",
    targetId: id,
  });
  revalidatePath("/contacts");
  revalidatePath(`/contacts/${id}`);
}
