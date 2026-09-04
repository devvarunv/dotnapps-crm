import { NextRequest } from "next/server";

import { getAuthContext } from "@/lib/context";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { toCsv, csvResponse } from "@/lib/crm/csv";
import { DEAL_STATUS_LABELS, LEAD_SOURCE_LABELS } from "@/lib/crm/labels";
import { parseDealParams, buildDealWhere } from "../query";

const MAX_ROWS = 5000;

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx?.membership || !ctx.activeOrg || !ctx.role) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!can(ctx.role, "deals:view") || !can(ctx.role, "export:data")) {
    return new Response("Forbidden", { status: 403 });
  }

  const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
  const p = parseDealParams(raw);
  const where = buildDealWhere(ctx.activeOrg.id, p);

  const deals = await prisma.deal.findMany({
    where,
    orderBy: { [p.sort]: p.dir },
    take: MAX_ROWS,
    include: {
      stage: { select: { name: true } },
      pipeline: { select: { name: true } },
      company: { select: { name: true } },
      contact: { select: { name: true } },
      owner: { select: { name: true } },
      tags: { select: { name: true } },
    },
  });

  const csv = toCsv(deals, [
    { header: "Name", value: (d) => d.name },
    { header: "Pipeline", value: (d) => d.pipeline.name },
    { header: "Stage", value: (d) => d.stage.name },
    { header: "Status", value: (d) => DEAL_STATUS_LABELS[d.status] },
    { header: "Value", value: (d) => (d.value ? d.value.toString() : "") },
    { header: "Currency", value: (d) => d.currency },
    { header: "Probability", value: (d) => (d.probability ?? "") },
    { header: "Company", value: (d) => d.company?.name ?? "" },
    { header: "Contact", value: (d) => d.contact?.name ?? "" },
    { header: "Owner", value: (d) => d.owner?.name ?? "" },
    { header: "Source", value: (d) => (d.source ? LEAD_SOURCE_LABELS[d.source] : "") },
    { header: "Tags", value: (d) => d.tags.map((t) => t.name).join("; ") },
    { header: "Expected close", value: (d) => (d.expectedCloseDate ? d.expectedCloseDate.toISOString().slice(0, 10) : "") },
    { header: "Closed", value: (d) => (d.closedAt ? d.closedAt.toISOString() : "") },
    { header: "Created", value: (d) => d.createdAt.toISOString() },
  ]);

  await recordAudit({
    action: "deal.export",
    orgId: ctx.activeOrg.id,
    actorId: ctx.user.id,
    metadata: { count: deals.length },
  });

  return csvResponse(`deals-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
