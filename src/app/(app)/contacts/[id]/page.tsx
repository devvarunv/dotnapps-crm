import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pencil, Archive, ArchiveRestore } from "lucide-react";

import { checkPermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";
import { LEAD_SOURCE_LABELS } from "@/lib/crm/labels";
import { PageHeader } from "@/components/app/page-header";
import { DeniedState } from "@/components/app/denied";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui/primitives";
import { buttonClassName } from "@/components/ui/button";
import { TagBadge } from "@/components/app/tag-badge";
import { NoteThread } from "@/components/app/note-thread";
import { addContactNoteAction, setContactArchivedAction } from "../actions";

export const metadata: Metadata = { title: "Contact" };

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const check = await checkPermission("contacts:view");
  if (!check.ok) return <DeniedState />;
  const { ctx } = check;

  const contact = await prisma.contact.findFirst({
    where: { id, orgId: ctx.org.id },
    include: {
      owner: { select: { name: true } },
      company: { select: { id: true, name: true } },
      tags: { select: { id: true, name: true, color: true } },
      convertedFromLeads: { select: { id: true, name: true } },
      noteItems: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { name: true } } },
      },
    },
  });
  if (!contact) notFound();

  const canEdit = can(ctx.role, "contacts:edit");

  const detail: [string, string][] = [
    ["Job title", contact.title ?? "—"],
    ["Email", contact.email ?? "—"],
    ["Phone", contact.phone ?? "—"],
    ["WhatsApp", contact.whatsapp ?? "—"],
    ["Source", contact.source ? LEAD_SOURCE_LABELS[contact.source] : "—"],
    ["Owner", contact.owner?.name ?? "Unassigned"],
    ["Added", formatDate(contact.createdAt)],
  ];

  return (
    <div>
      <Link href="/contacts" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Contacts
      </Link>

      <PageHeader
        title={contact.name}
        description={
          contact.company ? contact.company.name : contact.title ?? undefined
        }
        actions={
          canEdit ? (
            <>
              <Link href={`/contacts/${contact.id}/edit`} className={buttonClassName({ variant: "outline", size: "sm" })}>
                <Pencil className="size-4" /> Edit
              </Link>
              <form action={setContactArchivedAction}>
                <input type="hidden" name="id" value={contact.id} />
                <input type="hidden" name="archived" value={(!contact.archived).toString()} />
                <button className={buttonClassName({ variant: "outline", size: "sm" })}>
                  {contact.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                  {contact.archived ? "Unarchive" : "Archive"}
                </button>
              </form>
            </>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {contact.archived && <Badge tone="danger">Archived</Badge>}
        {contact.company && (
          <Link href={`/companies/${contact.company.id}`}>
            <Badge tone="brand">{contact.company.name}</Badge>
          </Link>
        )}
        {contact.tags.map((t) => (
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
            <CardHeader><CardTitle>Notes & timeline</CardTitle></CardHeader>
            <CardContent>
              <NoteThread
                parentField="contactId"
                parentId={contact.id}
                canAdd={canEdit}
                addAction={addContactNoteAction}
                notes={contact.noteItems.map((n) => ({
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
            <CardHeader><CardTitle>Relationship</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {contact.convertedFromLeads.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground">Converted from lead</p>
                  {contact.convertedFromLeads.map((l) => (
                    <Link key={l.id} href={`/leads/${l.id}`} className="block text-primary hover:underline">
                      {l.name}
                    </Link>
                  ))}
                </div>
              )}
              <p className="text-muted-foreground">
                Deals, quotations, invoices and payments appear here once the
                Sales and Revenue phases are connected.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
