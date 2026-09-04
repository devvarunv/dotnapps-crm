import Link from "next/link";
import type { Metadata } from "next";
import { FileText, ExternalLink } from "lucide-react";

import { checkPermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { filterValue } from "@/lib/crm/query";
import { formatDate } from "@/lib/utils";
import {
  QUOTATION_STATUS_LABELS,
  QUOTATION_STATUS_TONES,
  QUOTATION_STATUSES,
} from "@/lib/crm/labels";
import { getInvoiceIntegration } from "@/lib/integrations/invoice";
import { PageHeader } from "@/components/app/page-header";
import { DeniedState } from "@/components/app/denied";
import { EmptyState } from "@/components/app/empty";
import { ListToolbar } from "@/components/app/list-toolbar";
import { Badge } from "@/components/ui/primitives";
import { IntegrationSetupNotice } from "@/components/app/integration-notice";
import type { QuotationStatus } from "@prisma/client";

export const metadata: Metadata = { title: "Quotations" };

function money(a: { toString(): string } | null, currency: string) {
  if (a == null) return "—";
  return Number(a).toLocaleString("en-US", { style: "currency", currency, maximumFractionDigits: 0 });
}

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const check = await checkPermission("quotations:view");
  if (!check.ok) return <DeniedState />;
  const { ctx } = check;

  const summary = await getInvoiceIntegration(ctx.org.id);
  if (!summary.configured) {
    return (
      <div>
        <PageHeader title="Quotations" description="Quotations tracked through Dotnapps Invoice." />
        <IntegrationSetupNotice />
      </div>
    );
  }

  const raw = await searchParams;
  const q = filterValue(raw, "q");
  const status = filterValue(raw, "status");

  const rows = await prisma.quotationLink.findMany({
    where: {
      orgId: ctx.org.id,
      ...(QUOTATION_STATUSES.includes(status as QuotationStatus)
        ? { status: status as QuotationStatus }
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
  });

  return (
    <div>
      <PageHeader
        title="Quotations"
        description={
          summary.mode === "MOCK"
            ? "Sandbox data from the built-in mock provider."
            : "Tracked through Dotnapps Invoice."
        }
      />
      <ListToolbar
        searchPlaceholder="Search number, deal, company…"
        filters={[
          {
            name: "status",
            label: "Status",
            options: QUOTATION_STATUSES.map((s) => ({ value: s, label: QUOTATION_STATUS_LABELS[s] })),
          },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No quotations"
          description="Create one from a deal's Revenue panel."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Number</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Deal</th>
                <th className="px-3 py-2 font-medium">Expiry</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/40">
                  <td className="px-3 py-2 font-medium">{r.number ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Badge tone={QUOTATION_STATUS_TONES[r.status]}>
                      {QUOTATION_STATUS_LABELS[r.status]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {money(r.amount, r.currency)}
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
                    {r.expiryDate ? formatDate(r.expiryDate) : "—"}
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
