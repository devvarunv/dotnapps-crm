import Link from "next/link";
import type { Metadata } from "next";
import { KanbanSquare } from "lucide-react";

import { checkPermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { filterValue } from "@/lib/crm/query";
import { PageHeader } from "@/components/app/page-header";
import { DeniedState } from "@/components/app/denied";
import { EmptyState } from "@/components/app/empty";
import { ListToolbar } from "@/components/app/list-toolbar";
import { buttonClassName } from "@/components/ui/button";
import { Board } from "./board";

export const metadata: Metadata = { title: "Pipeline" };

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const check = await checkPermission("deals:view");
  if (!check.ok) return <DeniedState />;
  const { ctx } = check;

  const raw = await searchParams;

  const pipelines = await prisma.pipeline.findMany({
    where: { orgId: ctx.org.id, archived: false },
    orderBy: { position: "asc" },
    include: { stages: { orderBy: { position: "asc" } } },
  });

  if (pipelines.length === 0) {
    return (
      <div>
        <PageHeader title="Pipeline" />
        <EmptyState
          icon={KanbanSquare}
          title="No pipeline configured"
          description="Create a pipeline with stages to use the board."
          actionLabel={can(ctx.role, "org:manage") ? "Set up a pipeline" : undefined}
          actionHref={can(ctx.role, "org:manage") ? "/settings/pipelines" : undefined}
        />
      </div>
    );
  }

  const wantedPipeline = filterValue(raw, "pipeline");
  const pipeline =
    pipelines.find((p) => p.id === wantedPipeline) ??
    pipelines.find((p) => p.isDefault) ??
    pipelines[0];

  const ownerFilter = filterValue(raw, "owner");
  const tagFilter = filterValue(raw, "tag");

  const [deals, members, tags] = await Promise.all([
    prisma.deal.findMany({
      where: {
        orgId: ctx.org.id,
        pipelineId: pipeline.id,
        archived: false,
        ...(ownerFilter === "unassigned"
          ? { ownerId: null }
          : ownerFilter
            ? { ownerId: ownerFilter }
            : {}),
        ...(tagFilter ? { tags: { some: { id: tagFilter } } } : {}),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        company: { select: { name: true } },
        owner: { select: { name: true } },
      },
    }),
    prisma.membership.findMany({
      where: { orgId: ctx.org.id, status: "ACTIVE" },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.tag.findMany({ where: { orgId: ctx.org.id }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Pipeline"
        description={`${deals.length} ${deals.length === 1 ? "deal" : "deals"} in ${pipeline.name}`}
        actions={
          <Link href="/deals" className={buttonClassName({ variant: "outline", size: "sm" })}>
            List view
          </Link>
        }
      />

      <ListToolbar
        hideSearch
        filters={[
          {
            name: "pipeline",
            label: "Pipeline",
            options: pipelines.map((p) => ({ value: p.id, label: p.name })),
          },
          {
            name: "owner",
            label: "Owner",
            options: [
              { value: "unassigned", label: "Unassigned" },
              ...members.map((m) => ({ value: m.user.id, label: m.user.name })),
            ],
          },
          {
            name: "tag",
            label: "Tag",
            options: tags.map((t) => ({ value: t.id, label: t.name })),
          },
        ]}
      />

      <Board
        canEdit={can(ctx.role, "deals:edit")}
        stages={pipeline.stages.map((s) => ({ id: s.id, name: s.name, kind: s.kind }))}
        deals={deals.map((d) => ({
          id: d.id,
          name: d.name,
          stageId: d.stageId,
          value: d.value ? Number(d.value) : null,
          currency: d.currency,
          company: d.company?.name ?? null,
          owner: d.owner?.name ?? null,
          status: d.status,
        }))}
      />
    </div>
  );
}
