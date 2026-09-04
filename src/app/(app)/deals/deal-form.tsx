"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";

import { IDLE } from "@/lib/form";
import { LEAD_SOURCE_LABELS, LEAD_SOURCES } from "@/lib/crm/labels";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { SubmitButton, FormError } from "@/components/form";
import { createDealAction, updateDealAction } from "./actions";

export type PipelineOption = {
  id: string;
  name: string;
  stages: { id: string; name: string }[];
};

export type DealFormValues = {
  id?: string;
  name: string;
  pipelineId: string;
  stageId: string;
  companyId: string;
  contactId: string;
  ownerId: string;
  value: string;
  currency: string;
  source: string;
  expectedCloseDate: string;
  tags: string;
};

export function DealForm({
  mode,
  values,
  pipelines,
  members,
  companies,
  contacts,
}: {
  mode: "create" | "edit";
  values: DealFormValues;
  pipelines: PipelineOption[];
  members: { id: string; name: string }[];
  companies: { id: string; name: string }[];
  contacts: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [state, action] = useActionState(
    mode === "create" ? createDealAction : updateDealAction,
    IDLE,
  );
  const err = state.fieldErrors ?? {};

  const [pipelineId, setPipelineId] = useState(values.pipelineId || pipelines[0]?.id || "");
  const stages = pipelines.find((p) => p.id === pipelineId)?.stages ?? [];

  return (
    <form action={action} className="space-y-5">
      {values.id && <input type="hidden" name="id" value={values.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Deal name" htmlFor="name" error={err.name} className="sm:col-span-2">
          <Input id="name" name="name" defaultValue={values.name} required autoFocus />
        </Field>

        <Field label="Pipeline" htmlFor="pipelineId" error={err.pipelineId}>
          <Select
            id="pipelineId"
            name="pipelineId"
            value={pipelineId}
            onChange={(e) => setPipelineId(e.target.value)}
          >
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Stage" htmlFor="stageId" error={err.stageId}>
          <Select id="stageId" name="stageId" defaultValue={values.stageId}>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </Field>

        <Field label="Company" htmlFor="companyId" error={err.companyId}>
          <Select id="companyId" name="companyId" defaultValue={values.companyId}>
            <option value="">None</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Primary contact" htmlFor="contactId" error={err.contactId}>
          <Select id="contactId" name="contactId" defaultValue={values.contactId}>
            <option value="">None</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </Field>

        <Field label="Value" htmlFor="value" error={err.value} hint="Numbers only">
          <Input id="value" name="value" defaultValue={values.value} inputMode="decimal" />
        </Field>
        <Field label="Currency" htmlFor="currency" error={err.currency}>
          <Input id="currency" name="currency" defaultValue={values.currency || "USD"} maxLength={3} />
        </Field>

        <Field label="Expected close" htmlFor="expectedCloseDate" error={err.expectedCloseDate}>
          <Input id="expectedCloseDate" name="expectedCloseDate" type="date" defaultValue={values.expectedCloseDate} />
        </Field>
        <Field label="Owner" htmlFor="ownerId" error={err.ownerId}>
          <Select id="ownerId" name="ownerId" defaultValue={values.ownerId}>
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </Select>
        </Field>

        <Field label="Source" htmlFor="source" error={err.source}>
          <Select id="source" name="source" defaultValue={values.source}>
            <option value="">—</option>
            {LEAD_SOURCES.map((s) => (
              <option key={s} value={s}>{LEAD_SOURCE_LABELS[s]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Tags" htmlFor="tags" error={err.tags} hint="Comma-separated">
          <Input id="tags" name="tags" defaultValue={values.tags} />
        </Field>
      </div>

      {mode === "create" && (
        <Field label="Opening note" htmlFor="notesText" error={err.notesText}>
          <Textarea id="notesText" name="notesText" rows={3} />
        </Field>
      )}

      <FormError message={state.error} />

      <div className="flex gap-2">
        <SubmitButton pendingText="Saving…">
          {mode === "create" ? "Create deal" : "Save changes"}
        </SubmitButton>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
