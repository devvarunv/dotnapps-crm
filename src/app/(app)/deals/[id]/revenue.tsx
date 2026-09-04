"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { IDLE, type ActionState } from "@/lib/form";
import { formatDate } from "@/lib/utils";
import {
  QUOTATION_STATUS_LABELS,
  QUOTATION_STATUS_TONES,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_TONES,
  PAYMENT_METHOD_LABELS,
} from "@/lib/crm/labels";
import { Badge, Alert } from "@/components/ui/primitives";
import { Button, buttonClassName } from "@/components/ui/button";
import { SubmitButton, FormError } from "@/components/form";
import type { IntegrationSummary } from "@/lib/integrations/invoice";
import {
  createQuotationForDealAction,
  simulateInvoiceEventAction,
} from "./revenue-actions";

type Money = { amount: string | null; currency: string };

export type QuotationRow = Money & {
  id: string;
  number: string | null;
  status: keyof typeof QUOTATION_STATUS_LABELS;
  expiryDate: string | null;
  url: string | null;
};
export type InvoiceRow = Money & {
  id: string;
  number: string | null;
  status: keyof typeof INVOICE_STATUS_LABELS;
  balance: string | null;
  dueDate: string | null;
  url: string | null;
};
export type PaymentRow = Money & {
  id: string;
  method: string | null;
  reference: string | null;
  paidAt: string;
};

function fmt(m: Money) {
  if (m.amount == null) return "—";
  return Number(m.amount).toLocaleString("en-US", {
    style: "currency",
    currency: m.currency || "USD",
    maximumFractionDigits: 0,
  });
}

export function RevenueCard({
  dealId,
  summary,
  canEdit,
  quotations,
  invoices,
  payments,
}: {
  dealId: string;
  summary: IntegrationSummary;
  canEdit: boolean;
  quotations: QuotationRow[];
  invoices: InvoiceRow[];
  payments: PaymentRow[];
}) {
  const [createState, createAction] = useActionState(createQuotationForDealAction, IDLE);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [simMsg, setSimMsg] = useState<ActionState>(IDLE);

  if (!summary.configured) {
    return (
      <div className="text-sm text-muted-foreground">
        <p>
          Dotnapps Invoice isn&apos;t connected. Quotations, invoices and
          payments will appear here once an admin connects it.
        </p>
        <Link
          href="/settings/integrations"
          className={buttonClassName({ variant: "outline", size: "sm", className: "mt-3" })}
        >
          Set up integration
        </Link>
      </div>
    );
  }

  if (!summary.enabled) {
    return (
      <p className="text-sm text-muted-foreground">
        The Dotnapps Invoice integration is currently{" "}
        <span className="font-medium">{summary.status.toLowerCase()}</span>.
        {summary.lastError ? ` (${summary.lastError})` : ""}
      </p>
    );
  }

  function sim(scenario: string) {
    const fd = new FormData();
    fd.set("dealId", dealId);
    fd.set("scenario", scenario);
    start(async () => {
      const res = await simulateInvoiceEventAction(fd);
      setSimMsg(res);
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {summary.mode === "MOCK" && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Sandbox mode — this data comes from a built-in mock, not a real
          Dotnapps Invoice account.
        </p>
      )}

      <section>
        <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Quotations
        </h4>
        {quotations.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {quotations.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{q.number ?? "—"}</span>
                <Badge tone={QUOTATION_STATUS_TONES[q.status]}>
                  {QUOTATION_STATUS_LABELS[q.status]}
                </Badge>
                <span className="text-muted-foreground">{fmt(q)}</span>
                {q.expiryDate && (
                  <span className="text-xs text-muted-foreground">
                    exp. {formatDate(q.expiryDate)}
                  </span>
                )}
                {q.url && (
                  <a href={q.url} target="_blank" rel="noreferrer" className="text-primary">
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <form action={createAction} className="mt-2">
            <input type="hidden" name="dealId" value={dealId} />
            <SubmitButton size="sm" variant="outline" pendingText="Creating…">
              Create quotation
            </SubmitButton>
            <FormError message={createState.error} />
            {createState.ok && (
              <Alert tone="success" className="mt-2">{createState.message}</Alert>
            )}
          </form>
        )}
      </section>

      <section>
        <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Invoices
        </h4>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{inv.number ?? "—"}</span>
                <Badge tone={INVOICE_STATUS_TONES[inv.status]}>
                  {INVOICE_STATUS_LABELS[inv.status]}
                </Badge>
                <span className="text-muted-foreground">{fmt(inv)}</span>
                <span className="text-xs text-muted-foreground">
                  bal. {fmt({ amount: inv.balance, currency: inv.currency })}
                </span>
                {inv.dueDate && (
                  <span className="text-xs text-muted-foreground">
                    due {formatDate(inv.dueDate)}
                  </span>
                )}
                {inv.url && (
                  <a href={inv.url} target="_blank" rel="noreferrer" className="text-primary">
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Payments
        </h4>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{fmt(p)}</span>
                {p.method && (
                  <span className="text-xs text-muted-foreground">
                    {PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS]}
                  </span>
                )}
                {p.reference && (
                  <span className="text-xs text-muted-foreground">{p.reference}</span>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatDate(p.paidAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {summary.mode === "MOCK" && canEdit && (
        <div className="border-t border-border pt-3">
          <p className="mb-2 text-xs text-muted-foreground">
            Simulate provider webhooks (sandbox only):
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="subtle" disabled={pending} onClick={() => sim("accept")}>
              Accept quotation
            </Button>
            <Button size="sm" variant="subtle" disabled={pending} onClick={() => sim("invoice")}>
              Raise invoice
            </Button>
            <Button size="sm" variant="subtle" disabled={pending} onClick={() => sim("payment")}>
              Record payment
            </Button>
          </div>
          {simMsg.error && <p className="mt-2 text-xs text-destructive">{simMsg.error}</p>}
          {simMsg.ok && <p className="mt-2 text-xs text-emerald-600">{simMsg.message}</p>}
        </div>
      )}
    </div>
  );
}
