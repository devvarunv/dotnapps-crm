import { filterValue, type SearchParams } from "@/lib/crm/query";

export const RANGES = [
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "90d", label: "Last 90 days", days: 90 },
  { key: "365d", label: "Last 12 months", days: 365 },
  { key: "all", label: "All time", days: null },
] as const;

export type ReportRange = {
  key: string;
  label: string;
  from: Date | null;
  to: Date;
};

export function parseReportParams(raw: SearchParams): {
  range: ReportRange;
  ownerId: string;
} {
  const key = filterValue(raw, "range") || "90d";
  const spec = RANGES.find((r) => r.key === key) ?? RANGES[1];
  return {
    range: {
      key: spec.key,
      label: spec.label,
      from: spec.days === null ? null : new Date(Date.now() - spec.days * 86_400_000),
      to: new Date(),
    },
    ownerId: filterValue(raw, "owner"),
  };
}

/** Prisma date filter for a createdAt/closedAt-style column. */
export function inRange(range: ReportRange) {
  return range.from ? { gte: range.from, lte: range.to } : undefined;
}
