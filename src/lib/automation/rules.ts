import { z } from "zod";
import type { RuleTrigger, RuleAction } from "@prisma/client";
import { TASK_PRIORITIES } from "@/lib/crm/labels";

export const RULE_TRIGGER_LABELS: Record<RuleTrigger, string> = {
  LEAD_CREATED_NO_FOLLOWUP: "New lead with no follow-up",
  QUOTATION_SENT_NO_RESPONSE: "Quotation sent, no response",
  DEAL_CLOSE_APPROACHING: "Deal close date approaching",
  TASK_OVERDUE: "Task overdue",
  DEAL_STAGE_CHANGED: "Deal stage changed",
};

export const RULE_TRIGGERS = Object.keys(RULE_TRIGGER_LABELS) as RuleTrigger[];

export const RULE_ACTION_LABELS: Record<RuleAction, string> = {
  CREATE_TASK: "Create a follow-up task",
  NOTIFY_OWNER: "Notify the record owner",
  NOTIFY_ASSIGNEE: "Notify the assignee",
  NOTIFY_MANAGERS: "Notify managers & owners",
};

export const RULE_ACTIONS = Object.keys(RULE_ACTION_LABELS) as RuleAction[];

/** Which actions make sense for each trigger (first is the default). */
export const TRIGGER_ACTIONS: Record<RuleTrigger, RuleAction[]> = {
  LEAD_CREATED_NO_FOLLOWUP: ["CREATE_TASK", "NOTIFY_OWNER"],
  QUOTATION_SENT_NO_RESPONSE: ["CREATE_TASK", "NOTIFY_OWNER"],
  DEAL_CLOSE_APPROACHING: ["NOTIFY_OWNER", "CREATE_TASK", "NOTIFY_MANAGERS"],
  TASK_OVERDUE: ["NOTIFY_ASSIGNEE", "NOTIFY_MANAGERS"],
  DEAL_STAGE_CHANGED: ["CREATE_TASK", "NOTIFY_OWNER"],
};

export const TRIGGER_HINT: Record<RuleTrigger, string> = {
  LEAD_CREATED_NO_FOLLOWUP:
    "Fires when a non-archived lead is older than the delay and has no next follow-up date.",
  QUOTATION_SENT_NO_RESPONSE:
    "Fires when a quotation has been in 'sent' status longer than the delay.",
  DEAL_CLOSE_APPROACHING:
    "Fires when an open deal's expected close date is within the window.",
  TASK_OVERDUE: "Fires when a task is past its due date and not done.",
  DEAL_STAGE_CHANGED: "Fires immediately when a deal moves to a new stage.",
};

export const ruleConfigSchema = z.object({
  delayMinutes: z.coerce.number().int().min(0).max(60 * 24 * 90).optional(),
  withinDays: z.coerce.number().int().min(1).max(365).optional(),
  taskTitle: z.string().trim().max(200).optional(),
  taskPriority: z.enum(TASK_PRIORITIES as [string, ...string[]]).optional(),
  notifyManagers: z.boolean().optional(),
});

export type RuleConfig = z.infer<typeof ruleConfigSchema>;

export function defaultConfigFor(trigger: RuleTrigger): RuleConfig {
  switch (trigger) {
    case "LEAD_CREATED_NO_FOLLOWUP":
      return { delayMinutes: 60 * 24, taskTitle: "Follow up with new lead", taskPriority: "MEDIUM" };
    case "QUOTATION_SENT_NO_RESPONSE":
      return { delayMinutes: 60 * 24 * 3, taskTitle: "Chase quotation response", taskPriority: "HIGH" };
    case "DEAL_CLOSE_APPROACHING":
      return { withinDays: 7 };
    case "TASK_OVERDUE":
      return {};
    case "DEAL_STAGE_CHANGED":
      return { taskTitle: "Plan next step", taskPriority: "MEDIUM" };
  }
}
