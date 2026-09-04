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
      <path d="M24 55L40 48V78H24V55Z" />
      <path d="M46 24L58 24L71 37L71 73L66 78L53 78L53 37L46 37Z" />
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
