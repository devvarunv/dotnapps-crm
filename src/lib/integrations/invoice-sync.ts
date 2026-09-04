import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { logActivity } from "@/lib/crm/sales";
import type {
  ProviderQuotation,
  ProviderInvoice,
  ProviderPayment,
  WebhookEvent,
} from "./invoice-types";

const PROVIDER = "DOTNAPPS_INVOICE" as const;

type ProcessResult = { status: "PROCESSED" | "IGNORED" | "FAILED"; detail: string };

/** Mirror a provider quotation into QuotationLink (idempotent on externalId). */
export async function upsertQuotationLink(
  orgId: string,
  q: ProviderQuotation,
  link?: { dealId?: string | null; companyId?: string | null; contactId?: string | null },
) {
  const data = {
    number: q.number,
    status: q.status as Prisma.QuotationLinkCreateInput["status"],
    amount: q.amount != null ? new Prisma.Decimal(q.amount) : null,
    currency: q.currency,
    issueDate: q.issueDate ? new Date(q.issueDate) : null,
    expiryDate: q.expiryDate ? new Date(q.expiryDate) : null,
    url: q.url,
    raw: q as unknown as Prisma.InputJsonValue,
  };
  return prisma.quotationLink.upsert({
    where: { orgId_provider_externalId: { orgId, provider: PROVIDER, externalId: q.externalId } },
    create: {
      orgId,
      provider: PROVIDER,
      externalId: q.externalId,
      ...data,
      dealId: link?.dealId ?? null,
      companyId: link?.companyId ?? null,
      contactId: link?.contactId ?? null,
    },
    update: {
      ...data,
      ...(link?.dealId ? { dealId: link.dealId } : {}),
      ...(link?.companyId ? { companyId: link.companyId } : {}),
    },
  });
}

export async function upsertInvoiceLink(orgId: string, inv: ProviderInvoice) {
  const quotation = inv.quotationExternalId
    ? await prisma.quotationLink.findUnique({
        where: {
          orgId_provider_externalId: { orgId, provider: PROVIDER, externalId: inv.quotationExternalId },
        },
        select: { id: true, dealId: true, companyId: true },
      })
    : null;

  const data = {
    number: inv.number,
    status: inv.status as Prisma.InvoiceLinkCreateInput["status"],
    amount: inv.amount != null ? new Prisma.Decimal(inv.amount) : null,
    amountPaid: new Prisma.Decimal(inv.amountPaid ?? 0),
    balance: inv.balance != null ? new Prisma.Decimal(inv.balance) : null,
    currency: inv.currency,
    issueDate: inv.issueDate ? new Date(inv.issueDate) : null,
    dueDate: inv.dueDate ? new Date(inv.dueDate) : null,
    url: inv.url,
    raw: inv as unknown as Prisma.InputJsonValue,
  };

  return prisma.invoiceLink.upsert({
    where: { orgId_provider_externalId: { orgId, provider: PROVIDER, externalId: inv.externalId } },
    create: {
      orgId,
      provider: PROVIDER,
      externalId: inv.externalId,
      ...data,
      quotationLinkId: quotation?.id ?? null,
      dealId: quotation?.dealId ?? null,
      companyId: quotation?.companyId ?? null,
    },
    update: data,
  });
}

export async function upsertPaymentEvent(orgId: string, p: ProviderPayment) {
  const invoice = await prisma.invoiceLink.findUnique({
    where: {
      orgId_provider_externalId: { orgId, provider: PROVIDER, externalId: p.invoiceExternalId },
    },
    select: { id: true },
  });
  if (!invoice) throw new Error(`No invoice ${p.invoiceExternalId} to attach payment to.`);

  return prisma.paymentEvent.upsert({
    where: { orgId_provider_externalId: { orgId, provider: PROVIDER, externalId: p.externalId } },
    create: {
      orgId,
      provider: PROVIDER,
      externalId: p.externalId,
      invoiceLinkId: invoice.id,
      amount: new Prisma.Decimal(p.amount),
      currency: p.currency,
      method: (p.method ?? null) as Prisma.PaymentEventCreateInput["method"],
      reference: p.reference,
      paidAt: new Date(p.paidAt),
      raw: p as unknown as Prisma.InputJsonValue,
    },
    update: {
      amount: new Prisma.Decimal(p.amount),
      method: (p.method ?? null) as Prisma.PaymentEventCreateInput["method"],
      reference: p.reference,
      paidAt: new Date(p.paidAt),
    },
  });
}

