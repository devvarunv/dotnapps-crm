import Link from "next/link";
import type { Metadata } from "next";
import { Building2, Download, Plus } from "lucide-react";

import { checkPermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { paginate, buildQuery } from "@/lib/crm/query";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/app/page-header";
import { DeniedState } from "@/components/app/denied";
import { EmptyState } from "@/components/app/empty";
import { ListToolbar } from "@/components/app/list-toolbar";
import { Pagination } from "@/components/app/pagination";
import { TagBadge } from "@/components/app/tag-badge";
import { buttonClassName } from "@/components/ui/button";
import { parseCompanyParams, buildCompanyWhere } from "./query";

export const metadata: Metadata = { title: "Companies" };

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const check = await checkPermission("companies:view");
  if (!check.ok) return <DeniedState />;
  const { ctx } = check;

  const raw = await searchParams;
  const p = parseCompanyParams(raw);
  const where = buildCompanyWhere(ctx.org.id, p);

  const total = await prisma.company.count({ where });
  const pg = paginate(p.page, total);

  const [companies, members, industries, tags] = await Promise.all([
    prisma.company.findMany({
      where,
      orderBy: { [p.sort]: p.dir },
      skip: pg.skip,
      take: pg.take,
      include: {
        owner: { select: { name: true } },
        tags: { select: { id: true, name: true, color: true } },
        _count: { select: { contacts: true } },
      },
    }),
    prisma.membership.findMany({
      where: { orgId: ctx.org.id, status: "ACTIVE" },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.company.findMany({
      where: { orgId: ctx.org.id, industry: { not: null } },
      select: { industry: true },
      distinct: ["industry"],
      orderBy: { industry: "asc" },
      take: 100,
    }),
    prisma.tag.findMany({ where: { orgId: ctx.org.id }, orderBy: { name: "asc" } }),
  ]);

  const canCreate = can(ctx.role, "companies:create");
  const canExport = can(ctx.role, "export:data");

  return (
    <div>
      <PageHeader
        title="Companies"
        description="Accounts that group your contacts and deals."
        actions={
          <>
            {canExport && total > 0 && (
              <Link
                href={`/companies/export${buildQuery(raw, { page: undefined })}`}
                className={buttonClassName({ variant: "outline", size: "sm" })}
                prefetch={false}
              >
                <Download className="size-4" /> Export
              </Link>
            )}
            {canCreate && (
              <Link href="/companies/new" className={buttonClassName({ size: "sm" })}>
                <Plus className="size-4" /> New company
              </Link>
            )}
          </>
        }
      />

      <ListToolbar
        searchPlaceholder="Search name, website, industry…"
        filters={[
          {
            name: "owner",
            label: "Owner",
            options: [
              { value: "unassigned", label: "Unassigned" },
              ...members.map((m) => ({ value: m.user.id, label: m.user.name })),
            ],
          },
          {
            name: "industry",
            label: "Industry",
            options: industries
              .filter((i) => i.industry)
              .map((i) => ({ value: i.industry as string, label: i.industry as string })),
          },
          {
            name: "tag",
            label: "Tag",
            options: tags.map((t) => ({ value: t.id, label: t.name })),
          },
          { name: "archived", label: "Show", options: [{ value: "1", label: "Archived" }] },
        ]}
      />

      {companies.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={total === 0 && !p.q ? "No companies yet" : "No companies match your filters"}
          description={
            total === 0 && !p.q
              ? "Add a company or convert a lead with a company name."
              : "Try clearing the search or filters."
          }
          actionLabel={canCreate && total === 0 ? "New company" : undefined}
          actionHref={canCreate && total === 0 ? "/companies/new" : undefined}
        />
      ) : (
        <>
          <div className="rounded-lg border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Industry</th>
                    <th className="px-3 py-2 font-medium">Contacts</th>
                    <th className="px-3 py-2 font-medium">Owner</th>
                    <th className="px-3 py-2 font-medium">Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {companies.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/40">
                      <td className="px-3 py-2">
                        <Link href={`/companies/${c.id}`} className="font-medium hover:underline">
                          {c.name}
                        </Link>
                        {c.website && (
                          <div className="text-xs text-muted-foreground">{c.website}</div>
                        )}
                        {c.tags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {c.tags.map((t) => (
                              <TagBadge key={t.id} name={t.name} color={t.color} />
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{c.industry ?? "—"}</td>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">
                        {c._count.contacts}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {c.owner?.name ?? "Unassigned"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {formatDate(c.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination basePath="/companies" raw={raw} current={pg.current} pages={pg.pages} total={pg.total} />
        </>
      )}
    </div>
  );
}
