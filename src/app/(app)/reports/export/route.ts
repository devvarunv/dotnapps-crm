import { NextRequest } from "next/server";

import { getAuthContext } from "@/lib/context";
import { can } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";
import { toCsv, csvResponse } from "@/lib/crm/csv";
import { parseReportParams } from "@/lib/reports/query";
import { salespersonMetrics } from "@/lib/reports/metrics";

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx?.membership || !ctx.activeOrg || !ctx.role) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!can(ctx.role, "reports:view") || !can(ctx.role, "export:data")) {
    return new Response("Forbidden", { status: 403 });
  }

  const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
  const { range, ownerId } = parseReportParams(raw);
  const rows = await salespersonMetrics({ orgId: ctx.activeOrg.id, range, ownerId });

  const csv = toCsv(rows, [
    { header: "Person", value: (r) => r.name },
    { header: "Leads", value: (r) => r.leads },
    { header: "Deals won", value: (r) => r.dealsWon },
    { header: "Won value", value: (r) => r.wonValue },
    { header: "Open pipeline", value: (r) => r.openPipeline },
    { header: "Tasks completed", value: (r) => r.tasksCompleted },
  ]);

  await recordAudit({
    action: "report.export",
    orgId: ctx.activeOrg.id,
    actorId: ctx.user.id,
    metadata: { report: "salesperson", range: range.key },
  });

  return csvResponse(
    `salesperson-report-${range.key}-${new Date().toISOString().slice(0, 10)}.csv`,
    csv,
  );
}
