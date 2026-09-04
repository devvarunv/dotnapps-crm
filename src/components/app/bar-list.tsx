export function BarList({
  items,
  format = (n) => n.toLocaleString("en-US"),
  emptyText = "No data for this range.",
}: {
  items: { label: string; value: number; hint?: string }[];
  format?: (n: number) => string;
  emptyText?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li key={it.label} className="text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate">{it.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {format(it.value)}
              {it.hint ? ` · ${it.hint}` : ""}
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary/70"
              style={{ width: `${(it.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function StatGrid({
  stats,
}: {
  stats: { label: string; value: string; hint?: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums">{s.value}</p>
          {s.hint && <p className="text-xs text-muted-foreground">{s.hint}</p>}
        </div>
      ))}
    </div>
  );
}