/** When a quotation is accepted, optionally nudge the deal to the next open stage. */
async function maybeAdvanceStage(orgId: string, dealId: string) {
  const integration = await prisma.integration.findUnique({
    where: { orgId_provider: { orgId, provider: PROVIDER } },
    select: { advanceStageOnAccept: true },
  });
  if (!integration?.advanceStageOnAccept) return;

  const deal = await prisma.deal.findFirst({
    where: { id: dealId, orgId, status: "OPEN" },
    include: { stage: true, pipeline: { include: { stages: { orderBy: { position: "asc" } } } } },
  });
  if (!deal) return;

  const stages = deal.pipeline.stages.filter((s) => s.kind === "OPEN");
  const idx = stages.findIndex((s) => s.id === deal.stageId);
  const next = idx >= 0 ? stages[idx + 1] : undefined;
  if (!next) return;

  await prisma.$transaction(async (tx) => {
    await tx.deal.update({
      where: { id: deal.id },
      data: { stageId: next.id, probability: next.probability },
    });
    await logActivity(tx, {
      orgId,
      type: "NOTE",
      source: "SYSTEM",
      subject: `Stage advanced to ${next.name} (quotation accepted)`,
      dealId: deal.id,
    });
  });

  const { onDealStageChanged } = await import("@/lib/automation/engine");
  await onDealStageChanged({
    orgId,
    dealId: deal.id,
    dealName: deal.name,
    toStageId: next.id,
    toStageName: next.name,
    ownerId: deal.ownerId,
  });
}

/**
 * Apply one provider event. Idempotent: a repeated (eventType, externalId)
 * is recorded and skipped. Returns a status for the caller / IntegrationEvent.
 */
export async function processInvoiceEvent(
  orgId: string,
  event: WebhookEvent,
): Promise<ProcessResult> {
  const externalId = event.data.externalId;

  const already = await prisma.integrationEvent.findUnique({
    where: {
      orgId_provider_eventType_externalId: {
        orgId,
        provider: PROVIDER,
        eventType: event.type,
        externalId,
      },
    },
  });
  if (already) return { status: "IGNORED", detail: "Duplicate event" };

  let result: ProcessResult;
  try {
    if (event.type.startsWith("quotation.")) {
      const q = event.data as ProviderQuotation;
      const link = await upsertQuotationLink(orgId, q);
      if (event.type === "quotation.accepted" && link.dealId) {
        await logActivity(prisma, {
          orgId,
          type: "NOTE",
          source: "SYSTEM",
          subject: `Quotation ${q.number} accepted`,
          dealId: link.dealId,
        });
        await maybeAdvanceStage(orgId, link.dealId);
      }
      result = { status: "PROCESSED", detail: `Quotation ${q.number} → ${q.status}` };
    } else if (event.type.startsWith("invoice.")) {
      const inv = event.data as ProviderInvoice;
      const link = await upsertInvoiceLink(orgId, inv);
      if (link.dealId) {
        await logActivity(prisma, {
          orgId,
          type: "NOTE",
          source: "SYSTEM",
          subject: `Invoice ${inv.number} → ${inv.status}`,
          dealId: link.dealId,
        });
      }
      result = { status: "PROCESSED", detail: `Invoice ${inv.number} → ${inv.status}` };
    } else {
      const p = event.data as ProviderPayment;
      const pay = await upsertPaymentEvent(orgId, p);
      const invoice = await prisma.invoiceLink.findUnique({
        where: { id: pay.invoiceLinkId },
        select: { dealId: true, number: true },
      });
      if (invoice?.dealId) {
        await logActivity(prisma, {
          orgId,
          type: "NOTE",
          source: "SYSTEM",
          subject: `Payment ${p.currency} ${p.amount} recorded on ${invoice.number}`,
          dealId: invoice.dealId,
        });
      }
      result = { status: "PROCESSED", detail: `Payment ${p.reference ?? p.externalId}` };
    }
  } catch (err) {
    result = { status: "FAILED", detail: (err as Error).message };
  }

  await prisma.integrationEvent.create({
    data: {
      orgId,
      provider: PROVIDER,
      eventType: event.type,
      externalId,
      status: result.status,
      error: result.status === "FAILED" ? result.detail : null,
      payload: event as unknown as Prisma.InputJsonValue,
    },
  });

  if (result.status !== "FAILED") {
    await recordAudit({
      action: `integration.${event.type}`,
      orgId,
      metadata: { detail: result.detail },
    });
  }

  return result;
}
