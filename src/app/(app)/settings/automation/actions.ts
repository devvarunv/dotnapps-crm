"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { fieldErrors, formValue, type ActionState } from "@/lib/form";
import { guard } from "@/lib/crm/guard";
import { runAutomation, retryExecution } from "@/lib/automation/engine";
import {
  RULE_TRIGGERS,
  RULE_ACTIONS,
  ruleConfigSchema,
  defaultConfigFor,
} from "@/lib/automation/rules";

const ruleSchema = z.object({
  name: z.string().trim().min(2, "Name the rule").max(120),
  trigger: z.enum(RULE_TRIGGERS as [string, ...string[]]),
  action: z.enum(RULE_ACTIONS as [string, ...string[]]),
  delayMinutes: z.string().trim().optional(),
  withinDays: z.string().trim().optional(),
  taskTitle: z.string().trim().max(200).optional(),
  taskPriority: z.string().trim().optional(),
  notifyManagers: z.string().optional(),
});

function buildConfig(d: z.infer<typeof ruleSchema>) {
  const raw: Record<string, unknown> = {
    delayMinutes: d.delayMinutes || undefined,
    withinDays: d.withinDays || undefined,
    taskTitle: d.taskTitle || undefined,
    taskPriority: d.taskPriority || undefined,
    notifyManagers: d.notifyManagers === "on" || undefined,
  };
  const parsed = ruleConfigSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}

export async function createRuleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("org:manage");
  if ("error" in g) return g.error;
  const { ctx } = g;

  const parsed = ruleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;

  const config = { ...defaultConfigFor(d.trigger as never), ...buildConfig(d) };

  const rule = await prisma.reminderRule.create({
    data: {
      orgId: ctx.org.id,
      name: d.name,
      trigger: d.trigger as Prisma.ReminderRuleCreateInput["trigger"],
      action: d.action as Prisma.ReminderRuleCreateInput["action"],
      config: config as Prisma.InputJsonValue,
      createdById: ctx.user.id,
    },
  });
  await recordAudit({
    action: "automation.rule.create",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    targetType: "ReminderRule",
    targetId: rule.id,
    metadata: { name: d.name, trigger: d.trigger },
  });
  revalidatePath("/settings/automation");
  return { ok: true, message: "Rule created." };
}

export async function updateRuleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("org:manage");
  if ("error" in g) return g.error;
  const { ctx } = g;

  const id = formValue(formData, "id");
  const existing = await prisma.reminderRule.findFirst({ where: { id, orgId: ctx.org.id } });
  if (!existing) return { error: "That rule no longer exists." };

  const parsed = ruleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;

  await prisma.reminderRule.update({
    where: { id },
    data: {
      name: d.name,
      trigger: d.trigger as Prisma.ReminderRuleUpdateInput["trigger"],
      action: d.action as Prisma.ReminderRuleUpdateInput["action"],
      config: buildConfig(d) as Prisma.InputJsonValue,
    },
  });
  await recordAudit({
    action: "automation.rule.update",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    targetType: "ReminderRule",
    targetId: id,
  });
  revalidatePath("/settings/automation");
  return { ok: true, message: "Rule saved." };
}

export async function toggleRuleAction(formData: FormData): Promise<void> {
  const g = await guard("org:manage");
  if ("error" in g) return;
  const { ctx } = g;

  const id = String(formData.get("id") ?? "");
  const enabled = String(formData.get("enabled") ?? "") === "true";
  const rule = await prisma.reminderRule.findFirst({
    where: { id, orgId: ctx.org.id },
    select: { id: true },
  });
  if (!rule) return;

  await prisma.reminderRule.update({ where: { id }, data: { enabled } });
  await recordAudit({
    action: enabled ? "automation.rule.enable" : "automation.rule.disable",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    targetType: "ReminderRule",
    targetId: id,
  });
  revalidatePath("/settings/automation");
}

export async function deleteRuleAction(formData: FormData): Promise<void> {
  const g = await guard("org:manage");
  if ("error" in g) return;
  const { ctx } = g;

  const id = String(formData.get("id") ?? "");
  const rule = await prisma.reminderRule.findFirst({
    where: { id, orgId: ctx.org.id },
    select: { id: true, name: true },
  });
  if (!rule) return;

  await prisma.reminderRule.delete({ where: { id } });
  await recordAudit({
    action: "automation.rule.delete",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    metadata: { name: rule.name },
  });
  revalidatePath("/settings/automation");
}

export async function runAutomationNowAction(): Promise<ActionState> {
  const g = await guard("org:manage");
  if ("error" in g) return g.error;
  const { ctx } = g;

  const summary = await runAutomation(ctx.org.id);
  revalidatePath("/settings/automation");
  return {
    ok: true,
    message: `Evaluated ${summary.rulesEvaluated} rule(s): ${summary.done} action(s), ${summary.skipped} already handled, ${summary.failed} failed.`,
  };
}

export async function retryExecutionAction(formData: FormData): Promise<ActionState> {
  const g = await guard("org:manage");
  if ("error" in g) return g.error;
  const { ctx } = g;

  const id = formValue(formData, "id");
  const result = await retryExecution(ctx.org.id, id);
  revalidatePath("/settings/automation");
  if (result === "missing") return { error: "That execution can't be retried." };
  return result === "done"
    ? { ok: true, message: "Retried successfully." }
    : { error: "Retry failed again — see the error on the row." };
}
