import type { Prisma } from "@prisma/client";
import { parseListParams, filterValue, type SearchParams } from "@/lib/crm/query";
import { TASK_STATUSES, TASK_PRIORITIES } from "@/lib/crm/labels";

const SORTABLE = ["dueAt", "createdAt", "priority"];

export function parseTaskParams(raw: SearchParams) {
  const base = parseListParams(raw, { defaultSort: "dueAt", sortable: SORTABLE });
  const status = filterValue(raw, "status");
  const priority = filterValue(raw, "priority");
  const view = filterValue(raw, "view"); // my | team | overdue | ""
  return {
    ...base,
    dir: (raw.dir as string) === "desc" ? ("desc" as const) : ("asc" as const),
    status: (TASK_STATUSES as string[]).includes(status) ? status : "",
    priority: (TASK_PRIORITIES as string[]).includes(priority) ? priority : "",
    assignee: filterValue(raw, "assignee"),
    view: ["my", "team", "overdue"].includes(view) ? view : "",
  };
}

export function buildTaskWhere(
  orgId: string,
  userId: string,
  p: ReturnType<typeof parseTaskParams>,
): Prisma.TaskWhereInput {
  const where: Prisma.TaskWhereInput = { orgId };
  if (p.q) where.title = { contains: p.q, mode: "insensitive" };
  if (p.status) where.status = p.status as Prisma.TaskWhereInput["status"];
  if (p.priority) where.priority = p.priority as Prisma.TaskWhereInput["priority"];
  if (p.assignee === "unassigned") where.assigneeId = null;
  else if (p.assignee) where.assigneeId = p.assignee;

  if (p.view === "my") where.assigneeId = userId;
  if (p.view === "overdue") {
    where.dueAt = { lt: new Date() };
    where.status = { notIn: ["COMPLETED", "CANCELLED"] };
  }
  return where;
}
