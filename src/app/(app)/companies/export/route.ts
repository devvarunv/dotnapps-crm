import { NextRequest } from "next/server";

import { getAuthContext } from "@/lib/context";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { toCsv, csvResponse } from "@/lib/crm/csv";
import { exportGate } from "@/lib/billing/entitlements";
import { parseCompanyParams, buildCompanyWhere } from "../query";

const MAX_ROWS = 5000;

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx?.membership || !ctx.activeOrg || !ctx.role) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!can(ctx.role, "companies:view") || !can(ctx.role, "export:data")) {
    return new Response("Forbidden", { status: 403 });
  }

  const gate = await exportGate(ctx.activeOrg.id);
  if (gate.blocked) return gate.blocked;

  const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
  const p = parseCompanyParams(raw);
  const where = buildCompanyWhere(ctx.activeOrg.id, p);

  const companies = await prisma.company.findMany({
    where,
    orderBy: { [p.sort]: p.dir },
    take: MAX_ROWS,
    include: {
      owner: { select: { name: true } },
      tags: { select: { name: true } },
      _count: { select: { contacts: true } },
    },
  });

  const csv = toCsv(companies, [
    { header: "Name", value: (c) => c.name },
    { header: "Website", value: (c) => c.website ?? "" },
    { header: "Industry", value: (c) => c.industry ?? "" },
    { header: "Size", value: (c) => c.size ?? "" },
    { header: "GSTIN", value: (c) => c.gstin ?? "" },
    { header: "Owner", value: (c) => c.owner?.name ?? "" },
    { header: "Contacts", value: (c) => c._count.contacts },
    { header: "Tags", value: (c) => c.tags.map((t) => t.name).join("; ") },
    { header: "Added", value: (c) => c.createdAt.toISOString() },
  ]);

  await recordAudit({
    action: "company.export",
    orgId: ctx.activeOrg.id,
    actorId: ctx.user.id,
    metadata: { count: companies.length },
  });

  await gate.commit();
  return csvResponse(`companies-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
