"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { isRedirectError } from "@/lib/next";
import { fieldErrors, formValue, type ActionState } from "@/lib/form";
import { guard } from "@/lib/crm/guard";
import {
  leadSchema,
  convertLeadSchema,
  bulkAssignSchema,
  bulkStatusSchema,
  bulkTagSchema,
  idsSchema,
} from "@/lib/crm/validation";
import {
  resolveOwnerId,
  resolveTagIds,
  parseTagNames,
  assertCompanyInOrg,
} from "@/lib/crm/service";
import { logActivity, getDefaultPipeline, dealFieldsForStage } from "@/lib/crm/sales";
import { notifyAssignment, notify } from "@/lib/automation/notify";

function leadData(input: ReturnType<typeof leadSchema.parse>) {
  return {
    name: input.name,
    companyName: input.companyName ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    whatsapp: input.whatsapp ?? null,
    website: input.website ?? null,
    source: input.source as Prisma.LeadCreateInput["source"],
    industry: input.industry ?? null,
    location: input.location ?? null,
    status: input.status as Prisma.LeadCreateInput["status"],
    estimatedValue:
      input.estimatedValue !== undefined
        ? new Prisma.Decimal(input.estimatedValue)
        : null,
    nextFollowUpAt: input.nextFollowUpAt
      ? new Date(input.nextFollowUpAt)
      : null,
  };
}

export async function createLeadAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("leads:create");
  if ("error" in g) return g.error;
  const { ctx } = g;

  const parsed = leadSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  let ownerId: string | null;
  try {
    ownerId = await resolveOwnerId(ctx.org.id, parsed.data.ownerId);
  } catch (e) {
    return { fieldErrors: { ownerId: (e as Error).message } };
  }

  const tagNames = parseTagNames(formValue(formData, "tags"));

  const lead = await prisma.$transaction(async (tx) => {
    const created = await tx.lead.create({
      data: {
        orgId: ctx.org.id,
        ownerId,
        ...leadData(parsed.data),
        tags: { connect: await resolveTagIds(tx, ctx.org.id, tagNames) },
      },
    });
    if (parsed.data.notesText) {
      await logActivity(tx, {
        orgId: ctx.org.id,
        type: "NOTE",
        body: parsed.data.notesText,
        createdById: ctx.user.id,
        leadId: created.id,
      });
    }
    return created;
  });

  await recordAudit({
    action: "lead.create",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    targetType: "Lead",
    targetId: lead.id,
    metadata: { name: lead.name },
  });
  await notifyAssignment({
    orgId: ctx.org.id,
    assigneeId: ownerId,
    actorId: ctx.user.id,
    title: `Lead assigned to you: ${lead.name}`,
    url: `/leads/${lead.id}`,
    entityType: "Lead",
    entityId: lead.id,
  });

  revalidatePath("/leads");
  redirect(`/leads/${lead.id}`);
}

export async function updateLeadAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("leads:edit");
  if ("error" in g) return g.error;
  const { ctx } = g;

  const id = formValue(formData, "id");
  const existing = await prisma.lead.findFirst({
    where: { id, orgId: ctx.org.id },
  });
  if (!existing) return { error: "That lead no longer exists." };

  const parsed = leadSchema.safeParse(Object.fromEntries(formData));
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
      await tx.lead.update({
        where: { id },
        data: {
          ownerId,
          ...leadData(parsed.data),
          tags: { set: await resolveTagIds(tx, ctx.org.id, tagNames) },
        },
      });
    });
  } catch (e) {
    if (isRedirectError(e)) throw e;
    return { error: "Could not save changes. Try again." };
  }

  await recordAudit({
    action: "lead.update",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    targetType: "Lead",
    targetId: id,
  });
  if (ownerId && ownerId !== existing.ownerId) {
    await notifyAssignment({
      orgId: ctx.org.id,
      assigneeId: ownerId,
      actorId: ctx.user.id,
      title: `Lead assigned to you: ${parsed.data.name}`,
      url: `/leads/${id}`,
      entityType: "Lead",
      entityId: id,
    });
  }

  revalidatePath(`/leads/${id}`);
  revalidatePath("/leads");
  redirect(`/leads/${id}`);
}

