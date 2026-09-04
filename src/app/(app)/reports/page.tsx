import Link from "next/link";
import type { Metadata } from "next";
import { Download } from "lucide-react";

import { checkPermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { buildQuery } from "@/lib/crm/query";
import {
  LEAD_STATUS_LABELS,
  LEAD_SOURCE_LABELS,
} from "@/lib/crm/labels";
import { getInvoiceIntegration } from "@/lib/integrations/invoice";
import { parseReportParams } from "@/lib/reports/query";
import {
  leadMetrics,
  pipelineMetrics,
  dealOutcomeMetrics,
  salespersonMetrics,
  revenueMetrics,
} from "@/lib/reports/metrics";
import { PageHeader } from "@/components/app/page-header";
import { DeniedState } from "@/components/app/denied";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { buttonClassName } from "@/components/ui/button";
import { BarList, StatGrid } from "@/components/app/bar-list";
import { ReportsFilters } from "./reports-filters";

export const metadata: Metadata = { title: "Reports" };

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`);

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const check = await checkPermission("reports:view");
  if (!check.ok) return <DeniedState />;
  const { ctx } = check;

  const raw = await searchParams;
  const { range, ownerId } = parseReportParams(raw);
  const scope = { orgId: ctx.org.id, range, ownerId };

  const [leads, pipeline, outcomes, sellers, integration, members] = await Promise.all([
    leadMetrics(scope),
    pipelineMetrics(scope),
    dealOutcomeMetrics(scope),
    salespersonMetrics(scope),
    getInvoiceIntegration(ctx.org.id),
    prisma.membership.findMany({
      where: { orgId: ctx.org.id, status: "ACTIVE" },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
  ]);
  const revenue = integration.enabled ? await revenueMetrics(scope) : null;

  return (
    <div>
      <PageHeader
        title="Reports"
        description={`${range.label}${ownerId ? " · filtered by owner" : ""} · figures reconcile against source records`}
        actions={
          can(ctx.role, "export:data") ? (
            <Link
              href={`/reports/export${buildQuery(raw, {})}`}
              prefetch={false}
              className={buttonClassName({ variant: "outline", size: "sm" })}
            >
              <Download className="size-4" /> Export
            </Link>
          ) : undefined
        }
      />

      <ReportsFilters members={members.map((m) => ({ id: m.user.id, name: m.user.name }))} />

      <div className="space-y-6">
        {/* Leads */}
        <Card>
          <CardHeader><CardTitle>Leads</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <StatGrid
              stats={[
                { label: "Lead volume", value: String(leads.total) },
                { label: "Converted", value: String(leads.converted) },
                { label: "Conversion rate", value: pct(leads.conversionRate) },
                { label: "Sources used", value: String(leads.bySource.length) },
              ]}
            />
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">By status</h4>
                <BarList
                  items={leads.byStatus
                    .filter((s) => s.count > 0)
                    .map((s) => ({ label: LEAD_STATUS_LABELS[s.status], value: s.count }))}
                />
              </div>
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">By source</h4>
                <BarList
                  items={leads.bySource.map((s) => ({
                    label: LEAD_SOURCE_LABELS[s.source],
                    value: s.count,
                    hint: `${Math.round(s.rate * 100)}% conv`,
                  }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pipeline */}
        <Card>
          <CardHeader><CardTitle>Pipeline</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <StatGrid
              stats={[
                { label: "Open deals", value: String(pipeline.openCount) },
                { label: "Open value", value: money(pipeline.openValue) },
                { label: "Weighted value", value: money(pipeline.weighted), hint: "× probability" },
                { label: "Avg per deal", value: money(pipeline.openCount ? pipeline.openValue / pipeline.openCount : 0) },
              ]}
            />
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Value by stage</h4>
              <BarList
                items={pipeline.byStage.map((s) => ({
                  label: s.stage,
                  value: s.value,
                  hint: `${s.count} deal${s.count === 1 ? "" : "s"}`,
                }))}
                format={money}
              />
            </div>
          </CardContent>
        </Card>

        {/* Deal outcomes */}
        <Card>
          <CardHeader><CardTitle>Won &amp; lost</CardTitle></CardHeader>
          <CardContent>
            <StatGrid
              stats={[
                { label: "Won", value: String(outcomes.wonCount), hint: money(outcomes.wonValue) },
                { label: "Lost", value: String(outcomes.lostCount) },
                { label: "Win rate", value: pct(outcomes.winRate) },
                { label: "Avg deal size", value: money(outcomes.avgSize) },
                {
                  label: "Avg sales cycle",
                  value: outcomes.avgCycleDays === null ? "—" : `${Math.round(outcomes.avgCycleDays)}d`,
                },
                {
                  label: "Closed on time",
                  value: `${outcomes.closedOnTime}/${outcomes.closedOnTime + outcomes.closedLate}`,
                  hint: "vs expected close",
                },
              ]}
            />
          </CardContent>
        </Card>

        {/* Salesperson performance */}
        <Card>
          <CardHeader><CardTitle>Salesperson performance</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Person</th>
                  <th className="px-4 py-2 font-medium">Leads</th>
                  <th className="px-4 py-2 font-medium">Deals won</th>
                  <th className="px-4 py-2 font-medium">Won value</th>
                  <th className="px-4 py-2 font-medium">Open pipeline</th>
                  <th className="px-4 py-2 font-medium">Tasks done</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sellers.map((s) => (
                  <tr key={s.userId}>
                    <td className="px-4 py-2 font-medium">{s.name}</td>
                    <td className="px-4 py-2 tabular-nums">{s.leads}</td>
                    <td className="px-4 py-2 tabular-nums">{s.dealsWon}</td>
                    <td className="px-4 py-2 tabular-nums text-muted-foreground">{money(s.wonValue)}</td>
                    <td className="px-4 py-2 tabular-nums text-muted-foreground">{money(s.openPipeline)}</td>
                    <td className="px-4 py-2 tabular-nums">{s.tasksCompleted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Revenue */}
        <Card>
          <CardHeader><CardTitle>Revenue · Dotnapps Invoice</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            {!revenue ? (
              <p className="text-sm text-muted-foreground">
                Connect Dotnapps Invoice in{" "}
                <Link href="/settings/integrations" className="text-primary hover:underline">
                  settings
                </Link>{" "}
                to see collected revenue, outstanding balances and
                quotation-to-invoice conversion. CRM does not calculate these.
              </p>
            ) : (
              <>
                {integration.mode === "MOCK" && (
                  <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    Sandbox data from the built-in mock provider.
                  </p>
                )}
                <StatGrid
                  stats={[
                    { label: "Collected", value: money(revenue.collected) },
                    { label: "Outstanding", value: money(revenue.outstanding) },
                    {
                      label: "Quote → invoice",
                      value: pct(revenue.quotationToInvoiceRate),
                      hint: `${revenue.quotationsConverted}/${revenue.quotationsInRange}`,
                    },
                    { label: "Customers paid", value: String(revenue.byCustomer.length) },
                  ]}
                />
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Revenue by source</h4>
                    <BarList
                      items={revenue.bySource.map((r) => ({
                        label: LEAD_SOURCE_LABELS[r.source as keyof typeof LEAD_SOURCE_LABELS] ?? r.source,
                        value: r.total,
                      }))}
                      format={money}
                    />
                  </div>
                  <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top customers</h4>
                    <BarList
                      items={revenue.byCustomer.map((r) => ({ label: r.name, value: r.total }))}
                      format={money}
                    />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
