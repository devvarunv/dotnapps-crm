import Link from "next/link";
import type { Metadata } from "next";
import { Contact as ContactIcon, Download, Plus } from "lucide-react";

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
import { parseContactParams, buildContactWhere } from "./query";

export const metadata: Metadata = { title: "Contacts" };

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const check = await checkPermission("contacts:view");
  if (!check.ok) return <DeniedState />;
  const { ctx } = check;

  const raw = await searchParams;
  const p = parseContactParams(raw);
  const where = buildContactWhere(ctx.org.id, p);

  const total = await prisma.contact.count({ where });
  const pg = paginate(p.page, total);

  const [contacts, members, companies, tags] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: { [p.sort]: p.dir },
      skip: pg.skip,
      take: pg.take,
      include: {
        owner: { select: { name: true } },
        company: { select: { id: true, name: true } },
        tags: { select: { id: true, name: true, color: true } },
      },
    }),
    prisma.membership.findMany({
      where: { orgId: ctx.org.id, status: "ACTIVE" },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.company.findMany({
      where: { orgId: ctx.org.id, archived: false },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
    prisma.tag.findMany({ where: { orgId: ctx.org.id }, orderBy: { name: "asc" } }),
  ]);

  const canCreate = can(ctx.role, "contacts:create");
  const canExport = can(ctx.role, "export:data");

  return (
    <div>
      <PageHeader
        title="Contacts"
        description="People you sell to."
        actions={
          <>
            {canExport && total > 0 && (
              <Link
                href={`/contacts/export${buildQuery(raw, { page: undefined })}`}
                className={buttonClassName({ variant: "outline", size: "sm" })}
                prefetch={false}
              >
                <Download className="size-4" /> Export
              </Link>
            )}
            {canCreate && (
              <Link href="/contacts/new" className={buttonClassName({ size: "sm" })}>
                <Plus className="size-4" /> New contact
              </Link>
            )}
          </>
        }
      />

      <ListToolbar
        searchPlaceholder="Search name, email, phone…"
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
            name: "company",
            label: "Company",
            options: companies.map((c) => ({ value: c.id, label: c.name })),
          },
          {
            name: "tag",
            label: "Tag",
            options: tags.map((t) => ({ value: t.id, label: t.name })),
          },
          { name: "archived", label: "Show", options: [{ value: "1", label: "Archived" }] },
        ]}
      />

      {contacts.length === 0 ? (
        <EmptyState
          icon={ContactIcon}
          title={total === 0 && !p.q ? "No contacts yet" : "No contacts match your filters"}
          description={
            total === 0 && !p.q
              ? "Add a contact or convert a lead to get started."
              : "Try clearing the search or filters."
          }
          actionLabel={canCreate && total === 0 ? "New contact" : undefined}
          actionHref={canCreate && total === 0 ? "/contacts/new" : undefined}
        />
      ) : (
        <>
          <div className="rounded-lg border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Company</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Owner</th>
                    <th className="px-3 py-2 font-medium">Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {contacts.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/40">
                      <td className="px-3 py-2">
                        <Link href={`/contacts/${c.id}`} className="font-medium hover:underline">
                          {c.name}
                        </Link>
                        {c.title && (
                          <div className="text-xs text-muted-foreground">{c.title}</div>
                        )}
                        {c.tags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {c.tags.map((t) => (
                              <TagBadge key={t.id} name={t.name} color={t.color} />
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {c.company ? (
                          <Link href={`/companies/${c.company.id}`} className="hover:underline">
                            {c.company.name}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{c.email ?? "—"}</td>
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
          <Pagination basePath="/contacts" raw={raw} current={pg.current} pages={pg.pages} total={pg.total} />
        </>
      )}
    </div>
  );
}