export async function setLeadArchivedAction(formData: FormData): Promise<void> {
  const g = await guard("leads:edit");
  if ("error" in g) return;
  const { ctx } = g;

  const id = String(formData.get("id") ?? "");
  const archived = String(formData.get("archived") ?? "") === "true";

  const existing = await prisma.lead.findFirst({
    where: { id, orgId: ctx.org.id },
    select: { id: true },
  });
  if (!existing) return;

  await prisma.lead.update({ where: { id }, data: { archived } });
  await recordAudit({
    action: archived ? "lead.archive" : "lead.unarchive",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    targetType: "Lead",
    targetId: id,
  });

  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
}

export async function convertLeadAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("leads:edit");
  if ("error" in g) return g.error;
  const { ctx } = g;

  const parsed = convertLeadSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };

  const lead = await prisma.lead.findFirst({
    where: { id: parsed.data.leadId, orgId: ctx.org.id },
    include: { tags: { select: { id: true } } },
  });
  if (!lead) return { error: "That lead no longer exists." };
  if (lead.convertedAt) return { error: "This lead has already been converted." };

  let companyId: string | null = null;
  let contactId: string | null = null;
  let dealId: string | null = null;

  try {
    companyId = await assertCompanyInOrg(ctx.org.id, parsed.data.companyId);
  } catch (e) {
    return { error: (e as Error).message };
  }

  // A deal needs a pipeline with at least one stage.
  const pipeline = parsed.data.createDeal
    ? await getDefaultPipeline(ctx.org.id)
    : null;
  if (parsed.data.createDeal && (!pipeline || pipeline.stages.length === 0)) {
    return { error: "Create a pipeline with at least one stage before making deals." };
  }

  const tagConnect = lead.tags.map((t) => ({ id: t.id }));

  try {
    await prisma.$transaction(async (tx) => {
      if (parsed.data.createCompany && !companyId && lead.companyName) {
        // Reduce duplicates: reuse an existing same-name company if there is one.
        const match = await tx.company.findFirst({
          where: {
            orgId: ctx.org.id,
            name: { equals: lead.companyName, mode: "insensitive" },
          },
          select: { id: true },
        });
        if (match) {
          companyId = match.id;
        } else {
          const company = await tx.company.create({
            data: {
              orgId: ctx.org.id,
              name: lead.companyName,
              ownerId: lead.ownerId,
              website: lead.website,
              industry: lead.industry,
              tags: { connect: tagConnect },
            },
          });
          companyId = company.id;
        }
      }

      if (parsed.data.createContact) {
        const contact = await tx.contact.create({
          data: {
            orgId: ctx.org.id,
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
            whatsapp: lead.whatsapp,
            source: lead.source,
            ownerId: lead.ownerId,
            companyId,
            tags: { connect: tagConnect },
          },
        });
        contactId = contact.id;

        // Re-home the lead's activity history onto the new contact.
        await tx.activity.updateMany({
          where: { leadId: lead.id },
          data: { contactId: contact.id },
        });
      }

      if (parsed.data.createDeal && pipeline) {
        const stage = pipeline.stages[0];
        const deal = await tx.deal.create({
          data: {
            orgId: ctx.org.id,
            name: lead.companyName ? `${lead.companyName} deal` : `${lead.name} deal`,
            pipelineId: pipeline.id,
            stageId: stage.id,
            ...dealFieldsForStage(stage),
            companyId,
            contactId,
            ownerId: lead.ownerId,
            source: lead.source,
            value: lead.estimatedValue,
            tags: { connect: tagConnect },
          },
        });
        dealId = deal.id;
        await logActivity(tx, {
          orgId: ctx.org.id,
          type: "NOTE",
          source: "SYSTEM",
          subject: "Deal created from lead",
          createdById: ctx.user.id,
          dealId: deal.id,
        });
      }

      await tx.lead.update({
        where: { id: lead.id },
        data: {
          status:
            lead.status === "NEW" || lead.status === "CONTACTED"
              ? "QUALIFIED"
              : lead.status,
          convertedAt: new Date(),
          convertedContactId: contactId,
          convertedCompanyId: companyId,
          convertedDealId: dealId,
          lastActivityAt: new Date(),
        },
      });
    });
  } catch (e) {
    if (isRedirectError(e)) throw e;
    return { error: "Conversion failed. Try again." };
  }

  await recordAudit({
    action: "lead.convert",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    targetType: "Lead",
    targetId: lead.id,
    metadata: { companyId, contactId, dealId },
  });

  revalidatePath(`/leads/${lead.id}`);
  if (dealId) redirect(`/deals/${dealId}`);
  if (contactId) redirect(`/contacts/${contactId}`);
  if (companyId) redirect(`/companies/${companyId}`);
  return { ok: true, message: "Lead converted." };
}

