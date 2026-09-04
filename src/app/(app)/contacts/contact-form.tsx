"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";

import { IDLE } from "@/lib/form";
import { LEAD_SOURCE_LABELS, LEAD_SOURCES } from "@/lib/crm/labels";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { SubmitButton, FormError } from "@/components/form";
import { createContactAction, updateContactAction } from "./actions";

export type ContactFormValues = {
  id?: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  whatsapp: string;
  companyId: string;
  source: string;
  ownerId: string;
  tags: string;
};

export function ContactForm({
  mode,
  values,
  members,
  companies,
}: {
  mode: "create" | "edit";
  values: ContactFormValues;
  members: { id: string; name: string }[];
  companies: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [state, action] = useActionState(
    mode === "create" ? createContactAction : updateContactAction,
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
        <Field label="Job title" htmlFor="title" error={err.title}>
          <Input id="title" name="title" defaultValue={values.title} />
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
        <Field label="Company" htmlFor="companyId" error={err.companyId}>
          <Select id="companyId" name="companyId" defaultValue={values.companyId}>
            <option value="">None</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
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
        <Field label="Owner" htmlFor="ownerId" error={err.ownerId}>
          <Select id="ownerId" name="ownerId" defaultValue={values.ownerId}>
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Tags" htmlFor="tags" error={err.tags} hint="Comma-separated.">
          <Input id="tags" name="tags" defaultValue={values.tags} placeholder="VIP, Enterprise" />
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
          {mode === "create" ? "Create contact" : "Save changes"}
        </SubmitButton>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
