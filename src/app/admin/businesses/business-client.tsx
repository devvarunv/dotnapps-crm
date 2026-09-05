"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { extendTrialAction, revokeInviteAdminAction } from "../actions";

export function ExtendTrialForm({ subscriptionId }: { subscriptionId: string }) {
  const router = useRouter();
  const [days, setDays] = useState("7");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData();
        fd.set("id", subscriptionId);
        fd.set("days", days);
        start(async () => {
          const r = await extendTrialAction(fd);
          setMsg(r.message ?? r.error ?? null);
          router.refresh();
        });
      }}
    >
      <Input
        type="number"
        min={1}
        max={90}
        value={days}
        onChange={(e) => setDays(e.target.value)}
        className="h-8 w-20"
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        Extend by days
      </Button>
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
    </form>
  );
}

export function RevokeInviteButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() => {
        const fd = new FormData();
        fd.set("id", id);
        start(async () => {
          await revokeInviteAdminAction(fd);
          router.refresh();
        });
      }}
    >
      Revoke
    </Button>
  );
}
