"use client";

import { useActionState } from "react";
import { acceptInviteFormAction } from "./actions";
import { IDLE } from "@/lib/form";
import { SubmitButton } from "@/components/form";

export function AcceptInviteButton({ token }: { token: string }) {
  const [state, action] = useActionState(acceptInviteFormAction, IDLE);
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="token" value={token} />
      <SubmitButton size="sm" pendingText="Joining…">
        Accept
      </SubmitButton>
      {state.error ? (
        <span className="text-right text-xs text-destructive">{state.error}</span>
      ) : null}
    </form>
  );
}
