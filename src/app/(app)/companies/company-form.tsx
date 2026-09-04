"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";

import { IDLE } from "@/lib/form";
import { COMPANY_SIZES } from "@/lib/crm/labels";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { SubmitButton, FormError } from "@/components/form";
import { createCompanyAction, updateCompanyAction } from "./actions";

export type CompanyFormValues = {
  id?: string;
  name: string;
  website: string;
  industry: string;
  size: string;
  gstin: string;
  ownerId: string;
  tags: string;
};

export function CompanyForm({
  mode,
  values,
  members,
}: {
  mode: "create" | "edit";
  values: CompanyFormValues;
  members: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [state, action] = useActionState(
    mode === "create" ? createCompanyAction : updateCompanyAction,
    IDLE,
  );
  const err = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5">
      {values.id && <input type="hidden" name="id" value={values.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company name" htmlFor="name" error={err.name}>
          <Input id="name" name="name" defaultValue={values.name} required autoFocus />
        </Field>
        <Field label="Website" htmlFor="website" error={err.website}>
          <Input id="website" name="website" defaultValue={values.website} />
        </Field>
        <Field label="Industry" htmlFor="industry" error={err.industry}>
          <Input id="industry" name="industry" defaultValue={values.industry} />
        </Field>
        <Field label="Company size" htmlFor="size" error={err.size}>
          <Select id="size" name="size" defaultValue={values.size}>
            <option value="">—</option>
            {COMPANY_SIZES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="GSTIN" htmlFor="gstin" error={err.gstin}>
          <Input id="gstin" name="gstin" defaultValue={values.gstin} />
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
          <Input id="tags" name="tags" defaultValue={values.tags} placeholder="Enterprise, VIP" />
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
          {mode === "create" ? "Create company" : "Save changes"}
        </SubmitButton>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
