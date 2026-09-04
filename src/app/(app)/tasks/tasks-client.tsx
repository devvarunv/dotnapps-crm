"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, Pencil, Plus } from "lucide-react";

import {
  TASK_STATUS_LABELS,
  TASK_STATUS_TONES,
  TASK_STATUSES,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_TONES,
} from "@/lib/crm/labels";
import { Badge } from "@/components/ui/primitives";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TaskForm } from "./task-form";
import { setTaskStatusAction, deleteTaskAction } from "./actions";

export type TaskItem = {
  id: string;
  title: string;
  description: string | null;
  status: keyof typeof TASK_STATUS_LABELS;
  priority: keyof typeof TASK_PRIORITY_LABELS;
  dueAt: string | null;
  assignee: string | null;
  assigneeId: string | null;
  parentLabel: string | null;
  parentHref: string | null;
  overdue: boolean;
};

export function TasksList({
  tasks,
  members,
  canEdit,
}: {
  tasks: TaskItem[];
  members: { id: string; name: string }[];
  canEdit: boolean;
}) {
  if (tasks.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No tasks here.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card">
      {tasks.map((t) => (
        <TaskRow key={t.id} task={t} members={members} canEdit={canEdit} />
      ))}
    </ul>
  );
}

function TaskRow({
  task,
  members,
  canEdit,
}: {
  task: TaskItem;
  members: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const done = task.status === "COMPLETED" || task.status === "CANCELLED";

  if (editing) {
    return (
      <li className="p-4">
        <TaskForm
          mode="edit"
          members={members}
          onDone={() => {
            setEditing(false);
            router.refresh();
          }}
          values={{
            id: task.id,
            title: task.title,
            description: task.description ?? "",
            status: task.status,
            priority: task.priority,
            dueAt: task.dueAt ? task.dueAt.slice(0, 16) : "",
            assigneeId: task.assigneeId ?? "",
          }}
        />
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 p-3">
      <input
        type="checkbox"
        checked={task.status === "COMPLETED"}
        disabled={!canEdit || pending}
        onChange={(e) => {
          const fd = new FormData();
          fd.set("taskId", task.id);
          fd.set("status", e.target.checked ? "COMPLETED" : "TODO");
          start(async () => {
            await setTaskStatusAction(fd);
            router.refresh();
          });
        }}
        aria-label={`Complete ${task.title}`}
      />

      <div className="min-w-0 flex-1">
        <p className={"text-sm font-medium " + (done ? "text-muted-foreground line-through" : "")}>
          {task.title}
        </p>
        <p className="text-xs text-muted-foreground">
          {task.parentHref ? (
            <Link href={task.parentHref} className="hover:underline">
              {task.parentLabel}
            </Link>
          ) : (
            "No linked record"
          )}
          {task.dueAt && (
            <>
              {" · "}
              <span className={task.overdue ? "text-destructive" : ""}>
                due{" "}
                {new Date(task.dueAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </>
          )}
          {task.assignee && <> · {task.assignee}</>}
        </p>
      </div>

      <Badge tone={TASK_PRIORITY_TONES[task.priority]}>
        {TASK_PRIORITY_LABELS[task.priority]}
      </Badge>

      {canEdit ? (
        <Select
          value={task.status}
          disabled={pending}
          className="h-8 w-32"
          onChange={(e) => {
            const fd = new FormData();
            fd.set("taskId", task.id);
            fd.set("status", e.target.value);
            start(async () => {
              await setTaskStatusAction(fd);
              router.refresh();
            });
          }}
        >
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>
          ))}
        </Select>
      ) : (
        <Badge tone={TASK_STATUS_TONES[task.status]}>
          {TASK_STATUS_LABELS[task.status]}
        </Badge>
      )}

      {canEdit && (
        <div className="flex gap-1">
          <button
            onClick={() => setEditing(true)}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
            aria-label="Edit task"
          >
            <Pencil className="size-4" />
          </button>
          <form
            action={deleteTaskAction}
            onSubmit={(e) => {
              if (!confirm("Delete this task?")) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={task.id} />
            <button className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Delete task">
              <Trash2 className="size-4" />
            </button>
          </form>
        </div>
      )}
    </li>
  );
}

export function AddTaskInline({
  members,
  parent,
}: {
  members: { id: string; name: string }[];
  parent: { field: "leadId" | "contactId" | "companyId" | "dealId"; id: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Add task
      </Button>
    );
  }
  return (
    <TaskForm
      mode="create"
      members={members}
      parent={parent}
      compact
      values={{
        title: "",
        description: "",
        status: "TODO",
        priority: "MEDIUM",
        dueAt: "",
        assigneeId: "",
      }}
      onDone={() => {
        setOpen(false);
        router.refresh();
      }}
    />
  );
}
