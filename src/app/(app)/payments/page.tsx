import Link from "next/link";
import type { Metadata } from "next";
import { CreditCard } from "lucide-react";

import { checkPermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS } from "@/lib/crm/labels";
import { getInvoiceIntegration } from "@/lib/integrations/invoice";
import { PageHeader } from "@/components/app/page-header";
import { DeniedState } from "@/components/app/denied";
import { EmptyState } from "@/components/app/empty";
import { IntegrationSetupNotice } from "@/components/app/integration-notice";

export const metadata: Metadata = { title: "Payments" };

function money(a: { toString(): string }, currency: string) {
  return Number(a).toLocaleString("en-US", { style: "currency", currency, maximumFractionDigits: 0 });
}

export default async function PaymentsPage() {
  const check = await checkPermission("payments:view");
  if (!check.ok) return <DeniedState />;
  const { ctx } = check;

  const summary = await getInvoiceIntegration(ctx.org.id);
  if (!summary.configured) {
    return (
      <div>
        <PageHeader title="Payments" description="Payment events from Dotnapps Invoice." />
        <IntegrationSetupNotice />
      </div>
    );
  }

  const [rows, total] = await Promise.all([
    prisma.paymentEvent.findMany({
      where: { orgId: ctx.org.id },
      orderBy: { paidAt: "desc" },
      take: 200,
      include: {
        invoice: {
          select: {
            id: true,
            number: true,
            deal: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.paymentEvent.aggregate({
      where: { orgId: ctx.org.id },
      _sum: { amount: true },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Payments"
        description={
          summary.mode === "MOCK"
            ? "Sandbox payment events from the built-in mock provider."
            : "Synchronised from Dotnapps Invoice. Not editable in CRM."
        }
      />

      {rows.length > 0 && (
        <div className="mb-4 rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Total received</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">
            {money(total._sum.amount ?? 0, "USD")}
          </p>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No payments"
          description="Payment events arrive via verified Dotnapps Invoice webhooks."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Method</th>
                <th className="px-3 py-2 font-medium">Reference</th>
                <th className="px-3 py-2 font-medium">Invoice</th>
                <th className="px-3 py-2 font-medium">Deal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/40">
                  <td className="px-3 py-2 text-muted-foreground">{formatDate(r.paidAt)}</td>
                  <td className="px-3 py-2 font-medium tabular-nums">{money(r.amount, r.currency)}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.method
                      ? PAYMENT_METHOD_LABELS[r.method as keyof typeof PAYMENT_METHOD_LABELS]
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.reference ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.invoice.number ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.invoice.deal ? (
                      <Link href={`/deals/${r.invoice.deal.id}`} className="hover:underline">
                        {r.invoice.deal.name}
                      </Link>
                    ) : (
                      "—"
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
