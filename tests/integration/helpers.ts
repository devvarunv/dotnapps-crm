import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import type { Role } from "@prisma/client";

/**
 * Wipes every application table in the test database. Safe only because
 * tests/setup.ts points DATABASE_URL at a dedicated `dotnapps_crm_test`
 * database — never run against dev/prod data.
 */
export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      AND tablename NOT IN ('_prisma_migrations')
  `;
  if (tables.length === 0) return;
  const names = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${names} CASCADE;`);
}

let seq = 0;
function unique(prefix: string) {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}-${randomBytes(3).toString("hex")}`;
}

/** Create a fresh org with one member of the given role. Returns ids + a plan. */
export async function createTestOrg(role: Role = "OWNER") {
  const email = `${unique("user")}@test.local`;
  const user = await prisma.user.create({
    data: { email, name: "Test User", passwordHash: "not-a-real-hash" },
  });

  const org = await prisma.organization.create({
    data: { name: unique("Org"), slug: unique("org"), createdById: user.id },
  });

  await prisma.membership.create({
    data: { userId: user.id, orgId: org.id, role, status: "ACTIVE" },
  });

  return { user, org };
}

export async function createPlan(limits: Record<string, number> = {}) {
  return prisma.subscriptionPlan.create({
    data: {
      key: unique("plan"),
      name: "Test plan",
      priceCents: 0,
      trialDays: 0,
      limits,
    },
  });
}

export async function createCompany(orgId: string, name = unique("Company")) {
  return prisma.company.create({ data: { orgId, name } });
}

export async function createLead(orgId: string, name = unique("Lead")) {
  return prisma.lead.create({ data: { orgId, name, source: "MANUAL", status: "NEW" } });
}

export async function createPipelineWithStage(orgId: string) {
  const pipeline = await prisma.pipeline.create({
    data: { orgId, name: "Pipeline", isDefault: true },
  });
  const stage = await prisma.pipelineStage.create({
    data: { orgId, pipelineId: pipeline.id, name: "Qualified", position: 0, probability: 10 },
  });
  return { pipeline, stage };
}
