-- CreateEnum
CREATE TYPE "StageKind" AS ENUM ('OPEN', 'WON', 'LOST');
-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('OPEN', 'WON', 'LOST');
-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('CALL', 'MEETING', 'EMAIL', 'WHATSAPP', 'FOLLOW_UP', 'DEMO', 'NOTE', 'TASK');
-- CreateEnum
CREATE TYPE "ActivitySource" AS ENUM ('MANUAL', 'SYSTEM');
-- DropForeignKey
ALTER TABLE "Note" DROP CONSTRAINT "Note_authorId_fkey";
-- DropForeignKey
ALTER TABLE "Note" DROP CONSTRAINT "Note_companyId_fkey";
-- DropForeignKey
ALTER TABLE "Note" DROP CONSTRAINT "Note_contactId_fkey";
-- DropForeignKey
ALTER TABLE "Note" DROP CONSTRAINT "Note_leadId_fkey";
-- DropForeignKey
ALTER TABLE "Note" DROP CONSTRAINT "Note_orgId_fkey";
-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "convertedDealId" TEXT;
-- DropTable
-- CreateTable
CREATE TABLE "Pipeline" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Pipeline_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "PipelineStage" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "probability" INTEGER NOT NULL DEFAULT 0,
    "kind" "StageKind" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PipelineStage_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "status" "DealStatus" NOT NULL DEFAULT 'OPEN',
    "companyId" TEXT,
    "contactId" TEXT,
    "ownerId" TEXT,
    "value" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "probability" INTEGER,
    "source" "LeadSource",
    "expectedCloseDate" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "winReason" TEXT,
    "lossReason" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "lastActivityAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "assigneeId" TEXT,
    "createdById" TEXT,
    "leadId" TEXT,
    "contactId" TEXT,
    "companyId" TEXT,
    "dealId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "source" "ActivitySource" NOT NULL DEFAULT 'MANUAL',
    "subject" TEXT,
    "body" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "leadId" TEXT,
    "contactId" TEXT,
    "companyId" TEXT,
    "dealId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "_DealTags" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_DealTags_AB_pkey" PRIMARY KEY ("A","B")
);
-- CreateIndex
CREATE INDEX "Pipeline_orgId_archived_idx" ON "Pipeline"("orgId", "archived");
-- CreateIndex
CREATE INDEX "PipelineStage_pipelineId_position_idx" ON "PipelineStage"("pipelineId", "position");
-- CreateIndex
CREATE INDEX "PipelineStage_orgId_idx" ON "PipelineStage"("orgId");
-- CreateIndex
CREATE INDEX "Deal_orgId_archived_idx" ON "Deal"("orgId", "archived");
-- CreateIndex
CREATE INDEX "Deal_orgId_status_idx" ON "Deal"("orgId", "status");
-- CreateIndex
CREATE INDEX "Deal_orgId_ownerId_idx" ON "Deal"("orgId", "ownerId");
-- CreateIndex
CREATE INDEX "Deal_pipelineId_stageId_idx" ON "Deal"("pipelineId", "stageId");
-- CreateIndex
CREATE INDEX "Deal_orgId_expectedCloseDate_idx" ON "Deal"("orgId", "expectedCloseDate");
-- CreateIndex
CREATE INDEX "Task_orgId_status_idx" ON "Task"("orgId", "status");
-- CreateIndex
CREATE INDEX "Task_orgId_assigneeId_status_idx" ON "Task"("orgId", "assigneeId", "status");
-- CreateIndex
CREATE INDEX "Task_orgId_dueAt_idx" ON "Task"("orgId", "dueAt");
-- CreateIndex
CREATE INDEX "Task_dealId_idx" ON "Task"("dealId");
-- CreateIndex
CREATE INDEX "Task_leadId_idx" ON "Task"("leadId");
-- CreateIndex
CREATE INDEX "Task_contactId_idx" ON "Task"("contactId");
-- CreateIndex
CREATE INDEX "Task_companyId_idx" ON "Task"("companyId");
-- CreateIndex
CREATE INDEX "Activity_orgId_occurredAt_idx" ON "Activity"("orgId", "occurredAt");
-- CreateIndex
CREATE INDEX "Activity_dealId_occurredAt_idx" ON "Activity"("dealId", "occurredAt");
-- CreateIndex
CREATE INDEX "Activity_leadId_occurredAt_idx" ON "Activity"("leadId", "occurredAt");
-- CreateIndex
CREATE INDEX "Activity_contactId_occurredAt_idx" ON "Activity"("contactId", "occurredAt");
-- CreateIndex
CREATE INDEX "Activity_companyId_occurredAt_idx" ON "Activity"("companyId", "occurredAt");
-- CreateIndex
CREATE INDEX "_DealTags_B_index" ON "_DealTags"("B");
-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedDealId_fkey" FOREIGN KEY ("convertedDealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Pipeline" ADD CONSTRAINT "Pipeline_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "PipelineStage" ADD CONSTRAINT "PipelineStage_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "PipelineStage" ADD CONSTRAINT "PipelineStage_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "PipelineStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "_DealTags" ADD CONSTRAINT "_DealTags_A_fkey" FOREIGN KEY ("A") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "_DealTags" ADD CONSTRAINT "_DealTags_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data migration: fold existing Note rows into Activity as manual NOTE entries,
-- then drop the Note table.
INSERT INTO "Activity" ("id", "orgId", "type", "source", "body", "occurredAt", "createdById", "leadId", "contactId", "companyId", "createdAt")
SELECT "id", "orgId", 'NOTE'::"ActivityType", 'MANUAL'::"ActivitySource", "body", "createdAt", "authorId", "leadId", "contactId", "companyId", "createdAt"
FROM "Note";

DROP TABLE "Note";
