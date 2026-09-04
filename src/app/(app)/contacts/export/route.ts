import { NextRequest } from "next/server";

import { getAuthContext } from "@/lib/context";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { toCsv, csvResponse } from "@/lib/crm/csv";
import { exportGate } from "@/lib/billing/entitlements";
import { LEAD_SOURCE_LABELS } from "@/lib/crm/labels";
import { parseContactParams, buildContactWhere } from "../query";

const MAX_ROWS = 5000;

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx?.membership || !ctx.activeOrg || !ctx.role) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!can(ctx.role, "contacts:view") || !can(ctx.role, "export:data")) {
    return new Response("Forbidden", { status: 403 });
  }

  const gate = await exportGate(ctx.activeOrg.id);
  if (gate.blocked) return gate.blocked;

  const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
  const p = parseContactParams(raw);
  const where = buildContactWhere(ctx.activeOrg.id, p);

  const contacts = await prisma.contact.findMany({
    where,
    orderBy: { [p.sort]: p.dir },
    take: MAX_ROWS,
    include: {
      owner: { select: { name: true } },
      company: { select: { name: true } },
      tags: { select: { name: true } },
    },
  });

  const csv = toCsv(contacts, [
    { header: "Name", value: (c) => c.name },
    { header: "Title", value: (c) => c.title ?? "" },
    { header: "Email", value: (c) => c.email ?? "" },
    { header: "Phone", value: (c) => c.phone ?? "" },
    { header: "WhatsApp", value: (c) => c.whatsapp ?? "" },
    { header: "Company", value: (c) => c.company?.name ?? "" },
    { header: "Source", value: (c) => (c.source ? LEAD_SOURCE_LABELS[c.source] : "") },
    { header: "Owner", value: (c) => c.owner?.name ?? "" },
    { header: "Tags", value: (c) => c.tags.map((t) => t.name).join("; ") },
    { header: "Added", value: (c) => c.createdAt.toISOString() },
  ]);

  await recordAudit({
    action: "contact.export",
    orgId: ctx.activeOrg.id,
    actorId: ctx.user.id,
    metadata: { count: contacts.length },
  });

  await gate.commit();
  return csvResponse(`contacts-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
