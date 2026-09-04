"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { LEAD_STATUS_LABELS, LEAD_STATUS_TONES, LEAD_SOURCE_LABELS, LEAD_STATUSES } from "@/lib/crm/labels";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/primitives";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TagBadge } from "@/components/app/tag-badge";
import {
  bulkAssignLeadsAction,
  bulkStatusLeadsAction,
  bulkTagLeadsAction,
  bulkArchiveLeadsAction,
} from "./actions";
import { IDLE, type ActionState } from "@/lib/form";

type Row = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  status: keyof typeof LEAD_STATUS_LABELS;
  source: keyof typeof LEAD_SOURCE_LABELS;
  owner: string | null;
  ownerId: string | null;
  tags: { id: string; name: string; color: string }[];
  estimatedValue: string | null;
  nextFollowUpAt: string | null;
  createdAt: string;
  notes: number;
  archived: boolean;
};

export function LeadsTable({
  rows,
  members,
  tags,
  perms,
}: {
  rows: Row[];
  members: { id: string; name: string }[];
  tags: { id: string; name: string }[];
  perms: { assign: boolean; edit: boolean };
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<ActionState>(IDLE);

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const ids = [...selected];

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)));
  }

  function run(action: (fd: FormData) => Promise<ActionState>, fd: FormData) {
    fd.set("ids", ids.join(","));
    startTransition(async () => {
      const res = await action(fd);
      setMsg(res);
      if (res.ok) {
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-10 px-3 py-2">
                {(perms.edit || perms.assign) && (
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    aria-label="Select all"
                  />
                )}
              </th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Source</th>
              <th className="px-3 py-2 font-medium">Owner</th>
              <th className="px-3 py-2 font-medium">Value</th>
              <th className="px-3 py-2 font-medium">Follow-up</th>
              <th className="px-3 py-2 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-muted/40">
                <td className="px-3 py-2">
                  {(perms.edit || perms.assign) && (
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                      aria-label={`Select ${r.name}`}
                    />
                  )}
                </td>
                <td className="px-3 py-2">
                  <Link href={`/leads/${r.id}`} className="font-medium hover:underline">
                    {r.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {r.company || r.email || "—"}
                  </div>
                  {r.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.tags.map((t) => (
                        <TagBadge key={t.id} name={t.name} color={t.color} />
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2">
                  <Badge tone={LEAD_STATUS_TONES[r.status]}>
                    {LEAD_STATUS_LABELS[r.status]}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {LEAD_SOURCE_LABELS[r.source]}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {r.owner ?? "Unassigned"}
                </td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">
                  {r.estimatedValue
                    ? Number(r.estimatedValue).toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                        maximumFractionDigits: 0,
                      })
                    : "—"}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {r.nextFollowUpAt ? formatDate(r.nextFollowUpAt) : "—"}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {formatDate(r.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ids.length > 0 && (perms.edit || perms.assign) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/40 px-3 py-2.5 text-sm">
          <span className="font-medium">{ids.length} selected</span>

          {perms.assign && (
            <BulkControl
              label="Assign"
              disabled={pending}
              onPick={(v) => {
                const fd = new FormData();
                fd.set("ownerId", v);
                run(bulkAssignLeadsAction, fd);
              }}
              options={[
                { value: "", label: "Unassigned" },
                ...members.map((m) => ({ value: m.id, label: m.name })),
              ]}
            />
          )}

          {perms.edit && (
            <BulkControl
              label="Status"
              disabled={pending}
              onPick={(v) => {
                const fd = new FormData();
                fd.set("status", v);
                run(bulkStatusLeadsAction, fd);
              }}
              options={LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s] }))}
            />
          )}

          {perms.edit && tags.length > 0 && (
            <>
              <BulkControl
                label="Add tag"
                disabled={pending}
                onPick={(v) => {
                  const fd = new FormData();
                  fd.set("tagId", v);
                  fd.set("op", "add");
                  run(bulkTagLeadsAction, fd);
                }}
                options={tags.map((t) => ({ value: t.id, label: t.name }))}
              />
              <BulkControl
                label="Remove tag"
                disabled={pending}
                onPick={(v) => {
                  const fd = new FormData();
                  fd.set("tagId", v);
                  fd.set("op", "remove");
                  run(bulkTagLeadsAction, fd);
                }}
                options={tags.map((t) => ({ value: t.id, label: t.name }))}
              />
            </>
          )}

          {perms.edit && (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => run(bulkArchiveLeadsAction, new FormData())}
            >
              Archive
            </Button>
          )}

          <button
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </button>

          {msg.error && <span className="text-destructive">{msg.error}</span>}
          {msg.ok && <span className="text-emerald-600">{msg.message}</span>}
        </div>
      )}
    </div>
  );
}

function BulkControl({
  label,
  options,
  onPick,
  disabled,
}: {
  label: string;
  options: { value: string; label: string }[];
  onPick: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <Select
      className="h-8 w-auto min-w-[120px]"
      disabled={disabled}
      value=""
      onChange={(e) => {
        if (e.target.value !== "__") onPick(e.target.value);
        e.target.value = "";
      }}
    >
      <option value="">{label}…</option>
      {options.map((o) => (
        <option key={`${label}-${o.value}`} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}
