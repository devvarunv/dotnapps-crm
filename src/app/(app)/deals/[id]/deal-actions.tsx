"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { IDLE, type ActionState } from "@/lib/form";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/form";
import { changeDealStageAction, winLoseDealAction } from "../actions";

export function StageSelect({
  dealId,
  stageId,
  stages,
  disabled,
}: {
  dealId: string;
  stageId: string;
  stages: { id: string; name: string }[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <Select
        value={stageId}
        disabled={disabled || pending}
        onChange={(e) => {
          const fd = new FormData();
          fd.set("dealId", dealId);
          fd.set("stageId", e.target.value);
          start(async () => {
            const res = await changeDealStageAction(fd);
            setMsg(res.error ?? null);
            if (!res.error) router.refresh();
          });
        }}
      >
        {stages.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </Select>
      {msg && <p className="text-xs text-destructive">{msg}</p>}
    </div>
  );
}

export function WinLose({ dealId, status }: { dealId: string; status: string }) {
  const [state, action] = useActionState(winLoseDealAction, IDLE);
  const [open, setOpen] = useState<"WON" | "LOST" | null>(null);

  if (status !== "OPEN") {
    return (
      <form action={action}>
        <input type="hidden" name="dealId" value={dealId} />
        <input type="hidden" name="outcome" value="WON" />
        <p className="text-sm text-muted-foreground">
          This deal is {status.toLowerCase()}.
        </p>
      </form>
    );
  }

  return (
    <div className="space-y-2">
      {open === null ? (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setOpen("WON")}>Mark won</Button>
          <Button size="sm" variant="outline" onClick={() => setOpen("LOST")}>
            Mark lost
          </Button>
        </div>
      ) : (
        <form action={action} className="space-y-2">
          <input type="hidden" name="dealId" value={dealId} />
          <input type="hidden" name="outcome" value={open} />
          <Input
            name="reason"
            placeholder={open === "WON" ? "Win reason (optional)" : "Loss reason (optional)"}
          />
          <div className="flex gap-2">
            <SubmitButton size="sm" pendingText="Saving…">
              Confirm {open === "WON" ? "win" : "loss"}
            </SubmitButton>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(null)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </div>
  );
}
