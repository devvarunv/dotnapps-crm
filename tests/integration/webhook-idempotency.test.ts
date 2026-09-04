import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb, createTestOrg } from "./helpers";
import { processInvoiceEvent } from "@/lib/integrations/invoice-sync";
import type { ProviderQuotation, ProviderPayment } from "@/lib/integrations/invoice-types";

describe("Dotnapps Invoice webhook processing", () => {
  beforeAll(resetDb);

  it("upserts a quotation once per externalId, ignoring a duplicate delivery", async () => {
    const { org } = await createTestOrg();
    const quotation: ProviderQuotation = {
      externalId: "ext_q_1",
      number: "Q-1",
      status: "SENT",
      amount: 5000,
      currency: "USD",
      issueDate: new Date().toISOString(),
      expiryDate: null,
      url: null,
    };

    const first = await processInvoiceEvent(org.id, { type: "quotation.updated", data: quotation });
    expect(first.status).toBe("PROCESSED");

    const second = await processInvoiceEvent(org.id, { type: "quotation.updated", data: quotation });
    expect(second.status).toBe("IGNORED");

    const rows = await prisma.quotationLink.findMany({ where: { orgId: org.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("SENT");

    const events = await prisma.integrationEvent.count({ where: { orgId: org.id } });
    expect(events).toBe(1); // the duplicate never got its own event row
  });

  it("rejects a payment for an invoice that doesn't exist yet, without leaving a partial row", async () => {
    const { org } = await createTestOrg();
    const payment: ProviderPayment = {
      externalId: "ext_pay_orphan",
      invoiceExternalId: "does-not-exist",
      amount: 100,
      currency: "USD",
      method: null,
      reference: null,
      paidAt: new Date().toISOString(),
    };

    const result = await processInvoiceEvent(org.id, { type: "payment.recorded", data: payment });
    expect(result.status).toBe("FAILED");

    const payments = await prisma.paymentEvent.count({ where: { orgId: org.id } });
    expect(payments).toBe(0);
  });

  it("scopes quotations to the org the event was received for", async () => {
    const a = await createTestOrg();
    const b = await createTestOrg();
    const quotation: ProviderQuotation = {
      externalId: "ext_q_scoped",
      number: "Q-2",
      status: "DRAFT",
      amount: 1000,
      currency: "USD",
      issueDate: null,
      expiryDate: null,
      url: null,
    };

    await processInvoiceEvent(a.org.id, { type: "quotation.updated", data: quotation });

    const inA = await prisma.quotationLink.count({ where: { orgId: a.org.id } });
    const inB = await prisma.quotationLink.count({ where: { orgId: b.org.id } });
    expect(inA).toBe(1);
    expect(inB).toBe(0);
  });
});
