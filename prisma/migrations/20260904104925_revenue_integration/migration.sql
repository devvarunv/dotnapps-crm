-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('DOTNAPPS_INVOICE');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('NOT_CONFIGURED', 'CONNECTED', 'ERROR', 'DISABLED');

-- CreateEnum
CREATE TYPE "IntegrationMode" AS ENUM ('LIVE', 'MOCK');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIAL', 'PAID', 'OVERDUE', 'VOID');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'BANK_TRANSFER', 'CASH', 'CHEQUE', 'UPI', 'OTHER');

-- CreateEnum
CREATE TYPE "IntegrationEventStatus" AS ENUM ('PROCESSED', 'IGNORED', 'FAILED');

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL DEFAULT 'DOTNAPPS_INVOICE',
    "status" "IntegrationStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
    "mode" "IntegrationMode" NOT NULL DEFAULT 'MOCK',
    "baseUrl" TEXT,
    "apiKeyCiphertext" TEXT,
    "webhookSecretCiphertext" TEXT,
    "advanceStageOnAccept" BOOLEAN NOT NULL DEFAULT true,
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationLink" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL DEFAULT 'DOTNAPPS_INVOICE',
    "externalId" TEXT NOT NULL,
    "number" TEXT,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "amount" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "url" TEXT,
    "dealId" TEXT,
    "companyId" TEXT,
    "contactId" TEXT,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuotationLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLink" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL DEFAULT 'DOTNAPPS_INVOICE',
    "externalId" TEXT NOT NULL,
    "number" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "amount" DECIMAL(14,2),
    "amountPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "issueDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "url" TEXT,
    "dealId" TEXT,
    "companyId" TEXT,
    "quotationLinkId" TEXT,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL DEFAULT 'DOTNAPPS_INVOICE',
    "externalId" TEXT NOT NULL,
    "invoiceLinkId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "method" "PaymentMethod",
    "reference" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationEvent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL DEFAULT 'DOTNAPPS_INVOICE',
    "eventType" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "status" "IntegrationEventStatus" NOT NULL DEFAULT 'PROCESSED',
    "error" TEXT,
    "payload" JSONB,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Integration_orgId_provider_key" ON "Integration"("orgId", "provider");

-- CreateIndex
CREATE INDEX "QuotationLink_orgId_status_idx" ON "QuotationLink"("orgId", "status");

-- CreateIndex
CREATE INDEX "QuotationLink_dealId_idx" ON "QuotationLink"("dealId");

-- CreateIndex
CREATE INDEX "QuotationLink_companyId_idx" ON "QuotationLink"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "QuotationLink_orgId_provider_externalId_key" ON "QuotationLink"("orgId", "provider", "externalId");

-- CreateIndex
CREATE INDEX "InvoiceLink_orgId_status_idx" ON "InvoiceLink"("orgId", "status");

-- CreateIndex
CREATE INDEX "InvoiceLink_dealId_idx" ON "InvoiceLink"("dealId");

-- CreateIndex
CREATE INDEX "InvoiceLink_companyId_idx" ON "InvoiceLink"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceLink_orgId_provider_externalId_key" ON "InvoiceLink"("orgId", "provider", "externalId");

-- CreateIndex
CREATE INDEX "PaymentEvent_orgId_paidAt_idx" ON "PaymentEvent"("orgId", "paidAt");

-- CreateIndex
CREATE INDEX "PaymentEvent_invoiceLinkId_idx" ON "PaymentEvent"("invoiceLinkId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_orgId_provider_externalId_key" ON "PaymentEvent"("orgId", "provider", "externalId");

-- CreateIndex
CREATE INDEX "IntegrationEvent_orgId_receivedAt_idx" ON "IntegrationEvent"("orgId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationEvent_orgId_provider_eventType_externalId_key" ON "IntegrationEvent"("orgId", "provider", "eventType", "externalId");

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationLink" ADD CONSTRAINT "QuotationLink_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationLink" ADD CONSTRAINT "QuotationLink_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationLink" ADD CONSTRAINT "QuotationLink_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationLink" ADD CONSTRAINT "QuotationLink_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLink" ADD CONSTRAINT "InvoiceLink_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLink" ADD CONSTRAINT "InvoiceLink_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLink" ADD CONSTRAINT "InvoiceLink_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLink" ADD CONSTRAINT "InvoiceLink_quotationLinkId_fkey" FOREIGN KEY ("quotationLinkId") REFERENCES "QuotationLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_invoiceLinkId_fkey" FOREIGN KEY ("invoiceLinkId") REFERENCES "InvoiceLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationEvent" ADD CONSTRAINT "IntegrationEvent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
