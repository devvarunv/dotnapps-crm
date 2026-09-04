import Link from "next/link";
import type { Metadata } from "next";
import { CheckSquare } from "lucide-react";

import { checkPermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { paginate } from "@/lib/crm/query";
import {
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITIES,
} from "@/lib/crm/labels";
import { PageHeader } from "@/components/app/page-header";
import { DeniedState } from "@/components/app/denied";
import { ListToolbar } from "@/components/app/list-toolbar";
import { Pagination } from "@/components/app/pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { TasksList } from "./tasks-client";
import { TaskForm } from "./task-form";
import { parseTaskParams, buildTaskWhere } from "./query";

export const metadata: Metadata = { title: "Tasks" };

const VIEWS = [
  { key: "", label: "All" },
  { key: "my", label: "My tasks" },
  { key: "overdue", label: "Overdue" },
];

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const check = await checkPermission("tasks:view");
  if (!check.ok) return <DeniedState />;
  const { ctx } = check;

  const raw = await searchParams;
  const p = parseTaskParams(raw);
  const where = buildTaskWhere(ctx.org.id, ctx.user.id, p);

  const total = await prisma.task.count({ where });
  const pg = paginate(p.page, total);

  const [tasks, members] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy: [{ status: "asc" }, { [p.sort]: p.dir }],
      skip: pg.skip,
      take: pg.take,
      include: {
        assignee: { select: { name: true } },
        lead: { select: { id: true, name: true } },
        contact: { select: { id: true, name: true } },
        company: { select: { id: true, name: true } },
        deal: { select: { id: true, name: true } },
      },
    }),
    prisma.membership.findMany({
      where: { orgId: ctx.org.id, status: "ACTIVE" },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
  ]);

  const memberOptions = members.map((m) => ({ id: m.user.id, name: m.user.name }));
  const canCreate = can(ctx.role, "tasks:create");
  const canEdit = can(ctx.role, "tasks:edit");
  const now = Date.now();
  const activeView = p.view;

  function parentOf(t: (typeof tasks)[number]) {
    if (t.deal) return { label: `Deal: ${t.deal.name}`, href: `/deals/${t.deal.id}` };
    if (t.lead) return { label: `Lead: ${t.lead.name}`, href: `/leads/${t.lead.id}` };
    if (t.contact) return { label: `Contact: ${t.contact.name}`, href: `/contacts/${t.contact.id}` };
    if (t.company) return { label: `Company: ${t.company.name}`, href: `/companies/${t.company.id}` };
    return { label: null, href: null };
  }

  return (
    <div>
      <PageHeader title="Tasks" description="Follow-ups across your workspace." />

      <div className="mb-4 flex flex-wrap gap-1">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={v.key ? `/tasks?view=${v.key}` : "/tasks"}
            className={
              "rounded-md px-3 py-1.5 text-sm " +
              (activeView === v.key
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-muted")
            }
          >
            {v.label}
          </Link>
        ))}
      </div>

      {canCreate && (
        <Card className="mb-6">
          <CardHeader><CardTitle>New task</CardTitle></CardHeader>
          <CardContent>
            <TaskForm
              mode="create"
              members={memberOptions}
              values={{
                title: "",
                description: "",
                status: "TODO",
                priority: "MEDIUM",
                dueAt: "",
                assigneeId: ctx.user.id,
              }}
            />
          </CardContent>
        </Card>
      )}

      <ListToolbar
        searchPlaceholder="Search task titles…"
        filters={[
          {
            name: "status",
            label: "Status",
            options: TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s] })),
          },
          {
            name: "priority",
            label: "Priority",
            options: TASK_PRIORITIES.map((s) => ({ value: s, label: TASK_PRIORITY_LABELS[s] })),
          },
          {
            name: "assignee",
            label: "Assignee",
            options: [
              { value: "unassigned", label: "Unassigned" },
              ...memberOptions.map((m) => ({ value: m.id, label: m.name })),
            ],
          },
        ]}
      />

      {total === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          <CheckSquare className="mx-auto mb-2 size-5" />
          No tasks {activeView === "overdue" ? "overdue" : activeView === "my" ? "assigned to you" : "yet"}.
        </p>
      ) : (
        <>
          <TasksList
            canEdit={canEdit}
            members={memberOptions}
            tasks={tasks.map((t) => {
              const parent = parentOf(t);
              return {
                id: t.id,
                title: t.title,
                description: t.description,
                status: t.status,
                priority: t.priority,
                dueAt: t.dueAt?.toISOString() ?? null,
                assignee: t.assignee?.name ?? null,
                assigneeId: t.assigneeId,
                parentLabel: parent.label,
                parentHref: parent.href,
                overdue: !!t.dueAt && t.dueAt.getTime() < now && t.status !== "COMPLETED" && t.status !== "CANCELLED",
              };
            })}
          />
          <Pagination basePath="/tasks" raw={raw} current={pg.current} pages={pg.pages} total={pg.total} />
        </>
      )}
    </div>
  );
}
