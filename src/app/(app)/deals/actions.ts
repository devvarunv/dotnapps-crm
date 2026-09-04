"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { isRedirectError } from "@/lib/next";
import { fieldErrors, formValue, type ActionState } from "@/lib/form";
import { guard, planLimitError } from "@/lib/crm/guard";
import {
  dealSchema,
  changeStageSchema,
  winLoseSchema,
} from "@/lib/crm/validation";
import {
  resolveOwnerId,
  resolveTagIds,
  parseTagNames,
  assertCompanyInOrg,
} from "@/lib/crm/service";
import { dealFieldsForStage, logActivity } from "@/lib/crm/sales";
import { notifyAssignment } from "@/lib/automation/notify";
import { onDealStageChanged } from "@/lib/automation/engine";

async function loadStage(orgId: string, pipelineId: string, stageId: string) {
  return prisma.pipelineStage.findFirst({
    where: { id: stageId, pipelineId, orgId },
  });
}

export async function createDealAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("deals:create");
  if ("error" in g) return g.error;
  const { ctx } = g;

  const limit = await planLimitError(ctx.org.id, "deals");
  if (limit) return limit;

  const parsed = dealSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;

  const stage = await loadStage(ctx.org.id, d.pipelineId, d.stageId);
  if (!stage) return { fieldErrors: { stageId: "That stage is not in the pipeline." } };

  let ownerId: string | null;
  let companyId: string | null;
  let contactId: string | null = null;
  try {
    ownerId = await resolveOwnerId(ctx.org.id, d.ownerId);
    companyId = await assertCompanyInOrg(ctx.org.id, d.companyId);
    if (d.contactId) {
      const c = await prisma.contact.findFirst({
        where: { id: d.contactId, orgId: ctx.org.id },
        select: { id: true },
      });
      if (!c) return { fieldErrors: { contactId: "Contact not found." } };
      contactId = c.id;
    }
  } catch (e) {
    return { error: (e as Error).message };
  }

  const tagNames = parseTagNames(formValue(formData, "tags"));

  const deal = await prisma.$transaction(async (tx) => {
    const created = await tx.deal.create({
      data: {
        orgId: ctx.org.id,
        name: d.name,
        pipelineId: d.pipelineId,
        stageId: d.stageId,
        ...dealFieldsForStage(stage),
        companyId,
        contactId,
        ownerId,
        source: (d.source ?? null) as Prisma.DealCreateInput["source"],
        value: d.value !== undefined ? new Prisma.Decimal(d.value) : null,
        currency: d.currency || "USD",
        expectedCloseDate: d.expectedCloseDate ? new Date(d.expectedCloseDate) : null,
        tags: { connect: await resolveTagIds(tx, ctx.org.id, tagNames) },
      },
    });
    await logActivity(tx, {
      orgId: ctx.org.id,
      type: "NOTE",
      source: "SYSTEM",
      subject: `Deal created in stage “${stage.name}”`,
      createdById: ctx.user.id,
      dealId: created.id,
    });
    if (d.notesText) {
      await logActivity(tx, {
        orgId: ctx.org.id,
        type: "NOTE",
        body: d.notesText,
        createdById: ctx.user.id,
        dealId: created.id,
      });
    }
    return created;
  });

  await recordAudit({
    action: "deal.create",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    targetType: "Deal",
    targetId: deal.id,
    metadata: { name: deal.name },
  });
  await notifyAssignment({
    orgId: ctx.org.id,
    assigneeId: ownerId,
    actorId: ctx.user.id,
    title: `Deal assigned to you: ${deal.name}`,
    url: `/deals/${deal.id}`,
    entityType: "Deal",
    entityId: deal.id,
  });

  revalidatePath("/deals");
  revalidatePath("/pipeline");
  redirect(`/deals/${deal.id}`);
}

export async function updateDealAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("deals:edit");
  if ("error" in g) return g.error;
  const { ctx } = g;

  const id = formValue(formData, "id");
  const existing = await prisma.deal.findFirst({
    where: { id, orgId: ctx.org.id },
    include: { stage: true },
  });
  if (!existing) return { error: "That deal no longer exists." };

  const parsed = dealSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;

  const stage = await loadStage(ctx.org.id, d.pipelineId, d.stageId);
  if (!stage) return { fieldErrors: { stageId: "That stage is not in the pipeline." } };

  let ownerId: string | null;
  let companyId: string | null;
  let contactId: string | null = null;
  try {
    ownerId = await resolveOwnerId(ctx.org.id, d.ownerId);
    companyId = await assertCompanyInOrg(ctx.org.id, d.companyId);
    if (d.contactId) {
      const c = await prisma.contact.findFirst({
        where: { id: d.contactId, orgId: ctx.org.id },
        select: { id: true },
      });
      if (!c) return { fieldErrors: { contactId: "Contact not found." } };
      contactId = c.id;
    }
  } catch (e) {
    return { error: (e as Error).message };
  }

  const tagNames = parseTagNames(formValue(formData, "tags"));
  const stageChanged = existing.stageId !== d.stageId;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.deal.update({
        where: { id },
        data: {
          name: d.name,
          pipelineId: d.pipelineId,
          stageId: d.stageId,
          ...(stageChanged ? dealFieldsForStage(stage) : {}),
          companyId,
          contactId,
          ownerId,
          source: (d.source ?? null) as Prisma.DealUpdateInput["source"],
          value: d.value !== undefined ? new Prisma.Decimal(d.value) : null,
          currency: d.currency || "USD",
          expectedCloseDate: d.expectedCloseDate ? new Date(d.expectedCloseDate) : null,
          tags: { set: await resolveTagIds(tx, ctx.org.id, tagNames) },
        },
      });
      if (stageChanged) {
        await logActivity(tx, {
          orgId: ctx.org.id,
          type: "NOTE",
          source: "SYSTEM",
          subject: `Stage: ${existing.stage.name} → ${stage.name}`,
          createdById: ctx.user.id,
          dealId: id,
        });
      }
    });
  } catch (e) {
    if (isRedirectError(e)) throw e;
    return { error: "Could not save changes." };
  }

  await recordAudit({
    action: "deal.update",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    targetType: "Deal",
    targetId: id,
  });
  if (ownerId && ownerId !== existing.ownerId) {
    await notifyAssignment({
      orgId: ctx.org.id,
      assigneeId: ownerId,
      actorId: ctx.user.id,
      title: `Deal assigned to you: ${d.name}`,
      url: `/deals/${id}`,
      entityType: "Deal",
      entityId: id,
    });
  }
  if (stageChanged) {
    await onDealStageChanged({
      orgId: ctx.org.id,
      dealId: id,
      dealName: d.name,
      toStageId: stage.id,
      toStageName: stage.name,
      ownerId: ownerId ?? existing.ownerId,
    });
  }

  revalidatePath(`/deals/${id}`);
  revalidatePath("/deals");
  revalidatePath("/pipeline");
  redirect(`/deals/${id}`);
}

