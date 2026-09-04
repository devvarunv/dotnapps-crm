"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Select } from "@/components/ui/input";
import { RANGES } from "@/lib/reports/query";

export function ReportsFilters({
  members,
}: {
  members: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    start(() => router.push(`${pathname}${next.toString() ? `?${next}` : ""}`));
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <Select
        value={params.get("range") ?? "90d"}
        onChange={(e) => set("range", e.target.value)}
        className="w-auto"
        aria-label="Date range"
      >
        {RANGES.map((r) => (
          <option key={r.key} value={r.key}>{r.label}</option>
        ))}
      </Select>
      <Select
        value={params.get("owner") ?? ""}
        onChange={(e) => set("owner", e.target.value)}
        className="w-auto min-w-[150px]"
        aria-label="Owner"
      >
        <option value="">All owners</option>
        <option value="unassigned">Unassigned</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </Select>
      {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
    </div>
  );
}
