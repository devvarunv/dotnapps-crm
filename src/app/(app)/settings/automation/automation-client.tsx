"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Trash2, Pencil, Play } from "lucide-react";
import type { RuleTrigger, RuleAction } from "@prisma/client";

import { IDLE } from "@/lib/form";
import {
  RULE_TRIGGER_LABELS,
  RULE_TRIGGERS,
  RULE_ACTION_LABELS,
  TRIGGER_ACTIONS,
  TRIGGER_HINT,
} from "@/lib/automation/rules";
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS } from "@/lib/crm/labels";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { SubmitButton, FormError, FormSuccess } from "@/components/form";
import {
  createRuleAction,
  updateRuleAction,
  toggleRuleAction,
  deleteRuleAction,
  runAutomationNowAction,
  retryExecutionAction,
} from "./actions";

export type RuleRow = {
  id: string;
  name: string;
  trigger: RuleTrigger;
  action: RuleAction;
  enabled: boolean;
  config: {
    delayMinutes?: number;
    withinDays?: number;
    taskTitle?: string;
    taskPriority?: string;
    notifyManagers?: boolean;
  };
  fires: number;
};

function ConfigFields({
  trigger,
  config,
}: {
  trigger: RuleTrigger;
  config?: RuleRow["config"];
}) {
  const usesDelay =
    trigger === "LEAD_CREATED_NO_FOLLOWUP" || trigger === "QUOTATION_SENT_NO_RESPONSE";
  const usesWithin = trigger === "DEAL_CLOSE_APPROACHING";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {usesDelay && (
        <Field label="Wait (minutes)" htmlFor="delayMinutes" hint="e.g. 1440 = 1 day">
          <Input name="delayMinutes" defaultValue={config?.delayMinutes ?? ""} inputMode="numeric" />
        </Field>
      )}
      {usesWithin && (
        <Field label="Window (days before close)" htmlFor="withinDays">
          <Input name="withinDays" defaultValue={config?.withinDays ?? 7} inputMode="numeric" />
        </Field>
      )}
      <Field label="Task title" htmlFor="taskTitle" hint="Used when the action creates a task">
        <Input name="taskTitle" defaultValue={config?.taskTitle ?? ""} />
      </Field>
      <Field label="Task priority" htmlFor="taskPriority">
        <Select name="taskPriority" defaultValue={config?.taskPriority ?? "MEDIUM"}>
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

export function CreateRule() {
  const [state, action] = useActionState(createRuleAction, IDLE);
  const [trigger, setTrigger] = useState<RuleTrigger>("LEAD_CREATED_NO_FOLLOWUP");
  const actions = TRIGGER_ACTIONS[trigger];

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Name" htmlFor="name" error={state.fieldErrors?.name}>
          <Input name="name" required placeholder="Chase stale leads" />
        </Field>
        <Field label="When" htmlFor="trigger">
          <Select
            name="trigger"
            value={trigger}
            onChange={(e) => setTrigger(e.target.value as RuleTrigger)}
          >
            {RULE_TRIGGERS.map((t) => (
              <option key={t} value={t}>{RULE_TRIGGER_LABELS[t]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Do" htmlFor="action">
          <Select name="action" defaultValue={actions[0]}>
            {actions.map((a) => (
              <option key={a} value={a}>{RULE_ACTION_LABELS[a]}</option>
            ))}
          </Select>
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">{TRIGGER_HINT[trigger]}</p>
      <ConfigFields trigger={trigger} />
      <FormError message={state.error} />
      <FormSuccess message={state.ok ? state.message : undefined} />
      <SubmitButton size="sm" pendingText="Creating…">Add rule</SubmitButton>
    </form>
  );
}

export function RunNowButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-3">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await runAutomationNowAction();
            setMsg(r.ok ? (r.message ?? "Done.") : (r.error ?? "Failed."));
          })
        }
      >
        <Play className="size-4" /> Run automation now
      </Button>
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
    </div>
  );
}

export function RuleList({ rules }: { rules: RuleRow[] }) {
  if (rules.length === 0) {
    return <p className="text-sm text-muted-foreground">No rules yet.</p>;
  }
  return (
    <ul className="divide-y divide-border">
      {rules.map((r) => (
        <RuleItem key={r.id} rule={r} />
      ))}
    </ul>
  );
}

function RuleItem({ rule }: { rule: RuleRow }) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState(updateRuleAction, IDLE);
  useEffect(() => {
    if (state.ok) setEditing(false);
  }, [state]);

  if (editing) {
    return (
      <li className="py-4">
        <form action={action} className="space-y-3">
          <input type="hidden" name="id" value={rule.id} />
          <input type="hidden" name="trigger" value={rule.trigger} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" htmlFor="name" error={state.fieldErrors?.name}>
              <Input name="name" defaultValue={rule.name} required />
            </Field>
            <Field label="Do" htmlFor="action">
              <Select name="action" defaultValue={rule.action}>
                {TRIGGER_ACTIONS[rule.trigger].map((a) => (
                  <option key={a} value={a}>{RULE_ACTION_LABELS[a]}</option>
                ))}
              </Select>
            </Field>
          </div>
          <ConfigFields trigger={rule.trigger} config={rule.config} />
          <FormError message={state.error} />
          <div className="flex gap-2">
            <SubmitButton size="sm" pendingText="Saving…">Save</SubmitButton>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{rule.name}</p>
        <p className="text-xs text-muted-foreground">
          {RULE_TRIGGER_LABELS[rule.trigger]} → {RULE_ACTION_LABELS[rule.action]} ·{" "}
          {rule.fires} fired
        </p>
      </div>
      <form action={toggleRuleAction}>
        <input type="hidden" name="id" value={rule.id} />
        <input type="hidden" name="enabled" value={(!rule.enabled).toString()} />
        <button
          className={
            "rounded-full px-2.5 py-0.5 text-xs font-medium " +
            (rule.enabled
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
              : "bg-muted text-muted-foreground")
          }
        >
          {rule.enabled ? "Enabled" : "Disabled"}
        </button>
      </form>
      <button
        onClick={() => setEditing(true)}
        className="rounded p-1 text-muted-foreground hover:bg-muted"
        aria-label="Edit rule"
      >
        <Pencil className="size-4" />
      </button>
      <form
        action={deleteRuleAction}
        onSubmit={(e) => {
          if (!confirm(`Delete rule "${rule.name}"?`)) e.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={rule.id} />
        <button className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Delete rule">
          <Trash2 className="size-4" />
        </button>
      </form>
    </li>
  );
}

export function RetryButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const fd = new FormData();
            fd.set("id", id);
            const r = await retryExecutionAction(fd);
            setMsg(r.ok ? "retried" : (r.error ?? "failed"));
          })
        }
        className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
      >
        Retry
      </button>
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
    </span>
  );
}
