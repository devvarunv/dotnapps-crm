"use client";

import { useActionState } from "react";
import { updateProfileAction, changePasswordAction } from "../actions";
import { IDLE } from "@/lib/form";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Field } from "@/components/ui/primitives";
import { SubmitButton, FormError, FormSuccess } from "@/components/form";

export function ProfileForm({
  defaultName,
  email,
}: {
  defaultName: string;
  email: string;
}) {
  const [state, action] = useActionState(updateProfileAction, IDLE);
  return (
    <form action={action} className="max-w-sm space-y-4">
      <Field label="Full name" htmlFor="name" error={state.fieldErrors?.name}>
        <Input
          id="name"
          name="name"
          defaultValue={defaultName}
          required
          aria-invalid={!!state.fieldErrors?.name}
        />
      </Field>
      <Field label="Email" htmlFor="email" hint="Email changes aren't available in V1.">
        <Input id="email" value={email} disabled readOnly />
      </Field>
      <FormError message={state.error} />
      <FormSuccess message={state.ok ? state.message : undefined} />
      <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePasswordAction, IDLE);
  return (
    <form action={action} className="max-w-sm space-y-4">
      <Field
        label="Current password"
        htmlFor="currentPassword"
        error={state.fieldErrors?.currentPassword}
      >
        <PasswordInput
          id="currentPassword"
          name="currentPassword"
          autoComplete="current-password"
          required
          aria-invalid={!!state.fieldErrors?.currentPassword}
        />
      </Field>
      <Field
        label="New password"
        htmlFor="newPassword"
        hint="At least 10 characters."
        error={state.fieldErrors?.newPassword}
      >
        <PasswordInput
          id="newPassword"
          name="newPassword"
          autoComplete="new-password"
          required
          aria-invalid={!!state.fieldErrors?.newPassword}
        />
      </Field>
      <Field
        label="Confirm new password"
        htmlFor="confirmPassword"
        error={state.fieldErrors?.confirmPassword}
      >
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          required
          aria-invalid={!!state.fieldErrors?.confirmPassword}
        />
      </Field>
      <FormError message={state.error} />
      <FormSuccess message={state.ok ? state.message : undefined} />
      <SubmitButton pendingText="Updating…">Change password</SubmitButton>
    </form>
  );
}
