import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb, createTestOrg, createLead, createCompany } from "./helpers";
import { assertCompanyInOrg, resolveOwnerId } from "@/lib/crm/service";
import { buildLeadWhere, parseLeadParams } from "@/app/(app)/leads/query";

describe("tenant isolation / cross-tenant object access (IDOR/BOLA)", () => {
  beforeAll(resetDb);

  it("a lead list scoped to org A never returns org B's leads", async () => {
    const a = await createTestOrg();
    const b = await createTestOrg();
    await createLead(a.org.id, "Only in A");
    await createLead(b.org.id, "Only in B");

    const params = parseLeadParams({});
    const rowsForA = await prisma.lead.findMany({ where: buildLeadWhere(a.org.id, params) });

    expect(rowsForA).toHaveLength(1);
    expect(rowsForA[0].name).toBe("Only in A");
  });

  it("assertCompanyInOrg rejects a company id that belongs to a different org", async () => {
    const a = await createTestOrg();
    const b = await createTestOrg();
    const companyInB = await createCompany(b.org.id);

    await expect(assertCompanyInOrg(a.org.id, companyInB.id)).rejects.toThrow(
      /not found in this workspace/i,
    );

    // The same id succeeds when scoped to its real org.
    await expect(assertCompanyInOrg(b.org.id, companyInB.id)).resolves.toBe(companyInB.id);
  });

  it("resolveOwnerId rejects a user id from another org's membership", async () => {
    const a = await createTestOrg();
    const b = await createTestOrg("SALES");

    await expect(resolveOwnerId(a.org.id, b.user.id)).rejects.toThrow(
      /not a member of this workspace/i,
    );
    await expect(resolveOwnerId(b.org.id, b.user.id)).resolves.toBe(b.user.id);
  });

  it("a direct findFirst scoped by orgId returns null for another org's record", async () => {
    const a = await createTestOrg();
    const b = await createTestOrg();
    const leadInB = await createLead(b.org.id);

    const hit = await prisma.lead.findFirst({ where: { id: leadInB.id, orgId: a.org.id } });
    expect(hit).toBeNull();
  });
});
