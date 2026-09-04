"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { fieldErrors, formValue, type ActionState } from "@/lib/form";
import { guard } from "@/lib/crm/guard";
import { taskSchema, taskStatusSchema } from "@/lib/crm/validation";
import { resolveOwnerId, assertCompanyInOrg } from "@/lib/crm/service";
import { logActivity } from "@/lib/crm/sales";
import { notifyAssignment } from "@/lib/automation/notify";

const PARENTS = ["leadId", "contactId", "companyId", "dealId"] as const;

async function resolveParent(orgId: string, d: Record<string, unknown>) {
  const models = {
    leadId: prisma.lead,
    contactId: prisma.contact,
    companyId: prisma.company,
    dealId: prisma.deal,
  } as const;
  const out: Record<string, string | null> = {
    leadId: null,
    contactId: null,
    companyId: null,
    dealId: null,
  };
  for (const key of PARENTS) {
    const id = d[key] as string | undefined;
    if (!id) continue;
    const found = await (models[key] as { findFirst: (a: unknown) => Promise<unknown> }).findFirst({
      where: { id, orgId },
      select: { id: true },
    });
    if (!found) throw new Error("Linked record not found.");
    out[key] = id;
  }
  return out;
}

function revalidateParent(p: Record<string, string | null>) {
  if (p.dealId) revalidatePath(`/deals/${p.dealId}`);
  if (p.leadId) revalidatePath(`/leads/${p.leadId}`);
  if (p.contactId) revalidatePath(`/contacts/${p.contactId}`);
  if (p.companyId) revalidatePath(`/companies/${p.companyId}`);
  revalidatePath("/tasks");
}

export async function createTaskAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("tasks:create");
  if ("error" in g) return g.error;
  const { ctx } = g;

  const parsed = taskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;

  let assigneeId: string | null;
  let parents: Record<string, string | null>;
  try {
    assigneeId = await resolveOwnerId(ctx.org.id, d.assigneeId);
    await assertCompanyInOrg(ctx.org.id, d.companyId);
    parents = await resolveParent(ctx.org.id, d);
  } catch (e) {
    return { error: (e as Error).message };
  }

  const task = await prisma.task.create({
    data: {
      orgId: ctx.org.id,
      title: d.title,
      description: d.description ?? null,
      status: d.status as Prisma.TaskCreateInput["status"],
      priority: d.priority as Prisma.TaskCreateInput["priority"],
      dueAt: d.dueAt ? new Date(d.dueAt) : null,
      assigneeId,
      createdById: ctx.user.id,
      ...parents,
    },
  });

  await recordAudit({
    action: "task.create",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    targetType: "Task",
    targetId: task.id,
    metadata: { title: task.title },
  });
  await notifyAssignment({
    orgId: ctx.org.id,
    assigneeId,
    actorId: ctx.user.id,
    title: `New task: ${task.title}`,
    url: "/tasks",
    entityType: "Task",
    entityId: task.id,
  });

  revalidateParent(parents);
  return { ok: true, message: "Task created." };
}

export async function updateTaskAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("tasks:edit");
  if ("error" in g) return g.error;
  const { ctx } = g;

  const id = formValue(formData, "id");
  const existing = await prisma.task.findFirst({ where: { id, orgId: ctx.org.id } });
  if (!existing) return { error: "That task no longer exists." };

  const parsed = taskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;

  let assigneeId: string | null;
  try {
    assigneeId = await resolveOwnerId(ctx.org.id, d.assigneeId);
  } catch (e) {
    return { error: (e as Error).message };
  }

  const completing =
    d.status === "COMPLETED" && existing.status !== "COMPLETED";

  await prisma.task.update({
    where: { id },
    data: {
      title: d.title,
      description: d.description ?? null,
      status: d.status as Prisma.TaskUpdateInput["status"],
      priority: d.priority as Prisma.TaskUpdateInput["priority"],
      dueAt: d.dueAt ? new Date(d.dueAt) : null,
      assigneeId,
      completedAt:
        d.status === "COMPLETED" ? existing.completedAt ?? new Date() : null,
    },
  });

  if (completing && existing.dealId) {
    await prisma.$transaction((tx) =>
      logActivity(tx, {
        orgId: ctx.org.id,
        type: "TASK",
        source: "SYSTEM",
        subject: `Task completed: ${d.title}`,
        createdById: ctx.user.id,
        dealId: existing.dealId,
      }),
    );
  }

  await recordAudit({
    action: "task.update",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    targetType: "Task",
    targetId: id,
  });
  if (assigneeId && assigneeId !== existing.assigneeId) {
    await notifyAssignment({
      orgId: ctx.org.id,
      assigneeId,
      actorId: ctx.user.id,
      title: `Task assigned to you: ${d.title}`,
      url: "/tasks",
      entityType: "Task",
      entityId: id,
    });
  }

  revalidateParent({
    leadId: existing.leadId,
    contactId: existing.contactId,
    companyId: existing.companyId,
    dealId: existing.dealId,
  });
  return { ok: true, message: "Task saved." };
}

export async function setTaskStatusAction(formData: FormData): Promise<ActionState> {
  const g = await guard("tasks:edit");
  if ("error" in g) return g.error;
  const { ctx } = g;

  const parsed = taskStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };

  const task = await prisma.task.findFirst({
    where: { id: parsed.data.taskId, orgId: ctx.org.id },
  });
  if (!task) return { error: "That task no longer exists." };

  const completing =
    parsed.data.status === "COMPLETED" && task.status !== "COMPLETED";

  await prisma.task.update({
    where: { id: task.id },
    data: {
      status: parsed.data.status as Prisma.TaskUpdateInput["status"],
      completedAt: parsed.data.status === "COMPLETED" ? task.completedAt ?? new Date() : null,
    },
  });

  if (completing && task.dealId) {
    await prisma.$transaction((tx) =>
      logActivity(tx, {
        orgId: ctx.org.id,
        type: "TASK",
        source: "SYSTEM",
        subject: `Task completed: ${task.title}`,
        createdById: ctx.user.id,
        dealId: task.dealId,
      }),
    );
  }

  await recordAudit({
    action: "task.status",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    targetType: "Task",
    targetId: task.id,
    metadata: { status: parsed.data.status },
  });

  revalidateParent({
    leadId: task.leadId,
    contactId: task.contactId,
    companyId: task.companyId,
    dealId: task.dealId,
  });
  return { ok: true };
}

export async function deleteTaskAction(formData: FormData): Promise<void> {
  const g = await guard("tasks:edit");
  if ("error" in g) return;
  const { ctx } = g;

  const id = String(formData.get("id") ?? "");
  const task = await prisma.task.findFirst({
    where: { id, orgId: ctx.org.id },
  });
  if (!task) return;

  await prisma.task.delete({ where: { id } });
  await recordAudit({
    action: "task.delete",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    targetType: "Task",
    targetId: id,
  });
  revalidateParent({
    leadId: task.leadId,
    contactId: task.contactId,
    companyId: task.companyId,
    dealId: task.dealId,
  });
}
