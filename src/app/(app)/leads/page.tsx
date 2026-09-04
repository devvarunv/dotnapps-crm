import Link from "next/link";
import type { Metadata } from "next";
import { UserPlus, Download } from "lucide-react";

import { checkPermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { buildQuery } from "@/lib/crm/query";
import { paginate } from "@/lib/crm/query";
import {
  LEAD_SOURCE_LABELS,
  LEAD_STATUS_LABELS,
  LEAD_SOURCES,
  LEAD_STATUSES,
} from "@/lib/crm/labels";
import { PageHeader } from "@/components/app/page-header";
import { DeniedState } from "@/components/app/denied";
import { EmptyState } from "@/components/app/empty";
import { ListToolbar } from "@/components/app/list-toolbar";
import { Pagination } from "@/components/app/pagination";
import { buttonClassName } from "@/components/ui/button";
import { LeadsTable } from "./leads-table";
import { parseLeadParams, buildLeadWhere, leadOrderBy } from "./query";

export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const check = await checkPermission("leads:view");
  if (!check.ok) return <DeniedState />;
  const { ctx } = check;

  const raw = await searchParams;
  const p = parseLeadParams(raw);
  const where = buildLeadWhere(ctx.org.id, p);

  const total = await prisma.lead.count({ where });
  const pg = paginate(p.page, total);

  const [leads, members, tags] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: leadOrderBy(p),
      skip: pg.skip,
      take: pg.take,
      include: {
        owner: { select: { id: true, name: true } },
        tags: { select: { id: true, name: true, color: true } },
        _count: { select: { noteItems: true } },
      },
    }),
    prisma.membership.findMany({
      where: { orgId: ctx.org.id, status: "ACTIVE" },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.tag.findMany({
      where: { orgId: ctx.org.id },
      orderBy: { name: "asc" },
    }),
  ]);

  const memberOptions = members.map((m) => ({ id: m.user.id, name: m.user.name }));
  const canCreate = can(ctx.role, "leads:create");
  const canExport = can(ctx.role, "export:data");

  return (
    <div>
      <PageHeader
        title="Leads"
        description="Capture, qualify, assign and convert leads."
        actions={
          <>
            {canExport && total > 0 && (
              <Link
                href={`/leads/export${buildQuery(raw, { page: undefined })}`}
                className={buttonClassName({ variant: "outline", size: "sm" })}
                prefetch={false}
              >
                <Download className="size-4" /> Export
              </Link>
            )}
            {canCreate && (
              <Link href="/leads/new" className={buttonClassName({ size: "sm" })}>
                <UserPlus className="size-4" /> New lead
              </Link>
            )}
          </>
        }
      />

      <ListToolbar
        searchPlaceholder="Search name, email, company, phone…"
        filters={[
          {
            name: "status",
            label: "Status",
            options: LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s] })),
          },
          {
            name: "source",
            label: "Source",
            options: LEAD_SOURCES.map((s) => ({ value: s, label: LEAD_SOURCE_LABELS[s] })),
          },
          {
            name: "owner",
            label: "Owner",
            options: [
              { value: "unassigned", label: "Unassigned" },
              ...memberOptions.map((m) => ({ value: m.id, label: m.name })),
            ],
          },
          {
            name: "tag",
            label: "Tag",
            options: tags.map((t) => ({ value: t.id, label: t.name })),
          },
          {
            name: "archived",
            label: "Show",
            options: [{ value: "1", label: "Archived" }],
          },
        ]}
      />

      {leads.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title={total === 0 && !p.q ? "No leads yet" : "No leads match your filters"}
          description={
            total === 0 && !p.q
              ? "Add your first lead to start building your pipeline."
              : "Try clearing the search or filters."
          }
          actionLabel={canCreate && total === 0 ? "New lead" : undefined}
          actionHref={canCreate && total === 0 ? "/leads/new" : undefined}
        />
      ) : (
        <>
          <LeadsTable
            rows={leads.map((l) => ({
              id: l.id,
              name: l.name,
              company: l.companyName,
              email: l.email,
              status: l.status,
              source: l.source,
              owner: l.owner?.name ?? null,
              ownerId: l.ownerId,
              tags: l.tags,
              estimatedValue: l.estimatedValue ? l.estimatedValue.toString() : null,
              nextFollowUpAt: l.nextFollowUpAt?.toISOString() ?? null,
              createdAt: l.createdAt.toISOString(),
              notes: l._count.noteItems,
              archived: l.archived,
            }))}
            members={memberOptions}
            tags={tags.map((t) => ({ id: t.id, name: t.name }))}
            perms={{
              assign: can(ctx.role, "leads:assign"),
              edit: can(ctx.role, "leads:edit"),
            }}
          />
          <Pagination
            basePath="/leads"
            raw={raw}
            current={pg.current}
            pages={pg.pages}
            total={pg.total}
          />
        </>
      )}
    </div>
  );
}
