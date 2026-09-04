import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonClassName } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-muted">
        <SearchX className="size-6 text-muted-foreground" />
      </div>
      <div>
        <h1 className="text-lg font-semibold">Page not found</h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          It may have been moved, archived, or the link is wrong.
        </p>
      </div>
      <Link href="/dashboard" className={buttonClassName()}>
        Go to dashboard
      </Link>
    </div>
  );
}
