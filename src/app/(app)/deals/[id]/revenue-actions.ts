"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { logActivity } from "@/lib/crm/sales";
import { formValue, type ActionState } from "@/lib/form";
import { guard } from "@/lib/crm/guard";
import {
  getInvoiceIntegration,
  getDecryptedConfig,
  providerCreateQuotation,
} from "@/lib/integrations/invoice";
import {
  upsertQuotationLink,
  processInvoiceEvent,
} from "@/lib/integrations/invoice-sync";
import {
  mockAcceptQuotation,
  mockInvoiceFromQuotation,
  mockPaymentForInvoice,
} from "@/lib/integrations/invoice-mock";
import type {
  ProviderQuotation,
  ProviderInvoice,
} from "@/lib/integrations/invoice-types";

async function loadDeal(orgId: string, dealId: string) {
  return prisma.deal.findFirst({
    where: { id: dealId, orgId },
    include: {
      company: { select: { id: true, name: true } },
      contact: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function createQuotationForDealAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("deals:edit");
  if ("error" in g) return g.error;
  const { ctx } = g;

  const summary = await getInvoiceIntegration(ctx.org.id);
  if (!summary.enabled) {
    return { error: "Connect Dotnapps Invoice in Settings → Integrations first." };
  }

  const deal = await loadDeal(ctx.org.id, formValue(formData, "dealId"));
  if (!deal) return { error: "That deal no longer exists." };

  const cfg = await getDecryptedConfig(ctx.org.id);
  if (!cfg) return { error: "Integration configuration is missing." };

  let quotation: ProviderQuotation;
  try {
    quotation = await providerCreateQuotation(cfg, {
      dealName: deal.name,
      customerName: deal.company?.name ?? deal.contact?.name ?? deal.name,
      customerEmail: deal.contact?.email ?? null,
      currency: deal.currency,
      amount: deal.value ? Number(deal.value) : null,
    });
  } catch (err) {
    return { error: `Provider error: ${(err as Error).message}` };
  }

  await upsertQuotationLink(ctx.org.id, quotation, {
    dealId: deal.id,
    companyId: deal.companyId,
    contactId: deal.contactId,
  });
  await prisma.$transaction((tx) =>
    logActivity(tx, {
      orgId: ctx.org.id,
      type: "NOTE",
      source: "SYSTEM",
      subject: `Quotation ${quotation.number} created via Dotnapps Invoice`,
      dealId: deal.id,
    }),
  );
  await recordAudit({
    action: "integration.quotation.create",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    targetType: "Deal",
    targetId: deal.id,
    metadata: { number: quotation.number, mode: cfg.mode },
  });

  revalidatePath(`/deals/${deal.id}`);
  revalidatePath("/quotations");
  return { ok: true, message: `Quotation ${quotation.number} created (${cfg.mode.toLowerCase()} mode).` };
}

/**
 * MOCK-mode only: drive the sandbox provider through accept → invoice →
 * payment so the webhook-processing path can be exercised without a real
 * Dotnapps Invoice account. Not available in live mode.
 */
export async function simulateInvoiceEventAction(
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("deals:edit");
  if ("error" in g) return g.error;
  const { ctx } = g;

  const cfg = await getDecryptedConfig(ctx.org.id);
  if (!cfg || cfg.mode !== "MOCK") {
    return { error: "Simulation is only available in mock mode." };
  }

  const dealId = formValue(formData, "dealId");
  const scenario = formValue(formData, "scenario");

  const latestQuote = await prisma.quotationLink.findFirst({
    where: { orgId: ctx.org.id, dealId },
    orderBy: { createdAt: "desc" },
  });

  if (scenario === "accept") {
    if (!latestQuote) return { error: "Create a quotation first." };
    const q = (latestQuote.raw as unknown as ProviderQuotation) ?? {
      externalId: latestQuote.externalId,
      number: latestQuote.number ?? "Q",
      status: latestQuote.status,
      amount: latestQuote.amount ? Number(latestQuote.amount) : 0,
      currency: latestQuote.currency,
      issueDate: latestQuote.issueDate?.toISOString() ?? null,
      expiryDate: latestQuote.expiryDate?.toISOString() ?? null,
      url: latestQuote.url,
    };
    const res = await processInvoiceEvent(ctx.org.id, {
      type: "quotation.accepted",
      data: mockAcceptQuotation(q),
    });
    revalidatePath(`/deals/${dealId}`);
    return res.status === "FAILED"
      ? { error: res.detail }
      : { ok: true, message: `Simulated quotation.accepted (${res.status}).` };
  }

  if (scenario === "invoice") {
    if (!latestQuote) return { error: "Create and accept a quotation first." };
    const q = latestQuote.raw as unknown as ProviderQuotation;
    const res = await processInvoiceEvent(ctx.org.id, {
      type: "invoice.created",
      data: mockInvoiceFromQuotation({ ...q, status: "ACCEPTED" }),
    });
    revalidatePath(`/deals/${dealId}`);
    revalidatePath("/invoices");
    return res.status === "FAILED"
      ? { error: res.detail }
      : { ok: true, message: `Simulated invoice.created (${res.status}).` };
  }

  if (scenario === "payment") {
    const invoice = await prisma.invoiceLink.findFirst({
      where: { orgId: ctx.org.id, dealId, status: { in: ["SENT", "PARTIAL", "OVERDUE"] } },
      orderBy: { createdAt: "desc" },
    });
    if (!invoice) return { error: "Create an invoice first." };
    const invDto: ProviderInvoice = {
      externalId: invoice.externalId,
      number: invoice.number ?? "INV",
      status: invoice.status,
      amount: invoice.amount ? Number(invoice.amount) : 0,
      amountPaid: Number(invoice.amountPaid),
      balance: invoice.balance ? Number(invoice.balance) : 0,
      currency: invoice.currency,
      issueDate: invoice.issueDate?.toISOString() ?? null,
      dueDate: invoice.dueDate?.toISOString() ?? null,
      url: invoice.url,
      quotationExternalId: null,
    };
    const { payment, invoice: updated } = mockPaymentForInvoice(invDto);
    await processInvoiceEvent(ctx.org.id, { type: "invoice.updated", data: updated });
    const res = await processInvoiceEvent(ctx.org.id, { type: "payment.recorded", data: payment });
    revalidatePath(`/deals/${dealId}`);
    revalidatePath("/payments");
    revalidatePath("/invoices");
    return res.status === "FAILED"
      ? { error: res.detail }
      : { ok: true, message: `Simulated payment.recorded (${res.status}).` };
  }

  return { error: "Unknown scenario." };
}
