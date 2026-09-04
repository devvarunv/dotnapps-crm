import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { requireOrgContext } from "@/lib/context";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/app/page-header";
import { DeniedState } from "@/components/app/denied";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { CreatePipeline, PipelineCard } from "./pipelines-client";

export const metadata: Metadata = { title: "Pipelines" };

export default async function PipelineSettingsPage() {
  const ctx = await requireOrgContext();
  if (!can(ctx.role, "org:manage")) {
    return <DeniedState message="Only owners and admins manage pipelines." />;
  }

  const pipelines = await prisma.pipeline.findMany({
    where: { orgId: ctx.org.id },
    orderBy: [{ archived: "asc" }, { position: "asc" }],
    include: {
      stages: {
        orderBy: { position: "asc" },
        include: { _count: { select: { deals: true } } },
      },
    },
  });

  return (
    <div>
      <Link href="/settings" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Settings
      </Link>
      <PageHeader
        title="Pipelines & stages"
        description="Define the stages deals move through. Won/Lost stages close a deal."
      />

      <Card className="mb-6">
        <CardHeader><CardTitle>New pipeline</CardTitle></CardHeader>
        <CardContent><CreatePipeline /></CardContent>
      </Card>

      <div className="space-y-4">
        {pipelines.map((p) => (
          <PipelineCard
            key={p.id}
            pipeline={{
              id: p.id,
              name: p.name,
              isDefault: p.isDefault,
              archived: p.archived,
              stages: p.stages.map((s) => ({
                id: s.id,
                name: s.name,
                probability: s.probability,
                kind: s.kind,
                deals: s._count.deals,
              })),
            }}
          />
        ))}
        {pipelines.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No pipelines yet. Create one above — it comes with a default set of stages.
          </p>
        )}
      </div>
    </div>
  );
}
