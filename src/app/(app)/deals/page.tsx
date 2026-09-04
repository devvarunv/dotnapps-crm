import Link from "next/link";
import type { Metadata } from "next";
import { Handshake, Download, Plus } from "lucide-react";

import { checkPermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { paginate, buildQuery } from "@/lib/crm/query";
import { formatDate } from "@/lib/utils";
import { formatMoney } from "@/lib/crm/sales";
import { DEAL_STATUS_LABELS, DEAL_STATUS_TONES } from "@/lib/crm/labels";
import { PageHeader } from "@/components/app/page-header";
import { DeniedState } from "@/components/app/denied";
import { EmptyState } from "@/components/app/empty";
import { ListToolbar } from "@/components/app/list-toolbar";
import { Pagination } from "@/components/app/pagination";
import { TagBadge } from "@/components/app/tag-badge";
import { Badge } from "@/components/ui/primitives";
import { buttonClassName } from "@/components/ui/button";
import { parseDealParams, buildDealWhere } from "./query";

export const metadata: Metadata = { title: "Deals" };

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const check = await checkPermission("deals:view");
  if (!check.ok) return <DeniedState />;
  const { ctx } = check;

  const raw = await searchParams;
  const p = parseDealParams(raw);
  const where = buildDealWhere(ctx.org.id, p);

  const total = await prisma.deal.count({ where });
  const pg = paginate(p.page, total);

  const [deals, pipelines, members, tags] = await Promise.all([
    prisma.deal.findMany({
      where,
      orderBy: { [p.sort]: p.dir },
      skip: pg.skip,
      take: pg.take,
      include: {
        stage: { select: { name: true } },
        pipeline: { select: { name: true } },
        company: { select: { id: true, name: true } },
        owner: { select: { name: true } },
        tags: { select: { id: true, name: true, color: true } },
      },
    }),
    prisma.pipeline.findMany({
      where: { orgId: ctx.org.id, archived: false },
      orderBy: { position: "asc" },
      include: { stages: { orderBy: { position: "asc" }, select: { id: true, name: true } } },
    }),
    prisma.membership.findMany({
      where: { orgId: ctx.org.id, status: "ACTIVE" },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.tag.findMany({ where: { orgId: ctx.org.id }, orderBy: { name: "asc" } }),
  ]);

  const canCreate = can(ctx.role, "deals:create");
  const canExport = can(ctx.role, "export:data");
  const noPipeline = pipelines.length === 0;

  const stageOptions =
    pipelines.find((pl) => pl.id === p.pipeline)?.stages ??
    pipelines.flatMap((pl) => pl.stages);

  return (
    <div>
      <PageHeader
        title="Deals"
        description="Opportunities moving through your pipeline."
        actions={
          <>
            {canExport && total > 0 && (
              <Link
                href={`/deals/export${buildQuery(raw, { page: undefined })}`}
                className={buttonClassName({ variant: "outline", size: "sm" })}
                prefetch={false}
              >
                <Download className="size-4" /> Export
              </Link>
            )}
            <Link href="/pipeline" className={buttonClassName({ variant: "outline", size: "sm" })}>
              Board view
            </Link>
            {canCreate && !noPipeline && (
              <Link href="/deals/new" className={buttonClassName({ size: "sm" })}>
                <Plus className="size-4" /> New deal
              </Link>
            )}
          </>
        }
      />

      {noPipeline ? (
        <EmptyState
          icon={Handshake}
          title="No pipeline configured"
          description="Create a pipeline with stages before adding deals."
          actionLabel={can(ctx.role, "org:manage") ? "Set up a pipeline" : undefined}
          actionHref={can(ctx.role, "org:manage") ? "/settings/pipelines" : undefined}
        />
      ) : (
        <>
          <ListToolbar
            searchPlaceholder="Search deal, company, contact…"
            filters={[
              {
                name: "pipeline",
                label: "Pipeline",
                options: pipelines.map((pl) => ({ value: pl.id, label: pl.name })),
              },
              {
                name: "stage",
                label: "Stage",
                options: stageOptions.map((s) => ({ value: s.id, label: s.name })),
              },
              {
                name: "status",
                label: "Status",
                options: (["OPEN", "WON", "LOST"] as const).map((s) => ({
                  value: s,
                  label: DEAL_STATUS_LABELS[s],
                })),
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
              { name: "archived", label: "Show", options: [{ value: "1", label: "Archived" }] },
            ]}
          />

          {deals.length === 0 ? (
            <EmptyState
              icon={Handshake}
              title={total === 0 && !p.q ? "No deals yet" : "No deals match your filters"}
              description={
                total === 0 && !p.q
                  ? "Create a deal or convert a qualified lead."
                  : "Try clearing the search or filters."
              }
              actionLabel={canCreate && total === 0 ? "New deal" : undefined}
              actionHref={canCreate && total === 0 ? "/deals/new" : undefined}
            />
          ) : (
            <>
              <div className="rounded-lg border border-border bg-card">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Deal</th>
                        <th className="px-3 py-2 font-medium">Stage</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium">Value</th>
                        <th className="px-3 py-2 font-medium">Owner</th>
                        <th className="px-3 py-2 font-medium">Close</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {deals.map((d) => (
                        <tr key={d.id} className="hover:bg-muted/40">
                          <td className="px-3 py-2">
                            <Link href={`/deals/${d.id}`} className="font-medium hover:underline">
                              {d.name}
                            </Link>
                            <div className="text-xs text-muted-foreground">
                              {d.company?.name ?? "—"} · {d.pipeline.name}
                            </div>
                            {d.tags.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {d.tags.map((t) => (
                                  <TagBadge key={t.id} name={t.name} color={t.color} />
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{d.stage.name}</td>
                          <td className="px-3 py-2">
                            <Badge tone={DEAL_STATUS_TONES[d.status]}>
                              {DEAL_STATUS_LABELS[d.status]}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 tabular-nums text-muted-foreground">
                            {formatMoney(d.value, d.currency)}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {d.owner?.name ?? "Unassigned"}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {d.expectedCloseDate ? formatDate(d.expectedCloseDate) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <Pagination basePath="/deals" raw={raw} current={pg.current} pages={pg.pages} total={pg.total} />
            </>
          )}
        </>
      )}
    </div>
  );
}
