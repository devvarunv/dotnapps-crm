"use client";

import { useActionState, useEffect, useState } from "react";
import { Trash2, Pencil } from "lucide-react";

import { IDLE } from "@/lib/form";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { SubmitButton, FormError } from "@/components/form";
import { TagBadge } from "@/components/app/tag-badge";
import { createTagAction, updateTagAction, deleteTagAction } from "./actions";

export type TagRow = {
  id: string;
  name: string;
  color: string;
  usage: number;
};

export function CreateTag() {
  const [state, action] = useActionState(createTagAction, IDLE);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <Field label="Name" htmlFor="name" error={state.fieldErrors?.name}>
        <Input id="name" name="name" required className="w-48" />
      </Field>
      <Field label="Colour" htmlFor="color" error={state.fieldErrors?.color}>
        <input
          id="color"
          name="color"
          type="color"
          defaultValue="#2563eb"
          className="h-9 w-16 rounded-md border border-input bg-background"
        />
      </Field>
      <SubmitButton size="sm" pendingText="Adding…">Add tag</SubmitButton>
      <FormError message={state.error} />
    </form>
  );
}

export function TagList({ tags }: { tags: TagRow[] }) {
  return (
    <ul className="divide-y divide-border">
      {tags.map((t) => (
        <TagListRow key={t.id} tag={t} />
      ))}
    </ul>
  );
}

function TagListRow({ tag }: { tag: TagRow }) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState(updateTagAction, IDLE);
  useEffect(() => {
    if (state.ok) setEditing(false);
  }, [state]);

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      {editing ? (
        <form action={action} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={tag.id} />
          <Input name="name" defaultValue={tag.name} className="w-40" required />
          <input
            name="color"
            type="color"
            defaultValue={tag.color}
            className="h-9 w-14 rounded-md border border-input bg-background"
          />
          <SubmitButton size="sm" pendingText="Saving…">Save</SubmitButton>
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          {state.fieldErrors?.name && (
            <span className="text-xs text-destructive">{state.fieldErrors.name}</span>
          )}
        </form>
      ) : (
        <>
          <TagBadge name={tag.name} color={tag.color} />
          <span className="text-xs text-muted-foreground">
            {tag.usage} record{tag.usage === 1 ? "" : "s"}
          </span>
          <div className="ml-auto flex gap-1">
            <button
              onClick={() => setEditing(true)}
              className="rounded p-1 text-muted-foreground hover:bg-muted"
              aria-label={`Edit ${tag.name}`}
            >
              <Pencil className="size-4" />
            </button>
            <form action={deleteTagAction}>
              <input type="hidden" name="id" value={tag.id} />
              <button
                className="rounded p-1 text-muted-foreground hover:bg-muted"
                aria-label={`Delete ${tag.name}`}
              >
                <Trash2 className="size-4" />
              </button>
            </form>
          </div>
        </>
      )}
    </li>
  );
}
