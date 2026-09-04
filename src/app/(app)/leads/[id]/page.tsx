import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pencil, Archive, ArchiveRestore } from "lucide-react";

import { checkPermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";
import { formatMoney } from "@/lib/crm/service";
import { LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS, LEAD_STATUS_TONES } from "@/lib/crm/labels";
import { PageHeader } from "@/components/app/page-header";
import { DeniedState } from "@/components/app/denied";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui/primitives";
import { buttonClassName } from "@/components/ui/button";
import { TagBadge } from "@/components/app/tag-badge";
import { Timeline } from "@/components/app/timeline";
import { logActivityAction } from "@/app/(app)/activities/actions";
import { setLeadArchivedAction } from "../actions";
import { ConvertPanel } from "./convert-panel";

export const metadata: Metadata = { title: "Lead" };

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const check = await checkPermission("leads:view");
  if (!check.ok) return <DeniedState />;
  const { ctx } = check;

  const lead = await prisma.lead.findFirst({
    where: { id, orgId: ctx.org.id },
    include: {
      owner: { select: { name: true } },
      tags: { select: { id: true, name: true, color: true } },
      convertedContact: { select: { id: true, name: true } },
      convertedCompany: { select: { id: true, name: true } },
      convertedDeal: { select: { id: true, name: true } },
      activities: {
        orderBy: { occurredAt: "desc" },
        include: { createdBy: { select: { name: true } } },
      },
    },
  });
  if (!lead) notFound();

  const canEdit = can(ctx.role, "leads:edit");
  const companies = canEdit
    ? await prisma.company.findMany({
        where: { orgId: ctx.org.id, archived: false },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
        take: 100,
      })
    : [];

  const detail: [string, string][] = [
    ["Email", lead.email ?? "—"],
    ["Phone", lead.phone ?? "—"],
    ["WhatsApp", lead.whatsapp ?? "—"],
    ["Website", lead.website ?? "—"],
    ["Source", LEAD_SOURCE_LABELS[lead.source]],
    ["Industry", lead.industry ?? "—"],
    ["Location", lead.location ?? "—"],
    ["Estimated value", formatMoney(lead.estimatedValue)],
    ["Next follow-up", lead.nextFollowUpAt ? formatDate(lead.nextFollowUpAt) : "—"],
    ["Owner", lead.owner?.name ?? "Unassigned"],
    ["Created", formatDate(lead.createdAt)],
  ];

  return (
    <div>
      <Link href="/leads" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Leads
      </Link>

      <PageHeader
        title={lead.name}
        description={lead.companyName ?? undefined}
        actions={
          <>
            {canEdit && (
              <Link href={`/leads/${lead.id}/edit`} className={buttonClassName({ variant: "outline", size: "sm" })}>
                <Pencil className="size-4" /> Edit
              </Link>
            )}
            {canEdit && (
              <form action={setLeadArchivedAction}>
                <input type="hidden" name="id" value={lead.id} />
                <input type="hidden" name="archived" value={(!lead.archived).toString()} />
                <button className={buttonClassName({ variant: "outline", size: "sm" })}>
                  {lead.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                  {lead.archived ? "Unarchive" : "Archive"}
                </button>
              </form>
            )}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={LEAD_STATUS_TONES[lead.status]}>{LEAD_STATUS_LABELS[lead.status]}</Badge>
        {lead.archived && <Badge tone="danger">Archived</Badge>}
        {lead.convertedAt && <Badge tone="success">Converted</Badge>}
        {lead.tags.map((t) => (
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
            <CardHeader><CardTitle>Activity &amp; timeline</CardTitle></CardHeader>
            <CardContent>
              <Timeline
                parentField="leadId"
                parentId={lead.id}
                canAdd={can(ctx.role, "activities:create")}
                logAction={logActivityAction}
                items={lead.activities.map((a) => ({
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
          <Card>
            <CardHeader><CardTitle>Conversion</CardTitle></CardHeader>
            <CardContent>
              {lead.convertedAt ? (
                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    Converted {formatDate(lead.convertedAt)}.
                  </p>
                  {lead.convertedContact && (
                    <Link href={`/contacts/${lead.convertedContact.id}`} className="block text-primary hover:underline">
                      → Contact: {lead.convertedContact.name}
                    </Link>
                  )}
                  {lead.convertedCompany && (
                    <Link href={`/companies/${lead.convertedCompany.id}`} className="block text-primary hover:underline">
                      → Company: {lead.convertedCompany.name}
                    </Link>
                  )}
                  {lead.convertedDeal && (
                    <Link href={`/deals/${lead.convertedDeal.id}`} className="block text-primary hover:underline">
                      → Deal: {lead.convertedDeal.name}
                    </Link>
                  )}
                </div>
              ) : canEdit ? (
                <ConvertPanel
                  leadId={lead.id}
                  leadName={lead.name}
                  companyName={lead.companyName}
                  companies={companies}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Not converted. Requires edit permission.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
