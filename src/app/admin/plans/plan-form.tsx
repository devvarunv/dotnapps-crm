"use client";

import { useActionState, useState } from "react";

import { IDLE } from "@/lib/form";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/primitives";
import { SubmitButton, FormError, FormSuccess } from "@/components/form";
import { Button } from "@/components/ui/button";
import { savePlanAction } from "../actions";

export type PlanRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  priceCents: number;
  interval: string;
  trialDays: number;
  isPublic: boolean;
  isDefault: boolean;
  active: boolean;
  sortOrder: number;
  features: string[];
  limits: Record<string, number>;
};

function Form({ plan, onDone }: { plan?: PlanRow; onDone?: () => void }) {
  const [state, action] = useActionState(savePlanAction, IDLE);
  return (
    <form action={action} className="space-y-3">
      {plan && <input type="hidden" name="id" value={plan.id} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Key" htmlFor="key" error={state.fieldErrors?.key}>
          <Input name="key" defaultValue={plan?.key ?? ""} placeholder="growth" required />
        </Field>
        <Field label="Name" htmlFor="name" error={state.fieldErrors?.name}>
          <Input name="name" defaultValue={plan?.name ?? ""} required />
        </Field>
        <Field label="Sort order" htmlFor="sortOrder">
          <Input name="sortOrder" type="number" defaultValue={plan?.sortOrder ?? 0} />
        </Field>
        <Field label="Price (cents / period)" htmlFor="priceCents">
          <Input name="priceCents" type="number" defaultValue={plan?.priceCents ?? 0} />
        </Field>
        <Field label="Interval" htmlFor="interval">
          <Select name="interval" defaultValue={plan?.interval ?? "MONTHLY"}>
            <option value="MONTHLY">Monthly</option>
            <option value="YEARLY">Yearly</option>
          </Select>
        </Field>
        <Field label="Trial days" htmlFor="trialDays">
          <Input name="trialDays" type="number" defaultValue={plan?.trialDays ?? 14} />
        </Field>
      </div>
      <Field label="Description" htmlFor="description">
        <Input name="description" defaultValue={plan?.description ?? ""} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Features (one per line)" htmlFor="features">
          <Textarea name="features" rows={4} defaultValue={(plan?.features ?? []).join("\n")} />
        </Field>
        <Field
          label="Limits (metric: number per line)"
          htmlFor="limits"
          hint="users, leads, contacts, companies, deals, automationRules, integrations, exportsPerMonth"
        >
          <Textarea
            name="limits"
            rows={4}
            defaultValue={Object.entries(plan?.limits ?? {}).map(([k, v]) => `${k}: ${v}`).join("\n")}
          />
        </Field>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" name="isPublic" defaultChecked={plan?.isPublic ?? true} /> Public
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" name="isDefault" defaultChecked={plan?.isDefault ?? false} /> Default (new orgs)
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" name="active" defaultChecked={plan?.active ?? true} /> Active
        </label>
      </div>
      <FormError message={state.error} />
      <FormSuccess message={state.ok ? state.message : undefined} />
      <div className="flex gap-2">
        <SubmitButton size="sm" pendingText="Saving…">{plan ? "Save plan" : "Create plan"}</SubmitButton>
        {onDone && <Button type="button" variant="ghost" size="sm" onClick={onDone}>Cancel</Button>}
      </div>
    </form>
  );
}

export function CreatePlan() {
  return <Form />;
}

export function PlanRowItem({ plan }: { plan: PlanRow }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <li className="p-4">
        <Form plan={plan} onDone={() => setEditing(false)} />
      </li>
    );
  }
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
      <code className="text-xs">{plan.key}</code>
      <span className="font-medium">{plan.name}</span>
      <span className="text-muted-foreground">
        {plan.priceCents === 0 ? "Free" : `$${(plan.priceCents / 100).toFixed(0)}/${plan.interval === "YEARLY" ? "yr" : "mo"}`}
      </span>
      {plan.isDefault && <span className="rounded bg-primary/10 px-1.5 text-xs text-primary">default</span>}
      {!plan.isPublic && <span className="rounded bg-muted px-1.5 text-xs text-muted-foreground">private</span>}
      {!plan.active && <span className="rounded bg-muted px-1.5 text-xs text-muted-foreground">inactive</span>}
      <span className="text-xs text-muted-foreground">
        {Object.entries(plan.limits).map(([k, v]) => `${k}:${v}`).join(" ") || "unlimited"}
      </span>
      <button
        onClick={() => setEditing(true)}
        className="ml-auto text-xs font-medium text-primary hover:underline"
      >
        Edit
      </button>
    </li>
  );
}
