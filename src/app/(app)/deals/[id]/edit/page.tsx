import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { checkPermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/app/page-header";
import { DeniedState } from "@/components/app/denied";
import { Card, CardContent } from "@/components/ui/primitives";
import { DealForm } from "../../deal-form";
import { loadDealFormData } from "../../form-data";

export const metadata: Metadata = { title: "Edit deal" };

export default async function EditDealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const check = await checkPermission("deals:edit");
  if (!check.ok) return <DeniedState message="Your role can't edit deals." />;

  const [deal, data] = await Promise.all([
    prisma.deal.findFirst({
      where: { id, orgId: check.ctx.org.id },
      include: { tags: { select: { name: true } } },
    }),
    loadDealFormData(check.ctx.org.id),
  ]);
  if (!deal) notFound();

  return (
    <div>
      <Link href={`/deals/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> {deal.name}
      </Link>
      <PageHeader title="Edit deal" />
      <Card>
        <CardContent className="pt-5">
          <DealForm
            mode="edit"
            values={{
              id: deal.id,
              name: deal.name,
              pipelineId: deal.pipelineId,
              stageId: deal.stageId,
              companyId: deal.companyId ?? "",
              contactId: deal.contactId ?? "",
              ownerId: deal.ownerId ?? "",
              value: deal.value ? deal.value.toString() : "",
              currency: deal.currency,
              source: deal.source ?? "",
              expectedCloseDate: deal.expectedCloseDate
                ? deal.expectedCloseDate.toISOString().slice(0, 10)
                : "",
              tags: deal.tags.map((t) => t.name).join(", "),
            }}
            pipelines={data.pipelines}
            members={data.members}
            companies={data.companies}
            contacts={data.contacts}
          />
        </CardContent>
      </Card>
    </div>
  );
}
