"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";

import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  setSubscriptionStatusAction,
  changeSubscriptionPlanAction,
  runLifecycleAction,
} from "../actions";

const STATUSES = ["TRIALING", "ACTIVE", "PAST_DUE", "GRACE", "SUSPENDED", "CANCELED"];

export function RunLifecycle() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-3">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await runLifecycleAction();
            setMsg(r.message ?? null);
          })
        }
      >
        Run lifecycle now
      </Button>
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
    </div>
  );
}

export function StatusPicker({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Select
      value={status}
      disabled={pending}
      className="h-8 w-32"
      onChange={(e) => {
        const fd = new FormData();
        fd.set("id", id);
        fd.set("status", e.target.value);
        start(async () => {
          await setSubscriptionStatusAction(fd);
          router.refresh();
        });
      }}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>{s.toLowerCase()}</option>
      ))}
    </Select>
  );
}

export function PlanPicker({
  id,
  planId,
  plans,
}: {
  id: string;
  planId: string;
  plans: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Select
      value={planId}
      disabled={pending}
      className="h-8 w-36"
      onChange={(e) => {
        const fd = new FormData();
        fd.set("id", id);
        fd.set("planId", e.target.value);
        start(async () => {
          await changeSubscriptionPlanAction(fd);
          router.refresh();
        });
      }}
    >
      {plans.map((p) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </Select>
  );
}
