"use client";

import { useActionState, useEffect, useRef } from "react";

import { IDLE, type ActionState } from "@/lib/form";
import {
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITIES,
} from "@/lib/crm/labels";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { SubmitButton, FormError } from "@/components/form";
import { createTaskAction, updateTaskAction } from "./actions";

export type TaskFormValues = {
  id?: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  dueAt: string; // yyyy-MM-ddTHH:mm
  assigneeId: string;
};

export function TaskForm({
  mode,
  values,
  members,
  parent,
  onDone,
  compact,
}: {
  mode: "create" | "edit";
  values: TaskFormValues;
  members: { id: string; name: string }[];
  parent?: { field: "leadId" | "contactId" | "companyId" | "dealId"; id: string };
  onDone?: () => void;
  compact?: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    mode === "create" ? createTaskAction : updateTaskAction,
    IDLE,
  );
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      if (mode === "create") ref.current?.reset();
      onDone?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const err = state.fieldErrors ?? {};

  return (
    <form ref={ref} action={action} className="space-y-3">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      {parent && <input type="hidden" name={parent.field} value={parent.id} />}

      <Field label="Title" htmlFor="title" error={err.title}>
        <Input id="title" name="title" defaultValue={values.title} required />
      </Field>

      {!compact && (
        <Field label="Description" htmlFor="description" error={err.description}>
          <Textarea id="description" name="description" rows={2} defaultValue={values.description} />
        </Field>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Priority" htmlFor="priority" error={err.priority}>
          <Select id="priority" name="priority" defaultValue={values.priority || "MEDIUM"}>
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Status" htmlFor="status" error={err.status}>
          <Select id="status" name="status" defaultValue={values.status || "TODO"}>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Due" htmlFor="dueAt" error={err.dueAt}>
          <Input id="dueAt" name="dueAt" type="datetime-local" defaultValue={values.dueAt} />
        </Field>
      </div>

      <Field label="Assignee" htmlFor="assigneeId" error={err.assigneeId}>
        <Select id="assigneeId" name="assigneeId" defaultValue={values.assigneeId}>
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </Select>
      </Field>

      <FormError message={state.error} />

      <div className="flex gap-2">
        <SubmitButton size="sm" pendingText="Saving…">
          {mode === "create" ? "Add task" : "Save"}
        </SubmitButton>
        {onDone && (
          <Button type="button" variant="ghost" size="sm" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
