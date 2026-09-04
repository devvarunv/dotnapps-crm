import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  href = "/",
}: {
  className?: string;
  href?: string | null;
}) {
  const mark = (
    <span className={cn("flex items-center gap-2 font-semibold", className)}>
      <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
        D
      </span>
      <span className="tracking-tight">
        Dotnapps <span className="text-muted-foreground">CRM</span>
      </span>
    </span>
  );
  return href ? (
    <Link href={href} className="inline-flex">
      {mark}
    </Link>
  ) : (
    mark
  );
}