/* --------------------------------------------------------------- bulk ------ */

export async function bulkAssignLeadsAction(
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("leads:assign");
  if ("error" in g) return g.error;
  const { ctx } = g;

  const parsed = bulkAssignSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Select rows and an owner." };

  let ownerId: string | null;
  try {
    ownerId = await resolveOwnerId(ctx.org.id, parsed.data.ownerId || undefined);
  } catch (e) {
    return { error: (e as Error).message };
  }

  const { count } = await prisma.lead.updateMany({
    where: { id: { in: parsed.data.ids }, orgId: ctx.org.id },
    data: { ownerId },
  });
  await recordAudit({
    action: "lead.bulk_assign",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    metadata: { count, ownerId },
  });
  if (ownerId && ownerId !== ctx.user.id && count > 0) {
    await notify({
      orgId: ctx.org.id,
      userId: ownerId,
      type: "ASSIGNMENT",
      title: `${count} lead${count === 1 ? "" : "s"} assigned to you`,
      url: "/leads?owner=" + ownerId,
    });
  }

  revalidatePath("/leads");
  return { ok: true, message: `${count} lead${count === 1 ? "" : "s"} reassigned.` };
}

export async function bulkStatusLeadsAction(
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("leads:edit");
  if ("error" in g) return g.error;
  const { ctx } = g;

  const parsed = bulkStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Select rows and a status." };

  const { count } = await prisma.lead.updateMany({
    where: { id: { in: parsed.data.ids }, orgId: ctx.org.id },
    data: { status: parsed.data.status as Prisma.LeadUpdateManyMutationInput["status"] },
  });
  await recordAudit({
    action: "lead.bulk_status",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    metadata: { count, status: parsed.data.status },
  });

  revalidatePath("/leads");
  return { ok: true, message: `${count} lead${count === 1 ? "" : "s"} updated.` };
}

export async function bulkTagLeadsAction(
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("leads:edit");
  if ("error" in g) return g.error;
  const { ctx } = g;

  const parsed = bulkTagSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Select rows and a tag." };

  const tag = await prisma.tag.findFirst({
    where: { id: parsed.data.tagId, orgId: ctx.org.id },
    select: { id: true },
  });
  if (!tag) return { error: "That tag no longer exists." };

  const rel =
    parsed.data.op === "add"
      ? { tags: { connect: { id: tag.id } } }
      : { tags: { disconnect: { id: tag.id } } };

  // updateMany can't modify m-n relations; update the org-scoped rows one by one.
  const leads = await prisma.lead.findMany({
    where: { id: { in: parsed.data.ids }, orgId: ctx.org.id },
    select: { id: true },
  });
  for (const l of leads) {
    await prisma.lead.update({ where: { id: l.id }, data: rel });
  }

  await recordAudit({
    action: "lead.bulk_tag",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    metadata: { count: leads.length, tagId: tag.id, op: parsed.data.op },
  });

  revalidatePath("/leads");
  return { ok: true, message: `Tag ${parsed.data.op === "add" ? "added to" : "removed from"} ${leads.length} lead${leads.length === 1 ? "" : "s"}.` };
}

export async function bulkArchiveLeadsAction(
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("leads:edit");
  if ("error" in g) return g.error;
  const { ctx } = g;

  const parsed = idsSchema.safeParse({ ids: formValue(formData, "ids") });
  if (!parsed.success) return { error: "Select at least one row." };

  const { count } = await prisma.lead.updateMany({
    where: { id: { in: parsed.data.ids }, orgId: ctx.org.id },
    data: { archived: true },
  });
  await recordAudit({
    action: "lead.bulk_archive",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    metadata: { count },
  });

  revalidatePath("/leads");
  return { ok: true, message: `${count} lead${count === 1 ? "" : "s"} archived.` };
}
