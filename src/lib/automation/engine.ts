import { Prisma, type ReminderRule } from "@prisma/client";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { notify, notifyMany } from "./notify";
import { ruleConfigSchema, type RuleConfig } from "./rules";

type Candidate = {
  dedupeKey: string;
  targetType: string;
  targetId: string;
  entityLabel: string;
  url: string;
  ownerId?: string | null;
  assigneeId?: string | null;
  leadId?: string;
  dealId?: string;
  quotationLinkId?: string;
};

function cfg(rule: ReminderRule): RuleConfig {
  const parsed = ruleConfigSchema.safeParse(rule.config);
  return parsed.success ? parsed.data : {};
}

/* ------------------------------------------------------------- actions ---- */

async function performAction(
  rule: ReminderRule,
  cand: Candidate,
): Promise<{ resultTaskId?: string }> {
  const c = cfg(rule);

  if (rule.action === "CREATE_TASK") {
    const assigneeId = cand.assigneeId ?? cand.ownerId ?? null;
    const task = await prisma.task.create({
      data: {
        orgId: rule.orgId,
        title: c.taskTitle || rule.name,
        description: `Created by automation rule “${rule.name}”.`,
        priority: (c.taskPriority ?? "MEDIUM") as Prisma.TaskCreateInput["priority"],
        status: "TODO",
        dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        assigneeId,
        leadId: cand.leadId ?? null,
        dealId: cand.dealId ?? null,
      },
    });
    if (assigneeId) {
      await notify({
        orgId: rule.orgId,
        userId: assigneeId,
        type: "AUTOMATION_FOLLOWUP",
        title: `Follow-up: ${task.title}`,
        body: `About ${cand.entityLabel}`,
        url: cand.url,
        entityType: "Task",
        entityId: task.id,
      });
    }
    return { resultTaskId: task.id };
  }

  if (rule.action === "NOTIFY_OWNER" && cand.ownerId) {
    await notify({
      orgId: rule.orgId,
      userId: cand.ownerId,
      type:
        rule.trigger === "DEAL_CLOSE_APPROACHING"
          ? "CLOSE_APPROACHING"
          : rule.trigger === "DEAL_STAGE_CHANGED"
            ? "STAGE_CHANGE"
            : "AUTOMATION_FOLLOWUP",
      title: `${rule.name}: ${cand.entityLabel}`,
      url: cand.url,
      entityType: cand.targetType,
      entityId: cand.targetId,
      dedupe: true,
    });
    return {};
  }

  if (rule.action === "NOTIFY_ASSIGNEE" && cand.assigneeId) {
    await notify({
      orgId: rule.orgId,
      userId: cand.assigneeId,
      type: rule.trigger === "TASK_OVERDUE" ? "TASK_OVERDUE" : "AUTOMATION_FOLLOWUP",
      title: `${rule.name}: ${cand.entityLabel}`,
      url: cand.url,
      entityType: cand.targetType,
      entityId: cand.targetId,
      dedupe: true,
    });
    return {};
  }

  if (rule.action === "NOTIFY_MANAGERS") {
    const managers = await prisma.membership.findMany({
      where: { orgId: rule.orgId, status: "ACTIVE", role: { in: ["OWNER", "ADMIN", "MANAGER"] } },
      select: { userId: true },
    });
    await notifyMany(managers.map((m) => m.userId), {
      orgId: rule.orgId,
      type: "AUTOMATION_FOLLOWUP",
      title: `${rule.name}: ${cand.entityLabel}`,
      url: cand.url,
      entityType: cand.targetType,
      entityId: cand.targetId,
    });
    return {};
  }

  // Action not applicable to this candidate (e.g. no owner).
  throw new Error("Action target unavailable for this record.");
}

/**
 * Fire a rule for one candidate. The ReminderExecution row is the lock: if it
 * already exists the candidate is skipped (idempotent). Failures are stored.
 */
