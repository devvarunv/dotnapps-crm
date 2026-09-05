"use client";

import { useActionState } from "react";
import { signupAction } from "../actions";
import { IDLE } from "@/lib/form";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Field } from "@/components/ui/primitives";
import { SubmitButton, FormError } from "@/components/form";

export function SignupForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signupAction, IDLE);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />

      <Field label="Full name" htmlFor="name" error={state.fieldErrors?.name}>
        <Input id="name" name="name" autoComplete="name" required
          aria-invalid={!!state.fieldErrors?.name} />
      </Field>

      <Field label="Work email" htmlFor="email" error={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required
          aria-invalid={!!state.fieldErrors?.email} />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        hint="At least 10 characters."
        error={state.fieldErrors?.password}
      >
        <PasswordInput id="password" name="password"
          autoComplete="new-password" required
          aria-invalid={!!state.fieldErrors?.password} />
      </Field>

      <Field
        label="Confirm password"
        htmlFor="confirmPassword"
        error={state.fieldErrors?.confirmPassword}
      >
        <PasswordInput id="confirmPassword" name="confirmPassword"
          autoComplete="new-password" required
          aria-invalid={!!state.fieldErrors?.confirmPassword} />
      </Field>

      <FormError message={state.error} />

      <SubmitButton className="w-full" pendingText="Creating account…">
        Create account
      </SubmitButton>

      <p className="text-xs text-muted-foreground">
        By continuing you agree to the Dotnapps terms of service and privacy
        policy.
      </p>
    </form>
  );
}
