"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";

import { IDLE } from "@/lib/form";
import {
  LEAD_SOURCE_LABELS,
  LEAD_SOURCES,
  LEAD_STATUS_LABELS,
  LEAD_STATUSES,
} from "@/lib/crm/labels";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { SubmitButton, FormError } from "@/components/form";
import { createLeadAction, updateLeadAction } from "./actions";

export type LeadFormValues = {
  id?: string;
  name: string;
  companyName: string;
  email: string;
  phone: string;
  whatsapp: string;
  website: string;
  source: string;
  industry: string;
  location: string;
  status: string;
  estimatedValue: string;
  nextFollowUpAt: string;
  ownerId: string;
  tags: string;
};

export function LeadForm({
  mode,
  values,
  members,
}: {
  mode: "create" | "edit";
  values: LeadFormValues;
  members: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [state, action] = useActionState(
    mode === "create" ? createLeadAction : updateLeadAction,
    IDLE,
  );
  const err = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5">
      {values.id && <input type="hidden" name="id" value={values.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" error={err.name}>
          <Input id="name" name="name" defaultValue={values.name} required autoFocus />
        </Field>
        <Field label="Company" htmlFor="companyName" error={err.companyName}>
          <Input id="companyName" name="companyName" defaultValue={values.companyName} />
        </Field>
        <Field label="Email" htmlFor="email" error={err.email}>
          <Input id="email" name="email" type="email" defaultValue={values.email} />
        </Field>
        <Field label="Phone" htmlFor="phone" error={err.phone}>
          <Input id="phone" name="phone" defaultValue={values.phone} />
        </Field>
        <Field label="WhatsApp" htmlFor="whatsapp" error={err.whatsapp}>
          <Input id="whatsapp" name="whatsapp" defaultValue={values.whatsapp} />
        </Field>
        <Field label="Website" htmlFor="website" error={err.website}>
          <Input id="website" name="website" defaultValue={values.website} />
        </Field>
        <Field label="Source" htmlFor="source" error={err.source}>
          <Select id="source" name="source" defaultValue={values.source || "MANUAL"}>
            {LEAD_SOURCES.map((s) => (
              <option key={s} value={s}>{LEAD_SOURCE_LABELS[s]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Status" htmlFor="status" error={err.status}>
          <Select id="status" name="status" defaultValue={values.status || "NEW"}>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Industry" htmlFor="industry" error={err.industry}>
          <Input id="industry" name="industry" defaultValue={values.industry} />
        </Field>
        <Field label="Location" htmlFor="location" error={err.location}>
          <Input id="location" name="location" defaultValue={values.location} />
        </Field>
        <Field label="Estimated value" htmlFor="estimatedValue" error={err.estimatedValue} hint="Numbers only, e.g. 5000">
          <Input id="estimatedValue" name="estimatedValue" defaultValue={values.estimatedValue} inputMode="decimal" />
        </Field>
        <Field label="Next follow-up" htmlFor="nextFollowUpAt" error={err.nextFollowUpAt}>
          <Input id="nextFollowUpAt" name="nextFollowUpAt" type="date" defaultValue={values.nextFollowUpAt} />
        </Field>
        <Field label="Owner" htmlFor="ownerId" error={err.ownerId}>
          <Select id="ownerId" name="ownerId" defaultValue={values.ownerId}>
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Tags" htmlFor="tags" error={err.tags} hint="Comma-separated. New tags are created automatically.">
          <Input id="tags" name="tags" defaultValue={values.tags} placeholder="VIP, Hot Lead" />
        </Field>
      </div>

      {mode === "create" && (
        <Field label="Opening note" htmlFor="notesText" error={err.notesText}>
          <Textarea id="notesText" name="notesText" rows={3} placeholder="Context, next steps…" />
        </Field>
      )}

      <FormError message={state.error} />

      <div className="flex gap-2">
        <SubmitButton pendingText="Saving…">
          {mode === "create" ? "Create lead" : "Save changes"}
        </SubmitButton>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