async function fireRule(rule: ReminderRule, cand: Candidate): Promise<"done" | "skipped" | "failed"> {
  try {
    await prisma.reminderExecution.create({
      data: {
        orgId: rule.orgId,
        ruleId: rule.id,
        dedupeKey: cand.dedupeKey,
        status: "SKIPPED", // provisional; updated below
        targetType: cand.targetType,
        targetId: cand.targetId,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return "skipped";
    }
    throw e;
  }

  try {
    const { resultTaskId } = await performAction(rule, cand);
    await prisma.reminderExecution.update({
      where: { ruleId_dedupeKey: { ruleId: rule.id, dedupeKey: cand.dedupeKey } },
      data: { status: "DONE", resultTaskId, error: null },
    });
    return "done";
  } catch (err) {
    await prisma.reminderExecution.update({
      where: { ruleId_dedupeKey: { ruleId: rule.id, dedupeKey: cand.dedupeKey } },
      data: { status: "FAILED", error: (err as Error).message },
    });
    return "failed";
  }
}

/* --------------------------------------------------------- evaluators ----- */

async function candidatesFor(rule: ReminderRule): Promise<Candidate[]> {
  const c = cfg(rule);
  const now = Date.now();

  if (rule.trigger === "LEAD_CREATED_NO_FOLLOWUP") {
    const cutoff = new Date(now - (c.delayMinutes ?? 1440) * 60_000);
    const leads = await prisma.lead.findMany({
      where: {
        orgId: rule.orgId,
        archived: false,
        convertedAt: null,
        nextFollowUpAt: null,
        createdAt: { lte: cutoff },
      },
      take: 200,
      select: { id: true, name: true, ownerId: true },
    });
    return leads.map((l) => ({
      dedupeKey: `lead:${l.id}`,
      targetType: "Lead",
      targetId: l.id,
      entityLabel: l.name,
      url: `/leads/${l.id}`,
      ownerId: l.ownerId,
      leadId: l.id,
    }));
  }

  if (rule.trigger === "QUOTATION_SENT_NO_RESPONSE") {
    const cutoff = new Date(now - (c.delayMinutes ?? 4320) * 60_000);
    const quotes = await prisma.quotationLink.findMany({
      where: { orgId: rule.orgId, status: "SENT", createdAt: { lte: cutoff } },
      take: 200,
      include: { deal: { select: { id: true, name: true, ownerId: true } } },
    });
    return quotes.map((q) => ({
      dedupeKey: `quote:${q.id}`,
      targetType: "QuotationLink",
      targetId: q.id,
      entityLabel: q.number ?? "quotation",
      url: q.deal ? `/deals/${q.deal.id}` : "/quotations",
      ownerId: q.deal?.ownerId ?? null,
      dealId: q.deal?.id,
      quotationLinkId: q.id,
    }));
  }

  if (rule.trigger === "DEAL_CLOSE_APPROACHING") {
    const within = new Date(now + (c.withinDays ?? 7) * 24 * 60 * 60 * 1000);
    const deals = await prisma.deal.findMany({
      where: {
        orgId: rule.orgId,
        archived: false,
        status: "OPEN",
        expectedCloseDate: { gte: new Date(), lte: within },
      },
      take: 200,
      select: { id: true, name: true, ownerId: true, expectedCloseDate: true },
    });
    return deals.map((d) => ({
      dedupeKey: `deal-close:${d.id}:${d.expectedCloseDate!.toISOString().slice(0, 10)}`,
      targetType: "Deal",
      targetId: d.id,
      entityLabel: d.name,
      url: `/deals/${d.id}`,
      ownerId: d.ownerId,
      dealId: d.id,
    }));
  }

  if (rule.trigger === "TASK_OVERDUE") {
    const tasks = await prisma.task.findMany({
      where: {
        orgId: rule.orgId,
        status: { in: ["TODO", "IN_PROGRESS"] },
        dueAt: { lt: new Date() },
      },
      take: 200,
      select: { id: true, title: true, assigneeId: true, dueAt: true },
    });
    return tasks.map((t) => ({
      dedupeKey: `task-overdue:${t.id}:${t.dueAt!.toISOString().slice(0, 10)}`,
      targetType: "Task",
      targetId: t.id,
      entityLabel: t.title,
      url: `/tasks`,
      assigneeId: t.assigneeId,
    }));
  }

  return []; // DEAL_STAGE_CHANGED is event-driven (see onDealStageChanged)
}

/* ------------------------------------------------------------- runner ----- */

export type RunSummary = {
  rulesEvaluated: number;
  done: number;
  skipped: number;
  failed: number;
};

export async function runAutomation(orgId?: string): Promise<RunSummary> {
  const rules = await prisma.reminderRule.findMany({
    where: { enabled: true, trigger: { not: "DEAL_STAGE_CHANGED" }, ...(orgId ? { orgId } : {}) },
  });

  const summary: RunSummary = { rulesEvaluated: rules.length, done: 0, skipped: 0, failed: 0 };

  for (const rule of rules) {
    let candidates: Candidate[] = [];
    try {
      candidates = await candidatesFor(rule);
    } catch (err) {
      console.error(`[automation] rule ${rule.id} evaluation failed`, err);
      continue;
    }
    for (const cand of candidates) {
      const outcome = await fireRule(rule, cand);
      summary[outcome === "done" ? "done" : outcome === "failed" ? "failed" : "skipped"]++;
    }
  }

  if (summary.done > 0 || summary.failed > 0) {
    await recordAudit({
      action: "automation.run",
      orgId: orgId ?? null,
      metadata: { ...summary },
    });
  }
  return summary;
}

/** Event hook: called when a deal moves to a new stage. */
export async function onDealStageChanged(input: {
  orgId: string;
  dealId: string;
  dealName: string;
  toStageId: string;
  toStageName: string;
  ownerId: string | null;
}): Promise<void> {
  const rules = await prisma.reminderRule.findMany({
    where: { orgId: input.orgId, enabled: true, trigger: "DEAL_STAGE_CHANGED" },
  });
  for (const rule of rules) {
    await fireRule(rule, {
      dedupeKey: `stage:${input.dealId}:${input.toStageId}`,
      targetType: "Deal",
      targetId: input.dealId,
      entityLabel: `${input.dealName} → ${input.toStageName}`,
      url: `/deals/${input.dealId}`,
      ownerId: input.ownerId,
      dealId: input.dealId,
    });
  }
}

/** Re-run a single failed execution (from the settings UI). */
export async function retryExecution(orgId: string, executionId: string): Promise<"done" | "failed" | "missing"> {
  const exec = await prisma.reminderExecution.findFirst({
    where: { id: executionId, orgId, status: "FAILED" },
    include: { rule: true },
  });
  if (!exec || !exec.targetId) return "missing";

  // Rebuild a minimal candidate from the target.
  const cands = await candidatesFor(exec.rule);
  const cand = cands.find((c) => c.dedupeKey === exec.dedupeKey);
  if (!cand) {
    await prisma.reminderExecution.update({
      where: { id: exec.id },
      data: { status: "SKIPPED", error: "Target no longer matches the rule." },
    });
    return "failed";
  }

  try {
    const { resultTaskId } = await performAction(exec.rule, cand);
    await prisma.reminderExecution.update({
      where: { id: exec.id },
      data: { status: "DONE", resultTaskId, error: null },
    });
    return "done";
  } catch (err) {
    await prisma.reminderExecution.update({
      where: { id: exec.id },
      data: { status: "FAILED", error: (err as Error).message },
    });
    return "failed";
  }
}
