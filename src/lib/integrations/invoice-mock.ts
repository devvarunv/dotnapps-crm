import { randomBytes } from "node:crypto";
import type {
  CreateQuotationInput,
  ProviderQuotation,
  ProviderInvoice,
  ProviderPayment,
} from "./invoice-types";

/**
 * Local, clearly-labelled stand-in for a Dotnapps Invoice account. It returns
 * the same DTOs a real provider would; it holds no state of its own. Every CRM
 * screen that shows MOCK-mode data renders a "sandbox" banner, and no CRM
 * screen ever reports success it did not actually observe.
 */

const id = (p: string) => `mock_${p}_${randomBytes(6).toString("hex")}`;
const seq = () => Math.floor(1000 + Math.random() * 8999);

export function mockCreateQuotation(input: CreateQuotationInput): ProviderQuotation {
  const amount =
    input.amount ??
    (input.lineItems?.reduce((a, li) => a + li.quantity * li.unitPrice, 0) || 5000);
  const now = new Date();
  const expiry = new Date(now.getTime() + 21 * 86_400_000);
  return {
    externalId: id("q"),
    number: `Q-${seq()}`,
    status: "DRAFT",
    amount,
    currency: input.currency || "USD",
    issueDate: now.toISOString(),
    expiryDate: expiry.toISOString(),
    url: null,
  };
}

export function mockAcceptQuotation(q: ProviderQuotation): ProviderQuotation {
  return { ...q, status: "ACCEPTED" };
}

export function mockInvoiceFromQuotation(q: ProviderQuotation): ProviderInvoice {
  const now = new Date();
  return {
    externalId: id("inv"),
    number: `INV-${seq()}`,
    status: "SENT",
    amount: q.amount,
    amountPaid: 0,
    balance: q.amount,
    currency: q.currency,
    issueDate: now.toISOString(),
    dueDate: new Date(now.getTime() + 30 * 86_400_000).toISOString(),
    url: null,
    quotationExternalId: q.externalId,
  };
}

export function mockPaymentForInvoice(
  inv: ProviderInvoice,
  amount?: number,
): { payment: ProviderPayment; invoice: ProviderInvoice } {
  const pay = amount ?? inv.balance;
  const amountPaid = inv.amountPaid + pay;
  const balance = Math.max(0, inv.amount - amountPaid);
  return {
    payment: {
      externalId: id("pay"),
      invoiceExternalId: inv.externalId,
      amount: pay,
      currency: inv.currency,
      method: "BANK_TRANSFER",
      reference: `TXN-${seq()}`,
      paidAt: new Date().toISOString(),
    },
    invoice: {
      ...inv,
      amountPaid,
      balance,
      status: balance === 0 ? "PAID" : "PARTIAL",
    },
  };
}
