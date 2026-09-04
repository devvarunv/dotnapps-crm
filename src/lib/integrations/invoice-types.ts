import type {
  QuotationStatus,
  InvoiceStatus,
  PaymentMethod,
} from "@prisma/client";

/**
 * The wire contract Dotnapps CRM expects from a Dotnapps Invoice provider.
 * A real provider integration or the local mock both produce these shapes;
 * the CRM only ever mirrors them into *Link tables.
 */

export type ProviderQuotation = {
  externalId: string;
  number: string;
  status: QuotationStatus;
  amount: number;
  currency: string;
  issueDate: string | null;
  expiryDate: string | null;
  url: string | null;
};

export type ProviderInvoice = {
  externalId: string;
  number: string;
  status: InvoiceStatus;
  amount: number;
  amountPaid: number;
  balance: number;
  currency: string;
  issueDate: string | null;
  dueDate: string | null;
  url: string | null;
  quotationExternalId: string | null;
};

export type ProviderPayment = {
  externalId: string;
  invoiceExternalId: string;
  amount: number;
  currency: string;
  method: PaymentMethod | null;
  reference: string | null;
  paidAt: string;
};

export type CreateQuotationInput = {
  dealName: string;
  customerName: string;
  customerEmail?: string | null;
  currency: string;
  amount?: number | null;
  lineItems?: { description: string; quantity: number; unitPrice: number }[];
};

export type WebhookEvent =
  | { type: "quotation.updated" | "quotation.accepted" | "quotation.declined"; data: ProviderQuotation }
  | { type: "invoice.created" | "invoice.updated" | "invoice.paid"; data: ProviderInvoice }
  | { type: "payment.recorded"; data: ProviderPayment };

export type ConnectionResult =
  | { ok: true; detail: string }
  | { ok: false; detail: string };
