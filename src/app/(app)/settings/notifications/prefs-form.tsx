"use client";

import { useActionState } from "react";
import { IDLE } from "@/lib/form";
import { SubmitButton, FormSuccess } from "@/components/form";
import { saveNotificationPrefsAction } from "./actions";

const TYPES: { key: string; label: string }[] = [
  { key: "ASSIGNMENT", label: "Something is assigned to me" },
  { key: "MENTION", label: "I'm @mentioned in a note or activity" },
  { key: "TASK_OVERDUE", label: "One of my tasks is overdue" },
  { key: "STAGE_CHANGE", label: "A deal I own changes stage" },
  { key: "CLOSE_APPROACHING", label: "A deal I own is near its close date" },
  { key: "AUTOMATION_FOLLOWUP", label: "An automation creates a follow-up for me" },
];

export function PrefsForm({
  emailEnabled,
  muted,
}: {
  emailEnabled: boolean;
  muted: string[];
}) {
  const [state, action] = useActionState(saveNotificationPrefsAction, IDLE);

  return (
    <form action={action} className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Notify me about</legend>
        {TYPES.map((t) => (
          <label key={t.key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name={`type_${t.key}`}
              defaultChecked={!muted.includes(t.key)}
            />
            {t.label}
          </label>
        ))}
      </fieldset>

      <div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="emailEnabled" defaultChecked={emailEnabled} />
          Also email me (delivery is not wired up yet — this preference is stored)
        </label>
      </div>

      <FormSuccess message={state.ok ? state.message : undefined} />
      <SubmitButton pendingText="Saving…">Save preferences</SubmitButton>
    </form>
  );
}
