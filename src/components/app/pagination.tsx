import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildQuery, type SearchParams } from "@/lib/crm/query";
import { buttonClassName } from "@/components/ui/button";

export function Pagination({
  basePath,
  raw,
  current,
  pages,
  total,
}: {
  basePath: string;
  raw: SearchParams;
  current: number;
  pages: number;
  total: number;
}) {
  if (total === 0) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
      <span>
        Page {current} of {pages} · {total} record{total === 1 ? "" : "s"}
      </span>
      <div className="flex gap-2">
        <Link
          aria-disabled={current <= 1}
          href={`${basePath}${buildQuery(raw, { page: current - 1 })}`}
          className={buttonClassName({
            variant: "outline",
            size: "sm",
            className: current <= 1 ? "pointer-events-none opacity-50" : "",
          })}
        >
          <ChevronLeft className="size-4" /> Prev
        </Link>
        <Link
          aria-disabled={current >= pages}
          href={`${basePath}${buildQuery(raw, { page: current + 1 })}`}
          className={buttonClassName({
            variant: "outline",
            size: "sm",
            className: current >= pages ? "pointer-events-none opacity-50" : "",
          })}
        >
          Next <ChevronRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
