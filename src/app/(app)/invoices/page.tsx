import Link from "next/link";
import type { Metadata } from "next";
import { ReceiptText, ExternalLink } from "lucide-react";

import { checkPermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { filterValue } from "@/lib/crm/query";
import { formatDate } from "@/lib/utils";
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_TONES,
  INVOICE_STATUSES,
} from "@/lib/crm/labels";
import { getInvoiceIntegration } from "@/lib/integrations/invoice";
import { PageHeader } from "@/components/app/page-header";
import { DeniedState } from "@/components/app/denied";
import { EmptyState } from "@/components/app/empty";
import { ListToolbar } from "@/components/app/list-toolbar";
import { Badge } from "@/components/ui/primitives";
import { IntegrationSetupNotice } from "@/components/app/integration-notice";
import type { InvoiceStatus } from "@prisma/client";

export const metadata: Metadata = { title: "Invoices" };

function money(a: { toString(): string } | null, currency: string) {
  if (a == null) return "—";
  return Number(a).toLocaleString("en-US", { style: "currency", currency, maximumFractionDigits: 0 });
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const check = await checkPermission("invoices:view");
  if (!check.ok) return <DeniedState />;
  const { ctx } = check;

  const summary = await getInvoiceIntegration(ctx.org.id);
  if (!summary.configured) {
    return (
      <div>
        <PageHeader title="Invoices" description="Invoices from Dotnapps Invoice." />
        <IntegrationSetupNotice />
      </div>
    );
  }

  const raw = await searchParams;
  const q = filterValue(raw, "q");
  const status = filterValue(raw, "status");

  const [rows, totals] = await Promise.all([
    prisma.invoiceLink.findMany({
      where: {
        orgId: ctx.org.id,
        ...(INVOICE_STATUSES.includes(status as InvoiceStatus)
          ? { status: status as InvoiceStatus }
          : {}),
        ...(q
          ? {
              OR: [
                { number: { contains: q, mode: "insensitive" } },
                { deal: { name: { contains: q, mode: "insensitive" } } },
                { company: { name: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        deal: { select: { id: true, name: true } },
        company: { select: { id: true, name: true } },
      },
    }),
    prisma.invoiceLink.aggregate({
      where: { orgId: ctx.org.id, status: { notIn: ["VOID", "DRAFT"] } },
      _sum: { amount: true, amountPaid: true, balance: true },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Invoices"
        description={
          summary.mode === "MOCK"
            ? "Sandbox data — Dotnapps Invoice remains the source of truth in live mode."
            : "Read-only. Dotnapps Invoice is the source of truth for amounts and status."
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        {[
          ["Billed", totals._sum.amount],
          ["Collected", totals._sum.amountPaid],
          ["Outstanding", totals._sum.balance],
        ].map(([label, val]) => (
          <div key={label as string} className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">{label as string}</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">
              {money(val as { toString(): string } | null, "USD")}
            </p>
          </div>
        ))}
      </div>

      <ListToolbar
        searchPlaceholder="Search number, deal, company…"
        filters={[
          {
            name: "status",
            label: "Status",
            options: INVOICE_STATUSES.map((s) => ({ value: s, label: INVOICE_STATUS_LABELS[s] })),
          },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="No invoices"
          description="Invoices appear once Dotnapps Invoice raises them for a deal."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Number</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Balance</th>
                <th className="px-3 py-2 font-medium">Deal</th>
                <th className="px-3 py-2 font-medium">Due</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/40">
                  <td className="px-3 py-2 font-medium">{r.number ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Badge tone={INVOICE_STATUS_TONES[r.status]}>
                      {INVOICE_STATUS_LABELS[r.status]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {money(r.amount, r.currency)}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {money(r.balance, r.currency)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.deal ? (
                      <Link href={`/deals/${r.deal.id}`} className="hover:underline">
                        {r.deal.name}
                      </Link>
                    ) : (
                      r.company?.name ?? "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.dueDate ? formatDate(r.dueDate) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noreferrer" className="text-primary">
                        <ExternalLink className="ml-auto size-4" />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