export async function changeDealStageAction(
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("deals:edit");
  if ("error" in g) return g.error;
  const { ctx } = g;

  const parsed = changeStageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };

  const deal = await prisma.deal.findFirst({
    where: { id: parsed.data.dealId, orgId: ctx.org.id },
    include: { stage: true },
  });
  if (!deal) return { error: "That deal no longer exists." };

  const stage = await loadStage(ctx.org.id, deal.pipelineId, parsed.data.stageId);
  if (!stage) return { error: "That stage is not in this deal's pipeline." };
  if (stage.id === deal.stageId) return { ok: true };

  await prisma.$transaction(async (tx) => {
    await tx.deal.update({
      where: { id: deal.id },
      data: { stageId: stage.id, ...dealFieldsForStage(stage) },
    });
    await logActivity(tx, {
      orgId: ctx.org.id,
      type: "NOTE",
      source: "SYSTEM",
      subject: `Stage: ${deal.stage.name} → ${stage.name}`,
      createdById: ctx.user.id,
      dealId: deal.id,
    });
  });

  await recordAudit({
    action: "deal.stage_change",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    targetType: "Deal",
    targetId: deal.id,
    metadata: { from: deal.stage.name, to: stage.name },
  });
  await onDealStageChanged({
    orgId: ctx.org.id,
    dealId: deal.id,
    dealName: deal.name,
    toStageId: stage.id,
    toStageName: stage.name,
    ownerId: deal.ownerId,
  });

  revalidatePath("/pipeline");
  revalidatePath("/deals");
  revalidatePath(`/deals/${deal.id}`);
  return { ok: true, message: `Moved to ${stage.name}.` };
}

export async function winLoseDealAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("deals:edit");
  if ("error" in g) return g.error;
  const { ctx } = g;

  const parsed = winLoseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };
  const { dealId, outcome, reason } = parsed.data;

  const deal = await prisma.deal.findFirst({
    where: { id: dealId, orgId: ctx.org.id },
    include: { pipeline: { include: { stages: true } }, stage: true },
  });
  if (!deal) return { error: "That deal no longer exists." };

  // Prefer a terminal stage of the matching kind if the pipeline has one.
  const targetStage =
    deal.pipeline.stages.find((s) => s.kind === outcome) ?? deal.stage;

  await prisma.$transaction(async (tx) => {
    await tx.deal.update({
      where: { id: deal.id },
      data: {
        stageId: targetStage.id,
        status: outcome,
        probability: outcome === "WON" ? 100 : 0,
        closedAt: new Date(),
        winReason: outcome === "WON" ? reason ?? null : null,
        lossReason: outcome === "LOST" ? reason ?? null : null,
      },
    });
    await logActivity(tx, {
      orgId: ctx.org.id,
      type: "NOTE",
      source: "SYSTEM",
      subject: outcome === "WON" ? "Deal won" : "Deal lost",
      body: reason ?? null,
      createdById: ctx.user.id,
      dealId: deal.id,
    });
  });

  await recordAudit({
    action: outcome === "WON" ? "deal.won" : "deal.lost",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    targetType: "Deal",
    targetId: deal.id,
    metadata: { reason },
  });

  revalidatePath("/pipeline");
  revalidatePath("/deals");
  revalidatePath(`/deals/${deal.id}`);
  return { ok: true, message: outcome === "WON" ? "Marked won." : "Marked lost." };
}

export async function setDealArchivedAction(formData: FormData): Promise<void> {
  const g = await guard("deals:edit");
  if ("error" in g) return;
  const { ctx } = g;

  const id = String(formData.get("id") ?? "");
  const archived = String(formData.get("archived") ?? "") === "true";
  const existing = await prisma.deal.findFirst({
    where: { id, orgId: ctx.org.id },
    select: { id: true },
  });
  if (!existing) return;

  await prisma.deal.update({ where: { id }, data: { archived } });
  await recordAudit({
    action: archived ? "deal.archive" : "deal.unarchive",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    targetType: "Deal",
    targetId: id,
  });
  revalidatePath("/deals");
  revalidatePath("/pipeline");
  revalidatePath(`/deals/${id}`);
}
