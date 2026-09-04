import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Logomark — two chamfered blocks (left) plus a flagged hook (right),
 * matching the brand's abstract two-tone mark. Uses currentColor so it
 * follows text color (and therefore light/dark theme) automatically.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <path d="M24 24H40V40H24V24Z" />
      <path d="M24 50L40 44V70H24V50Z" />
      <path d="M46 27L58 27L71 40L71 64L65 69L56 69L56 40L46 40Z" />
    </svg>
  );
}

export function Logo({
  className,
  href = "/",
}: {
  className?: string;
  href?: string | null;
}) {
  const mark = (
    <span className={cn("flex items-center gap-2 font-semibold", className)}>
      <LogoMark className="size-7 text-foreground" />
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
