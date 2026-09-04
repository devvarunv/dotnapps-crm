"use client";

import { useActionState, useRef, useEffect } from "react";
import { IDLE, type ActionState } from "@/lib/form";
import { formatDate } from "@/lib/utils";
import { Textarea } from "@/components/ui/input";
import { SubmitButton, FormError } from "@/components/form";

export type NoteItem = {
  id: string;
  body: string;
  author: string | null;
  createdAt: string;
};

export function NoteThread({
  parentField,
  parentId,
  notes,
  addAction,
  canAdd,
}: {
  parentField: "leadId" | "contactId" | "companyId";
  parentId: string;
  notes: NoteItem[];
  addAction: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  canAdd: boolean;
}) {
  const [state, action] = useActionState(addAction, IDLE);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <div className="space-y-4">
      {canAdd && (
        <form ref={ref} action={action} className="space-y-2">
          <input type="hidden" name={parentField} value={parentId} />
          <Textarea
            name="body"
            rows={3}
            placeholder="Add a note…"
            required
            aria-invalid={!!state.fieldErrors?.body}
          />
          {state.fieldErrors?.body && (
            <p className="text-xs text-destructive">{state.fieldErrors.body}</p>
          )}
          <FormError message={state.error} />
          <SubmitButton size="sm" pendingText="Saving…">
            Add note
          </SubmitButton>
        </form>
      )}

      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded-md border border-border bg-background p-3">
              <p className="whitespace-pre-wrap text-sm">{n.body}</p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {n.author ?? "Unknown"} · {formatDate(n.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
