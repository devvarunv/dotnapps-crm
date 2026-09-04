"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { fieldErrors, formValue, type ActionState } from "@/lib/form";
import { guard } from "@/lib/crm/guard";
import { pipelineSchema, stageSchema, reorderStageSchema } from "@/lib/crm/validation";

function bump() {
  revalidatePath("/settings/pipelines");
  revalidatePath("/pipeline");
  revalidatePath("/deals");
}

export async function createPipelineAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("org:manage");
  if ("error" in g) return g.error;
  const { ctx } = g;

  const parsed = pipelineSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const count = await prisma.pipeline.count({ where: { orgId: ctx.org.id } });

  await prisma.$transaction(async (tx) => {
    if (parsed.data.isDefault) {
      await tx.pipeline.updateMany({
        where: { orgId: ctx.org.id },
        data: { isDefault: false },
      });
    }
    const pipeline = await tx.pipeline.create({
      data: {
        orgId: ctx.org.id,
        name: parsed.data.name,
        position: count,
        isDefault: parsed.data.isDefault || count === 0,
      },
    });
    // Seed a sensible default set of stages.
    const defaults: [string, number, "OPEN" | "WON" | "LOST"][] = [
      ["Qualified", 10, "OPEN"],
      ["Discovery", 30, "OPEN"],
      ["Proposal", 60, "OPEN"],
      ["Negotiation", 80, "OPEN"],
      ["Won", 100, "WON"],
      ["Lost", 0, "LOST"],
    ];
    await tx.pipelineStage.createMany({
      data: defaults.map(([name, probability, kind], i) => ({
        orgId: ctx.org.id,
        pipelineId: pipeline.id,
        name,
        probability,
        kind,
        position: i,
      })),
    });
  });

  await recordAudit({
    action: "pipeline.create",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    metadata: { name: parsed.data.name },
  });
  bump();
  return { ok: true, message: "Pipeline created with default stages." };
}

export async function renamePipelineAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("org:manage");
  if ("error" in g) return g.error;
  const { ctx } = g;

  const id = formValue(formData, "id");
  const parsed = pipelineSchema.pick({ name: true }).safeParse({
    name: formValue(formData, "name"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const owned = await prisma.pipeline.findFirst({
    where: { id, orgId: ctx.org.id },
    select: { id: true },
  });
  if (!owned) return { error: "Pipeline not found." };

  await prisma.pipeline.update({ where: { id }, data: { name: parsed.data.name } });
  bump();
  return { ok: true, message: "Renamed." };
}

export async function setDefaultPipelineAction(formData: FormData): Promise<void> {
  const g = await guard("org:manage");
  if ("error" in g) return;
  const { ctx } = g;

  const id = String(formData.get("id") ?? "");
  const owned = await prisma.pipeline.findFirst({
    where: { id, orgId: ctx.org.id },
    select: { id: true },
  });
  if (!owned) return;

  await prisma.$transaction([
    prisma.pipeline.updateMany({ where: { orgId: ctx.org.id }, data: { isDefault: false } }),
    prisma.pipeline.update({ where: { id }, data: { isDefault: true, archived: false } }),
  ]);
  bump();
}

export async function archivePipelineAction(formData: FormData): Promise<void> {
  const g = await guard("org:manage");
  if ("error" in g) return;
  const { ctx } = g;

  const id = String(formData.get("id") ?? "");
  const archived = String(formData.get("archived") ?? "") === "true";
  const pipeline = await prisma.pipeline.findFirst({
    where: { id, orgId: ctx.org.id },
    select: { id: true, isDefault: true },
  });
  if (!pipeline) return;
  if (archived && pipeline.isDefault) return; // can't archive the default

  await prisma.pipeline.update({ where: { id }, data: { archived } });
  bump();
}

export async function addStageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("org:manage");
  if ("error" in g) return g.error;
  const { ctx } = g;

  const parsed = stageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const pipeline = await prisma.pipeline.findFirst({
    where: { id: parsed.data.pipelineId, orgId: ctx.org.id },
    select: { id: true },
  });
  if (!pipeline) return { error: "Pipeline not found." };

  const last = await prisma.pipelineStage.aggregate({
    where: { pipelineId: pipeline.id },
    _max: { position: true },
  });

  await prisma.pipelineStage.create({
    data: {
      orgId: ctx.org.id,
      pipelineId: pipeline.id,
      name: parsed.data.name,
      probability: parsed.data.probability,
      kind: parsed.data.kind as Prisma.PipelineStageCreateInput["kind"],
      position: (last._max.position ?? -1) + 1,
    },
  });
  bump();
  return { ok: true, message: "Stage added." };
}

export async function updateStageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("org:manage");
  if ("error" in g) return g.error;
  const { ctx } = g;

  const stageId = formValue(formData, "stageId");
  const parsed = stageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const stage = await prisma.pipelineStage.findFirst({
    where: { id: stageId, orgId: ctx.org.id },
    select: { id: true },
  });
  if (!stage) return { error: "Stage not found." };

  await prisma.pipelineStage.update({
    where: { id: stageId },
    data: {
      name: parsed.data.name,
      probability: parsed.data.probability,
      kind: parsed.data.kind as Prisma.PipelineStageUpdateInput["kind"],
    },
  });
  bump();
  return { ok: true, message: "Stage saved." };
}

export async function deleteStageAction(formData: FormData): Promise<void> {
  const g = await guard("org:manage");
  if ("error" in g) return;
  const { ctx } = g;

  const stageId = String(formData.get("stageId") ?? "");
  const stage = await prisma.pipelineStage.findFirst({
    where: { id: stageId, orgId: ctx.org.id },
    include: { pipeline: { include: { stages: { orderBy: { position: "asc" } } } }, _count: { select: { deals: true } } },
  });
  if (!stage) return;
  if (stage.pipeline.stages.length <= 1) return; // keep at least one
  if (stage._count.deals > 0) {
    // Move deals to an adjacent stage first.
    const fallback = stage.pipeline.stages.find((s) => s.id !== stage.id)!;
    await prisma.deal.updateMany({
      where: { stageId: stage.id },
      data: { stageId: fallback.id },
    });
  }
  await prisma.pipelineStage.delete({ where: { id: stageId } });
  bump();
}

export async function reorderStageAction(formData: FormData): Promise<void> {
  const g = await guard("org:manage");
  if ("error" in g) return;
  const { ctx } = g;

  const parsed = reorderStageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  const stage = await prisma.pipelineStage.findFirst({
    where: { id: parsed.data.stageId, orgId: ctx.org.id },
  });
  if (!stage) return;

  const sibling = await prisma.pipelineStage.findFirst({
    where: {
      pipelineId: stage.pipelineId,
      position: parsed.data.direction === "up" ? { lt: stage.position } : { gt: stage.position },
    },
    orderBy: { position: parsed.data.direction === "up" ? "desc" : "asc" },
  });
  if (!sibling) return;

  await prisma.$transaction([
    prisma.pipelineStage.update({ where: { id: stage.id }, data: { position: sibling.position } }),
    prisma.pipelineStage.update({ where: { id: sibling.id }, data: { position: stage.position } }),
  ]);
  bump();
}
