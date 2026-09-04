import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pencil, Archive, ArchiveRestore } from "lucide-react";

import { checkPermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";
import { formatMoney } from "@/lib/crm/sales";
import {
  DEAL_STATUS_LABELS,
  DEAL_STATUS_TONES,
  LEAD_SOURCE_LABELS,
} from "@/lib/crm/labels";
import { PageHeader } from "@/components/app/page-header";
import { DeniedState } from "@/components/app/denied";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui/primitives";
import { buttonClassName } from "@/components/ui/button";
import { TagBadge } from "@/components/app/tag-badge";
import { Timeline } from "@/components/app/timeline";
import { logActivityAction } from "@/app/(app)/activities/actions";
import { TasksList, AddTaskInline } from "@/app/(app)/tasks/tasks-client";
import { setDealArchivedAction } from "../actions";
import { StageSelect, WinLose } from "./deal-actions";

export const metadata: Metadata = { title: "Deal" };

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const check = await checkPermission("deals:view");
  if (!check.ok) return <DeniedState />;
  const { ctx } = check;

  const deal = await prisma.deal.findFirst({
    where: { id, orgId: ctx.org.id },
    include: {
      stage: true,
      pipeline: {
        include: { stages: { orderBy: { position: "asc" }, select: { id: true, name: true } } },
      },
      company: { select: { id: true, name: true } },
      contact: { select: { id: true, name: true } },
      owner: { select: { name: true } },
      tags: { select: { id: true, name: true, color: true } },
      fromLeads: { select: { id: true, name: true } },
      tasks: {
        orderBy: [{ status: "asc" }, { dueAt: "asc" }],
        include: { assignee: { select: { name: true } } },
      },
      activities: {
        orderBy: { occurredAt: "desc" },
        include: { createdBy: { select: { name: true } } },
      },
    },
  });
  if (!deal) notFound();

  const canEdit = can(ctx.role, "deals:edit");
  const members = canEdit
    ? (
        await prisma.membership.findMany({
          where: { orgId: ctx.org.id, status: "ACTIVE" },
          include: { user: { select: { id: true, name: true } } },
          orderBy: { user: { name: "asc" } },
        })
      ).map((m) => ({ id: m.user.id, name: m.user.name }))
    : [];

  const now = Date.now();
  const detail: [string, string][] = [
    ["Pipeline", deal.pipeline.name],
    ["Stage", deal.stage.name],
    ["Value", formatMoney(deal.value, deal.currency)],
    ["Probability", deal.probability !== null ? `${deal.probability}%` : "—"],
    ["Expected close", deal.expectedCloseDate ? formatDate(deal.expectedCloseDate) : "—"],
    ["Source", deal.source ? LEAD_SOURCE_LABELS[deal.source] : "—"],
    ["Owner", deal.owner?.name ?? "Unassigned"],
    ["Created", formatDate(deal.createdAt)],
    ...(deal.closedAt ? ([["Closed", formatDate(deal.closedAt)]] as [string, string][]) : []),
    ...(deal.winReason ? ([["Win reason", deal.winReason]] as [string, string][]) : []),
    ...(deal.lossReason ? ([["Loss reason", deal.lossReason]] as [string, string][]) : []),
  ];

  return (
    <div>
      <Link href="/deals" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Deals
      </Link>

      <PageHeader
        title={deal.name}
        description={deal.company?.name ?? deal.contact?.name ?? undefined}
        actions={
          canEdit ? (
            <>
              <Link href={`/deals/${deal.id}/edit`} className={buttonClassName({ variant: "outline", size: "sm" })}>
                <Pencil className="size-4" /> Edit
              </Link>
              <form action={setDealArchivedAction}>
                <input type="hidden" name="id" value={deal.id} />
                <input type="hidden" name="archived" value={(!deal.archived).toString()} />
                <button className={buttonClassName({ variant: "outline", size: "sm" })}>
                  {deal.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                  {deal.archived ? "Unarchive" : "Archive"}
                </button>
              </form>
            </>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={DEAL_STATUS_TONES[deal.status]}>{DEAL_STATUS_LABELS[deal.status]}</Badge>
        <Badge tone="neutral">{deal.stage.name}</Badge>
        {deal.archived && <Badge tone="danger">Archived</Badge>}
        {deal.tags.map((t) => (
          <TagBadge key={t.id} name={t.name} color={t.color} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {detail.map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="text-sm">{v}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Tasks ({deal.tasks.length})</CardTitle>
              {can(ctx.role, "tasks:create") && (
                <AddTaskInline members={members} parent={{ field: "dealId", id: deal.id }} />
              )}
            </CardHeader>
            <CardContent>
              <TasksList
                canEdit={canEdit}
                members={members}
                tasks={deal.tasks.map((t) => ({
                  id: t.id,
                  title: t.title,
                  description: t.description,
                  status: t.status,
                  priority: t.priority,
                  dueAt: t.dueAt?.toISOString() ?? null,
                  assignee: t.assignee?.name ?? null,
                  assigneeId: t.assigneeId,
                  parentLabel: null,
                  parentHref: null,
                  overdue: !!t.dueAt && t.dueAt.getTime() < now && t.status !== "COMPLETED",
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Activity &amp; timeline</CardTitle></CardHeader>
            <CardContent>
              <Timeline
                parentField="dealId"
                parentId={deal.id}
                canAdd={can(ctx.role, "activities:create")}
                logAction={logActivityAction}
                items={deal.activities.map((a) => ({
                  id: a.id,
                  type: a.type,
                  source: a.source,
                  subject: a.subject,
                  body: a.body,
                  author: a.createdBy?.name ?? null,
                  occurredAt: a.occurredAt.toISOString(),
                }))}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {canEdit && (
            <Card>
              <CardHeader><CardTitle>Move stage</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <StageSelect
                  dealId={deal.id}
                  stageId={deal.stageId}
                  stages={deal.pipeline.stages}
                  disabled={deal.status !== "OPEN"}
                />
                <WinLose dealId={deal.id} status={deal.status} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>People</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {deal.company && (
                <Link href={`/companies/${deal.company.id}`} className="block text-primary hover:underline">
                  {deal.company.name}
                </Link>
              )}
              {deal.contact && (
                <Link href={`/contacts/${deal.contact.id}`} className="block text-primary hover:underline">
                  {deal.contact.name}
                </Link>
              )}
              {deal.fromLeads.map((l) => (
                <Link key={l.id} href={`/leads/${l.id}`} className="block text-muted-foreground hover:underline">
                  From lead: {l.name}
                </Link>
              ))}
              {!deal.company && !deal.contact && deal.fromLeads.length === 0 && (
                <p className="text-muted-foreground">No people linked.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
