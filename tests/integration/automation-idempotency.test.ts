import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb, createTestOrg, createLead } from "./helpers";
import { runAutomation, onDealStageChanged } from "@/lib/automation/engine";

describe("automation engine idempotency", () => {
  beforeAll(resetDb);

  it("fires once per matching lead, and a second run does nothing (dedupe key locks it)", async () => {
    const { org } = await createTestOrg();
    await prisma.reminderRule.create({
      data: {
        orgId: org.id,
        name: "Chase stale leads",
        trigger: "LEAD_CREATED_NO_FOLLOWUP",
        action: "CREATE_TASK",
        enabled: true,
        config: { delayMinutes: 0, taskTitle: "Follow up" },
      },
    });
    await createLead(org.id);
    await createLead(org.id);

    const first = await runAutomation(org.id);
    expect(first.done).toBe(2);
    expect(first.skipped).toBe(0);

    const tasksAfterFirst = await prisma.task.count({ where: { orgId: org.id } });
    expect(tasksAfterFirst).toBe(2);

    const second = await runAutomation(org.id);
    expect(second.done).toBe(0);
    expect(second.skipped).toBe(2);

    // No duplicate tasks were created by the second run.
    const tasksAfterSecond = await prisma.task.count({ where: { orgId: org.id } });
    expect(tasksAfterSecond).toBe(2);

    const executions = await prisma.reminderExecution.count({ where: { orgId: org.id } });
    expect(executions).toBe(2); // one row per lead, not one per run
  });

  it("a disabled rule never fires", async () => {
    const { org } = await createTestOrg();
    await prisma.reminderRule.create({
      data: {
        orgId: org.id,
        name: "Disabled rule",
        trigger: "LEAD_CREATED_NO_FOLLOWUP",
        action: "CREATE_TASK",
        enabled: false,
        config: { delayMinutes: 0 },
      },
    });
    await createLead(org.id);

    const summary = await runAutomation(org.id);
    expect(summary.rulesEvaluated).toBe(0);
    expect(await prisma.task.count({ where: { orgId: org.id } })).toBe(0);
  });

  it("onDealStageChanged is idempotent for the same (deal, stage) pair", async () => {
    const { org, user } = await createTestOrg();
    await prisma.reminderRule.create({
      data: {
        orgId: org.id,
        name: "Next step",
        trigger: "DEAL_STAGE_CHANGED",
        action: "CREATE_TASK",
        enabled: true,
        config: { taskTitle: "Plan next step" },
      },
    });
    const pipeline = await prisma.pipeline.create({ data: { orgId: org.id, name: "P", isDefault: true } });
    const stage = await prisma.pipelineStage.create({
      data: { orgId: org.id, pipelineId: pipeline.id, name: "Discovery", position: 0, probability: 20 },
    });
    const deal = await prisma.deal.create({
      data: { orgId: org.id, name: "Deal", pipelineId: pipeline.id, stageId: stage.id, ownerId: user.id },
    });

    const fire = () =>
      onDealStageChanged({
        orgId: org.id,
        dealId: deal.id,
        dealName: deal.name,
        toStageId: stage.id,
        toStageName: stage.name,
        ownerId: user.id,
      });

    await fire();
    await fire();

    const tasks = await prisma.task.count({ where: { orgId: org.id, dealId: deal.id } });
    expect(tasks).toBe(1);
  });
});
