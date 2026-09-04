import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { checkPermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/app/page-header";
import { DeniedState } from "@/components/app/denied";
import { Card, CardContent } from "@/components/ui/primitives";
import { LeadForm } from "../../lead-form";

export const metadata: Metadata = { title: "Edit lead" };

export default async function EditLeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const check = await checkPermission("leads:edit");
  if (!check.ok) return <DeniedState message="Your role can't edit leads." />;

  const [lead, members] = await Promise.all([
    prisma.lead.findFirst({
      where: { id, orgId: check.ctx.org.id },
      include: { tags: { select: { name: true } } },
    }),
    prisma.membership.findMany({
      where: { orgId: check.ctx.org.id, status: "ACTIVE" },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
  ]);
  if (!lead) notFound();

  return (
    <div>
      <Link href={`/leads/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> {lead.name}
      </Link>
      <PageHeader title="Edit lead" />
      <Card>
        <CardContent className="pt-5">
          <LeadForm
            mode="edit"
            values={{
              id: lead.id,
              name: lead.name,
              companyName: lead.companyName ?? "",
              email: lead.email ?? "",
              phone: lead.phone ?? "",
              whatsapp: lead.whatsapp ?? "",
              website: lead.website ?? "",
              source: lead.source,
              industry: lead.industry ?? "",
              location: lead.location ?? "",
              status: lead.status,
              estimatedValue: lead.estimatedValue ? lead.estimatedValue.toString() : "",
              nextFollowUpAt: lead.nextFollowUpAt
                ? lead.nextFollowUpAt.toISOString().slice(0, 10)
                : "",
              ownerId: lead.ownerId ?? "",
              tags: lead.tags.map((t) => t.name).join(", "),
            }}
            members={members.map((m) => ({ id: m.user.id, name: m.user.name }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
