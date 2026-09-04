import { NextRequest } from "next/server";

import { getAuthContext } from "@/lib/context";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { toCsv, csvResponse } from "@/lib/crm/csv";
import { LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS } from "@/lib/crm/labels";
import { parseLeadParams, buildLeadWhere, leadOrderBy } from "../query";

const MAX_ROWS = 5000;

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx?.membership || !ctx.activeOrg || !ctx.role) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!can(ctx.role, "leads:view") || !can(ctx.role, "export:data")) {
    return new Response("Forbidden", { status: 403 });
  }

  const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
  const p = parseLeadParams(raw);
  const where = buildLeadWhere(ctx.activeOrg.id, p);

  const leads = await prisma.lead.findMany({
    where,
    orderBy: leadOrderBy(p),
    take: MAX_ROWS,
    include: {
      owner: { select: { name: true } },
      tags: { select: { name: true } },
    },
  });

  const csv = toCsv(leads, [
    { header: "Name", value: (l) => l.name },
    { header: "Company", value: (l) => l.companyName ?? "" },
    { header: "Email", value: (l) => l.email ?? "" },
    { header: "Phone", value: (l) => l.phone ?? "" },
    { header: "WhatsApp", value: (l) => l.whatsapp ?? "" },
    { header: "Website", value: (l) => l.website ?? "" },
    { header: "Status", value: (l) => LEAD_STATUS_LABELS[l.status] },
    { header: "Source", value: (l) => LEAD_SOURCE_LABELS[l.source] },
    { header: "Industry", value: (l) => l.industry ?? "" },
    { header: "Location", value: (l) => l.location ?? "" },
    { header: "Estimated value", value: (l) => (l.estimatedValue ? l.estimatedValue.toString() : "") },
    { header: "Owner", value: (l) => l.owner?.name ?? "" },
    { header: "Tags", value: (l) => l.tags.map((t) => t.name).join("; ") },
    { header: "Next follow-up", value: (l) => (l.nextFollowUpAt ? l.nextFollowUpAt.toISOString().slice(0, 10) : "") },
    { header: "Created", value: (l) => l.createdAt.toISOString() },
  ]);

  await recordAudit({
    action: "lead.export",
    orgId: ctx.activeOrg.id,
    actorId: ctx.user.id,
    metadata: { count: leads.length },
  });

  const date = new Date().toISOString().slice(0, 10);
  return csvResponse(`leads-${date}.csv`, csv);
}
