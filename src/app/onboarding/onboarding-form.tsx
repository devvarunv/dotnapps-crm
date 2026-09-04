"use client";

import { useActionState } from "react";
import { createOrganizationAction } from "./actions";
import { IDLE } from "@/lib/form";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/primitives";
import { SubmitButton, FormError } from "@/components/form";

export function OnboardingForm() {
  const [state, action] = useActionState(createOrganizationAction, IDLE);

  return (
    <form action={action} className="space-y-4">
      <Field
        label="Business name"
        htmlFor="name"
        hint="You can change this later in Settings."
        error={state.fieldErrors?.name}
      >
        <Input
          id="name"
          name="name"
          placeholder="Acme Inc."
          required
          autoFocus
          aria-invalid={!!state.fieldErrors?.name}
        />
      </Field>

      <FormError message={state.error} />

      <SubmitButton className="w-full" pendingText="Creating workspace…">
        Create workspace
      </SubmitButton>
    </form>
  );
}
