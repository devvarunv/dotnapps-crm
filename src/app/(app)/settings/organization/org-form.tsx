"use client";

import { useActionState } from "react";
import { renameOrganizationAction } from "../actions";
import { IDLE } from "@/lib/form";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/primitives";
import { SubmitButton, FormError, FormSuccess } from "@/components/form";

export function OrgForm({
  defaultName,
  editable,
}: {
  defaultName: string;
  editable: boolean;
}) {
  const [state, action] = useActionState(renameOrganizationAction, IDLE);

  return (
    <form action={action} className="max-w-sm space-y-4">
      <Field
        label="Business name"
        htmlFor="name"
        error={state.fieldErrors?.name}
        hint={editable ? undefined : "Only owners and admins can change this."}
      >
        <Input
          id="name"
          name="name"
          defaultValue={defaultName}
          disabled={!editable}
          required
          aria-invalid={!!state.fieldErrors?.name}
        />
      </Field>
      <FormError message={state.error} />
      <FormSuccess message={state.ok ? state.message : undefined} />
      {editable && <SubmitButton pendingText="Saving…">Save</SubmitButton>}
    </form>
  );
}
