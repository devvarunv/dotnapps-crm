"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { isRedirectError } from "@/lib/next";
import { fieldErrors, formValue, type ActionState } from "@/lib/form";
import { guard, planLimitError } from "@/lib/crm/guard";
import { companySchema, addressSchema } from "@/lib/crm/validation";
import { resolveOwnerId, resolveTagIds, parseTagNames } from "@/lib/crm/service";
import { logActivity } from "@/lib/crm/sales";

export async function createCompanyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("companies:create");
  if ("error" in g) return g.error;
  const { ctx } = g;

  const limit = await planLimitError(ctx.org.id, "companies");
  if (limit) return limit;

  const parsed = companySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  let ownerId: string | null;
  try {
    ownerId = await resolveOwnerId(ctx.org.id, parsed.data.ownerId);
  } catch (e) {
    return { fieldErrors: { ownerId: (e as Error).message } };
  }

  const tagNames = parseTagNames(formValue(formData, "tags"));

  const company = await prisma.$transaction(async (tx) => {
    const created = await tx.company.create({
      data: {
        orgId: ctx.org.id,
        name: parsed.data.name,
        website: parsed.data.website ?? null,
        industry: parsed.data.industry ?? null,
        size: parsed.data.size ?? null,
        gstin: parsed.data.gstin ?? null,
        ownerId,
        tags: { connect: await resolveTagIds(tx, ctx.org.id, tagNames) },
      },
    });
    if (parsed.data.notesText) {
      await logActivity(tx, {
        orgId: ctx.org.id,
        type: "NOTE",
        body: parsed.data.notesText,
        createdById: ctx.user.id,
        companyId: created.id,
      });
    }
    return created;
  });

  await recordAudit({
    action: "company.create",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    targetType: "Company",
    targetId: company.id,
    metadata: { name: company.name },
  });

  revalidatePath("/companies");
  redirect(`/companies/${company.id}`);
}

export async function updateCompanyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("companies:edit");
  if ("error" in g) return g.error;
  const { ctx } = g;

  const id = formValue(formData, "id");
  const existing = await prisma.company.findFirst({ where: { id, orgId: ctx.org.id } });
  if (!existing) return { error: "That company no longer exists." };

  const parsed = companySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  let ownerId: string | null;
  try {
    ownerId = await resolveOwnerId(ctx.org.id, parsed.data.ownerId);
  } catch (e) {
    return { fieldErrors: { ownerId: (e as Error).message } };
  }

  const tagNames = parseTagNames(formValue(formData, "tags"));

  try {
    await prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: { id },
        data: {
          name: parsed.data.name,
          website: parsed.data.website ?? null,
          industry: parsed.data.industry ?? null,
          size: parsed.data.size ?? null,
          gstin: parsed.data.gstin ?? null,
          ownerId,
          tags: { set: await resolveTagIds(tx, ctx.org.id, tagNames) },
        },
      });
    });
  } catch (e) {
    if (isRedirectError(e)) throw e;
    return { error: "Could not save changes." };
  }

  await recordAudit({
    action: "company.update",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    targetType: "Company",
    targetId: id,
  });

  revalidatePath(`/companies/${id}`);
  revalidatePath("/companies");
  redirect(`/companies/${id}`);
}

export async function setCompanyArchivedAction(formData: FormData): Promise<void> {
  const g = await guard("companies:edit");
  if ("error" in g) return;
  const { ctx } = g;

  const id = String(formData.get("id") ?? "");
  const archived = String(formData.get("archived") ?? "") === "true";
  const existing = await prisma.company.findFirst({
    where: { id, orgId: ctx.org.id },
    select: { id: true },
  });
  if (!existing) return;

  await prisma.company.update({ where: { id }, data: { archived } });
  await recordAudit({
    action: archived ? "company.archive" : "company.unarchive",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    targetType: "Company",
    targetId: id,
  });
  revalidatePath("/companies");
  revalidatePath(`/companies/${id}`);
}

export async function saveAddressAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("companies:edit");
  if ("error" in g) return g.error;
  const { ctx } = g;

  const parsed = addressSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const company = await prisma.company.findFirst({
    where: { id: parsed.data.companyId, orgId: ctx.org.id },
    select: { id: true },
  });
  if (!company) return { error: "That company no longer exists." };

  const addressId = formValue(formData, "addressId");
  const data = {
    kind: parsed.data.kind as never,
    line1: parsed.data.line1 ?? null,
    line2: parsed.data.line2 ?? null,
    city: parsed.data.city ?? null,
    state: parsed.data.state ?? null,
    postalCode: parsed.data.postalCode ?? null,
    country: parsed.data.country ?? null,
  };

  if (addressId) {
    const existing = await prisma.address.findFirst({
      where: { id: addressId, orgId: ctx.org.id, companyId: company.id },
      select: { id: true },
    });
    if (!existing) return { error: "That address no longer exists." };
    await prisma.address.update({ where: { id: addressId }, data });
  } else {
    await prisma.address.create({
      data: { ...data, orgId: ctx.org.id, companyId: company.id },
    });
  }

  await recordAudit({
    action: "company.address_save",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    targetType: "Company",
    targetId: company.id,
  });

  revalidatePath(`/companies/${company.id}`);
  return { ok: true, message: "Address saved." };
}

export async function deleteAddressAction(formData: FormData): Promise<void> {
  const g = await guard("companies:edit");
  if ("error" in g) return;
  const { ctx } = g;

  const addressId = String(formData.get("addressId") ?? "");
  const address = await prisma.address.findFirst({
    where: { id: addressId, orgId: ctx.org.id },
    select: { id: true, companyId: true },
  });
  if (!address) return;

  await prisma.address.delete({ where: { id: address.id } });
  revalidatePath(`/companies/${address.companyId}`);
}
