"use client";

import { useActionState, useTransition, useState } from "react";

import { IDLE } from "@/lib/form";
import { Button } from "@/components/ui/button";
import { SubmitButton, FormError, FormSuccess } from "@/components/form";
import {
  changePlanAction,
  cancelSubscriptionAction,
  resumeSubscriptionAction,
  simulatePaymentAction,
} from "./actions";

export type PlanCard = {
  key: string;
  name: string;
  price: string;
  description: string | null;
  features: string[];
  current: boolean;
};

export function PlanPicker({ plans }: { plans: PlanCard[] }) {
  const [state, action] = useActionState(changePlanAction, IDLE);
  return (
    <form action={action}>
      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.key}
            className={
              "flex flex-col rounded-lg border p-4 " +
              (p.current ? "border-primary ring-1 ring-primary/20" : "border-border")
            }
          >
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold">{p.name}</h3>
              <span className="text-sm text-muted-foreground">{p.price}</span>
            </div>
            {p.description && (
              <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
            )}
            <ul className="mt-3 flex-1 space-y-1 text-xs text-muted-foreground">
              {p.features.slice(0, 5).map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
            <button
              type="submit"
              name="planKey"
              value={p.key}
              disabled={p.current}
              className={
                "mt-4 h-8 rounded-md text-sm font-medium " +
                (p.current
                  ? "bg-muted text-muted-foreground"
                  : "bg-primary text-primary-foreground hover:bg-primary/90")
              }
            >
              {p.current ? "Current plan" : "Switch"}
            </button>
          </div>
        ))}
      </div>
      <FormError message={state.error} />
      <FormSuccess message={state.ok ? state.message : undefined} />
    </form>
  );
}

export function CancelResume({ cancelAtPeriodEnd }: { cancelAtPeriodEnd: boolean }) {
  return cancelAtPeriodEnd ? (
    <form action={resumeSubscriptionAction}>
      <Button type="submit" variant="outline" size="sm">Resume subscription</Button>
    </form>
  ) : (
    <form
      action={cancelSubscriptionAction}
      onSubmit={(e) => {
        if (!confirm("Cancel at the end of the current period?")) e.preventDefault();
      }}
    >
      <Button type="submit" variant="outline" size="sm">Cancel subscription</Button>
    </form>
  );
}

export function SandboxBilling() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  function run(outcome: string) {
    const fd = new FormData();
    fd.set("outcome", outcome);
    start(async () => {
      const r = await simulatePaymentAction(fd);
      setMsg(r.ok ? (r.message ?? "Done.") : (r.error ?? "Failed."));
    });
  }
  return (
    <div>
      <p className="mb-2 text-xs text-muted-foreground">
        No real payment provider is connected. Use these to exercise the
        billing lifecycle.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="subtle" disabled={pending} onClick={() => run("success")}>
          Simulate successful payment
        </Button>
        <Button size="sm" variant="subtle" disabled={pending} onClick={() => run("fail")}>
          Simulate failed payment
        </Button>
      </div>
      {msg && <p className="mt-2 text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}
