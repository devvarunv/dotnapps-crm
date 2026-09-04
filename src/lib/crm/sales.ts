import type { Prisma, PrismaClient, PipelineStage } from "@prisma/client";
import { prisma } from "@/lib/db";

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * The pipeline a new deal lands in by default: the org's `isDefault` pipeline,
 * else the lowest-positioned non-archived one.
 */
export async function getDefaultPipeline(orgId: string) {
  return (
    (await prisma.pipeline.findFirst({
      where: { orgId, archived: false, isDefault: true },
      include: { stages: { orderBy: { position: "asc" } } },
    })) ??
    (await prisma.pipeline.findFirst({
      where: { orgId, archived: false },
      orderBy: { position: "asc" },
      include: { stages: { orderBy: { position: "asc" } } },
    }))
  );
}

/** Deal status + probability implied by a stage. */
export function dealFieldsForStage(stage: Pick<PipelineStage, "kind" | "probability">) {
  return {
    status:
      stage.kind === "WON" ? "WON" : stage.kind === "LOST" ? "LOST" : "OPEN",
    probability: stage.probability,
    closedAt: stage.kind === "OPEN" ? null : new Date(),
  } as const;
}

export type ActivityParent = {
  leadId?: string | null;
  contactId?: string | null;
  companyId?: string | null;
  dealId?: string | null;
};

/** Append an activity and bump the parent deal/lead's lastActivityAt. */
export async function logActivity(
  tx: Tx,
  input: {
    orgId: string;
    type: Prisma.ActivityCreateInput["type"];
    source?: Prisma.ActivityCreateInput["source"];
    subject?: string | null;
    body?: string | null;
    createdById?: string | null;
    occurredAt?: Date;
  } & ActivityParent,
) {
  const {
    orgId,
    type,
    source = "MANUAL",
    subject = null,
    body = null,
    createdById = null,
    occurredAt,
    leadId = null,
    contactId = null,
    companyId = null,
    dealId = null,
  } = input;

  const activity = await tx.activity.create({
    data: {
      orgId,
      type,
      source,
      subject,
      body,
      createdById,
      occurredAt: occurredAt ?? new Date(),
      leadId,
      contactId,
      companyId,
      dealId,
    },
  });

  if (dealId) {
    await tx.deal.update({
      where: { id: dealId },
      data: { lastActivityAt: activity.occurredAt },
    });
  }
  if (leadId) {
    await tx.lead.update({
      where: { id: leadId },
      data: { lastActivityAt: activity.occurredAt },
    });
  }
  return activity;
}

export function formatMoney(value: Prisma.Decimal | null, currency = "USD"): string {
  if (value === null || value === undefined) return "—";
  return Number(value).toLocaleString("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
}
