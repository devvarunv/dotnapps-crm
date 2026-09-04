import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { checkPermission } from "@/lib/context";
import { PageHeader } from "@/components/app/page-header";
import { DeniedState } from "@/components/app/denied";
import { EmptyState } from "@/components/app/empty";
import { Card, CardContent } from "@/components/ui/primitives";
import { Handshake } from "lucide-react";
import { DealForm } from "../deal-form";
import { loadDealFormData } from "../form-data";

export const metadata: Metadata = { title: "New deal" };

export default async function NewDealPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string; contactId?: string }>;
}) {
  const check = await checkPermission("deals:create");
  if (!check.ok) return <DeniedState message="Your role can't create deals." />;

  const { companyId, contactId } = await searchParams;
  const data = await loadDealFormData(check.ctx.org.id);
  const firstPipeline = data.pipelines[0];

  if (!firstPipeline || firstPipeline.stages.length === 0) {
    return (
      <div>
        <PageHeader title="New deal" />
        <EmptyState
          icon={Handshake}
          title="No pipeline configured"
          description="Create a pipeline with at least one stage first."
          actionLabel="Set up a pipeline"
          actionHref="/settings/pipelines"
        />
      </div>
    );
  }

  return (
    <div>
      <Link href="/deals" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Deals
      </Link>
      <PageHeader title="New deal" />
      <Card>
        <CardContent className="pt-5">
          <DealForm
            mode="create"
            values={{
              name: "",
              pipelineId: firstPipeline.id,
              stageId: firstPipeline.stages[0].id,
              companyId: companyId ?? "",
              contactId: contactId ?? "",
              ownerId: check.ctx.user.id,
              value: "",
              currency: "USD",
              source: "",
              expectedCloseDate: "",
              tags: "",
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
