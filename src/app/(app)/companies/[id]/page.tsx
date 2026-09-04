import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pencil, Archive, ArchiveRestore, Plus } from "lucide-react";

import { checkPermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/app/page-header";
import { DeniedState } from "@/components/app/denied";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui/primitives";
import { buttonClassName } from "@/components/ui/button";
import { TagBadge } from "@/components/app/tag-badge";
import { NoteThread } from "@/components/app/note-thread";
import { addCompanyNoteAction, setCompanyArchivedAction } from "../actions";
import { Addresses } from "./addresses";

export const metadata: Metadata = { title: "Company" };

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const check = await checkPermission("companies:view");
  if (!check.ok) return <DeniedState />;
  const { ctx } = check;

  const company = await prisma.company.findFirst({
    where: { id, orgId: ctx.org.id },
    include: {
      owner: { select: { name: true } },
      tags: { select: { id: true, name: true, color: true } },
      addresses: { orderBy: { kind: "asc" } },
      contacts: {
        where: { archived: false },
        orderBy: { name: "asc" },
        select: { id: true, name: true, title: true, email: true },
      },
      noteItems: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { name: true } } },
      },
    },
  });
  if (!company) notFound();

  const canEdit = can(ctx.role, "companies:edit");
  const canAddContact = can(ctx.role, "contacts:create");

  const detail: [string, string][] = [
    ["Website", company.website ?? "—"],
    ["Industry", company.industry ?? "—"],
    ["Size", company.size ?? "—"],
    ["GSTIN", company.gstin ?? "—"],
    ["Owner", company.owner?.name ?? "Unassigned"],
    ["Added", formatDate(company.createdAt)],
  ];

  return (
    <div>
      <Link href="/companies" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Companies
      </Link>

      <PageHeader
        title={company.name}
        description={company.website ?? undefined}
        actions={
          canEdit ? (
            <>
              <Link href={`/companies/${company.id}/edit`} className={buttonClassName({ variant: "outline", size: "sm" })}>
                <Pencil className="size-4" /> Edit
              </Link>
              <form action={setCompanyArchivedAction}>
                <input type="hidden" name="id" value={company.id} />
                <input type="hidden" name="archived" value={(!company.archived).toString()} />
                <button className={buttonClassName({ variant: "outline", size: "sm" })}>
                  {company.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                  {company.archived ? "Unarchive" : "Archive"}
                </button>
              </form>
            </>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {company.archived && <Badge tone="danger">Archived</Badge>}
        {company.tags.map((t) => (
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
              <CardTitle>Contacts ({company.contacts.length})</CardTitle>
              {canAddContact && (
                <Link
                  href={`/contacts/new?companyId=${company.id}`}
                  className={buttonClassName({ variant: "outline", size: "sm" })}
                >
                  <Plus className="size-4" /> Add
                </Link>
              )}
            </CardHeader>
            <CardContent>
              {company.contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No contacts linked yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {company.contacts.map((c) => (
                    <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                      <Link href={`/contacts/${c.id}`} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {c.title || c.email || ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Notes & timeline</CardTitle></CardHeader>
            <CardContent>
              <NoteThread
                parentField="companyId"
                parentId={company.id}
                canAdd={canEdit}
                addAction={addCompanyNoteAction}
                notes={company.noteItems.map((n) => ({
                  id: n.id,
                  body: n.body,
                  author: n.author?.name ?? null,
                  createdAt: n.createdAt.toISOString(),
                }))}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Addresses</CardTitle></CardHeader>
            <CardContent>
              <Addresses
                companyId={company.id}
                canEdit={canEdit}
                addresses={company.addresses.map((a) => ({
                  id: a.id,
                  kind: a.kind,
                  line1: a.line1,
                  line2: a.line2,
                  city: a.city,
                  state: a.state,
                  postalCode: a.postalCode,
                  country: a.country,
                }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Financials</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Totals from Dotnapps Invoice appear here once the Revenue
                integration is connected. CRM does not calculate them.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
