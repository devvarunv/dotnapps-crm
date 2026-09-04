"use client";

import { useActionState, useState } from "react";
import { Copy, Check, Trash2 } from "lucide-react";
import type { Role } from "@prisma/client";

import {
  inviteMemberAction,
  revokeInviteAction,
  changeMemberRoleAction,
  removeMemberAction,
} from "./actions";
import { IDLE } from "@/lib/form";
import { ROLE_LABELS } from "@/lib/rbac";
import { Input, Select } from "@/components/ui/input";
import { Field, Alert } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { SubmitButton, FormError } from "@/components/form";

/* ---------------------------------------------------------------- Invite --- */

export function InviteForm({ roles }: { roles: Role[] }) {
  const [state, action] = useActionState(inviteMemberAction, IDLE);
  const inviteUrl = state.ok ? (state.data?.inviteUrl as string | undefined) : undefined;

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_170px_auto] sm:items-end">
        <Field label="Email address" htmlFor="email" error={state.fieldErrors?.email}>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="teammate@company.com"
            required
            aria-invalid={!!state.fieldErrors?.email}
          />
        </Field>
        <Field label="Role" htmlFor="role" error={state.fieldErrors?.role}>
          <Select id="role" name="role" defaultValue={roles.includes("SALES" as Role) ? "SALES" : roles[0]}>
            {roles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </Field>
        <SubmitButton pendingText="Creating…">Invite</SubmitButton>
      </div>

      <FormError message={state.error} />

      {state.ok && (
        <Alert tone="success" className="space-y-2">
          <p>{state.message}</p>
          {inviteUrl && <CopyableUrl url={inviteUrl} />}
        </Alert>
      )}
    </form>
  );
}

export function CopyableUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded border border-border bg-background px-2 py-1 text-xs">
        {url}
      </code>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard unavailable */
          }
        }}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

/* --------------------------------------------------------------- Members --- */

export function MemberRoleControl({
  membershipId,
  currentRole,
  roles,
}: {
  membershipId: string;
  currentRole: Role;
  roles: Role[];
}) {
  const [state, action, pending] = useActionState(changeMemberRoleAction, IDLE);

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="membershipId" value={membershipId} />
      <Select
        name="role"
        defaultValue={currentRole}
        disabled={pending}
        className="h-8 w-32"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        {roles.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </Select>
      {state.error ? (
        <span className="text-xs text-destructive">{state.error}</span>
      ) : null}
    </form>
  );
}

export function RemoveMemberButton({
  membershipId,
  name,
}: {
  membershipId: string;
  name: string;
}) {
  const [state, action] = useActionState(removeMemberAction, IDLE);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Remove ${name} from this workspace?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="membershipId" value={membershipId} />
      <SubmitButton
        variant="ghost"
        size="icon"
        pendingText=""
        aria-label={`Remove ${name}`}
      >
        <Trash2 className="size-4 text-muted-foreground" />
      </SubmitButton>
      {state.error ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}

/* --------------------------------------------------------------- Invites --- */

export function RevokeInviteButton({ inviteId }: { inviteId: string }) {
  const [state, action] = useActionState(revokeInviteAction, IDLE);
  return (
    <form action={action}>
      <input type="hidden" name="inviteId" value={inviteId} />
      <SubmitButton variant="ghost" size="sm" pendingText="…">
        Revoke
      </SubmitButton>
      {state.error ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}
