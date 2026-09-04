"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { StageKind } from "@prisma/client";

import { cn } from "@/lib/utils";
import { changeDealStageAction } from "@/app/(app)/deals/actions";

type BoardStage = { id: string; name: string; kind: StageKind };
type BoardDeal = {
  id: string;
  name: string;
  stageId: string;
  value: number | null;
  currency: string;
  company: string | null;
  owner: string | null;
  status: string;
};

function money(n: number | null, currency: string) {
  if (n === null) return null;
  return n.toLocaleString("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
}

export function Board({
  stages,
  deals,
  canEdit,
}: {
  stages: BoardStage[];
  deals: BoardDeal[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<Record<string, string>>({});

  const stageOf = (d: BoardDeal) => optimistic[d.id] ?? d.stageId;

  function move(dealId: string, stageId: string) {
    if (!canEdit) return;
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || stageOf(deal) === stageId) return;
    setOptimistic((o) => ({ ...o, [dealId]: stageId }));
    const fd = new FormData();
    fd.set("dealId", dealId);
    fd.set("stageId", stageId);
    start(async () => {
      const res = await changeDealStageAction(fd);
      if (res.error) {
        setError(res.error);
        setOptimistic((o) => {
          const next = { ...o };
          delete next[dealId];
          return next;
        });
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div>
      {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
      <div className="flex gap-3 overflow-x-auto pb-3">
        {stages.map((stage) => {
          const items = deals.filter((d) => stageOf(d) === stage.id);
          const sum = items.reduce((a, d) => a + (d.value ?? 0), 0);
          return (
            <div
              key={stage.id}
              onDragOver={(e) => {
                if (!canEdit || !dragId) return;
                e.preventDefault();
                setOverStage(stage.id);
              }}
              onDragLeave={() => setOverStage((s) => (s === stage.id ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) move(dragId, stage.id);
                setDragId(null);
                setOverStage(null);
              }}
              className={cn(
                "flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30",
                overStage === stage.id ? "border-primary" : "border-border",
              )}
            >
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-sm font-medium">{stage.name}</span>
                <span className="text-xs text-muted-foreground">
                  {items.length}
                  {sum > 0 ? ` · ${money(sum, items[0]?.currency ?? "USD")}` : ""}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2 px-2 pb-2">
                {items.map((d) => (
                  <div
                    key={d.id}
                    draggable={canEdit && !pending}
                    onDragStart={() => setDragId(d.id)}
                    onDragEnd={() => setDragId(null)}
                    className={cn(
                      "rounded-md border border-border bg-card p-2.5 text-sm shadow-sm",
                      canEdit && "cursor-grab active:cursor-grabbing",
                      dragId === d.id && "opacity-50",
                    )}
                  >
                    <Link href={`/deals/${d.id}`} className="font-medium hover:underline">
                      {d.name}
                    </Link>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {d.company ?? "—"}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{money(d.value, d.currency) ?? "—"}</span>
                      <span>{d.owner ?? "Unassigned"}</span>
                    </div>
                    {canEdit && (
                      <select
                        value={stage.id}
                        disabled={pending}
                        onChange={(e) => move(d.id, e.target.value)}
                        className="mt-2 h-7 w-full rounded border border-input bg-background text-xs sm:hidden"
                        aria-label={`Move ${d.name}`}
                      >
                        {stages.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                    Drop deals here
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {!canEdit && (
        <p className="text-xs text-muted-foreground">
          Your role can view the board but not move deals.
        </p>
      )}
    </div>
  );
}
