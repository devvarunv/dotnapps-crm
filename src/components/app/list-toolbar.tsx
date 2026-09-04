"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";
import { Input, Select } from "@/components/ui/input";

export type ToolbarFilter = {
  name: string;
  label: string;
  options: { value: string; label: string }[];
};

export function ListToolbar({
  filters,
  searchPlaceholder = "Search…",
}: {
  filters: ToolbarFilter[];
  searchPlaceholder?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const firstRender = useRef(true);

  // Debounced push of the search term.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(() => {
      push({ q: q || undefined, page: undefined });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function push(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === undefined || v === "") next.delete(k);
      else next.set(k, v);
    }
    startTransition(() => {
      router.push(`${pathname}${next.toString() ? `?${next}` : ""}`);
    });
  }

  const activeCount =
    (params.get("q") ? 1 : 0) +
    filters.filter((f) => params.get(f.name)).length;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-8"
        />
        {pending && (
          <Loader2 className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {filters.map((f) => (
        <Select
          key={f.name}
          value={params.get(f.name) ?? ""}
          onChange={(e) => push({ [f.name]: e.target.value || undefined, page: undefined })}
          className="w-auto min-w-[130px]"
          aria-label={f.label}
        >
          <option value="">{f.label}: all</option>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      ))}

      {activeCount > 0 && (
        <button
          onClick={() => {
            setQ("");
            startTransition(() => router.push(pathname));
          }}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" /> Clear
        </button>
      )}
    </div>
  );
}
