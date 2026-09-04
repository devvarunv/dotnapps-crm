"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  Phone,
  Users,
  Mail,
  MessageCircle,
  CalendarClock,
  Presentation,
  StickyNote,
  CheckSquare,
} from "lucide-react";
import type { ActivityType } from "@prisma/client";

import { IDLE, type ActionState } from "@/lib/form";
import { ACTIVITY_TYPE_LABELS, LOGGABLE_ACTIVITY_TYPES } from "@/lib/crm/labels";
import { Input, Select, Textarea } from "@/components/ui/input";
import { SubmitButton, FormError } from "@/components/form";

const ICONS: Record<ActivityType, typeof Phone> = {
  CALL: Phone,
  MEETING: Users,
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
  FOLLOW_UP: CalendarClock,
  DEMO: Presentation,
  NOTE: StickyNote,
  TASK: CheckSquare,
};

export type TimelineItem = {
  id: string;
  type: ActivityType;
  source: "MANUAL" | "SYSTEM";
  subject: string | null;
  body: string | null;
  author: string | null;
  occurredAt: string;
};

export function Timeline({
  parentField,
  parentId,
  items,
  canAdd,
  logAction,
}: {
  parentField: "leadId" | "contactId" | "companyId" | "dealId";
  parentId: string;
  items: TimelineItem[];
  canAdd: boolean;
  logAction: (prev: ActionState, fd: FormData) => Promise<ActionState>;
}) {
  const [state, action] = useActionState(logAction, IDLE);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <div className="space-y-4">
      {canAdd && (
        <form ref={ref} action={action} className="space-y-2">
          <input type="hidden" name={parentField} value={parentId} />
          <div className="flex gap-2">
            <Select name="type" defaultValue="NOTE" className="w-36">
              {LOGGABLE_ACTIVITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ACTIVITY_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
            <Input
              name="subject"
              placeholder="Subject (optional)"
              className="flex-1"
            />
          </div>
          <Textarea
            name="body"
            rows={3}
            placeholder="What happened?"
            required
            aria-invalid={!!state.fieldErrors?.body}
          />
          {state.fieldErrors?.body && (
            <p className="text-xs text-destructive">{state.fieldErrors.body}</p>
          )}
          <FormError message={state.error} />
          <SubmitButton size="sm" pendingText="Logging…">
            Log activity
          </SubmitButton>
        </form>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <ol className="space-y-3">
          {items.map((it) => {
            const Icon = ICONS[it.type] ?? StickyNote;
            return (
              <li key={it.id} className="flex gap-3">
                <div
                  className={
                    "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full " +
                    (it.source === "SYSTEM"
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary/10 text-primary")
                  }
                >
                  <Icon className="size-3.5" />
                </div>
                <div className="min-w-0 flex-1 rounded-md border border-border bg-background p-3">
                  <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="font-medium">
                      {it.subject || ACTIVITY_TYPE_LABELS[it.type]}
                    </span>
                    {it.source === "SYSTEM" && (
                      <span className="rounded bg-muted px-1 text-[10px] font-medium text-muted-foreground">
                        system
                      </span>
                    )}
                  </div>
                  {it.body && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">
                      {it.body}
                    </p>
                  )}
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {it.author ?? "System"} ·{" "}
                    {new Date(it.occurredAt).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
