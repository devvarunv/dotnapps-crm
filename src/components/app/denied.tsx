import Link from "next/link";
import { Lock } from "lucide-react";
import { buttonClassName } from "@/components/ui/button";

export function DeniedState({
  message = "Your role doesn't have access to this area.",
}: {
  message?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
      <div className="mx-auto grid size-11 place-items-center rounded-full bg-muted">
        <Lock className="size-5 text-muted-foreground" />
      </div>
      <p className="mt-4 text-sm font-medium">Permission denied</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        {message}
      </p>
      <Link
        href="/dashboard"
        className={buttonClassName({ variant: "outline", size: "sm", className: "mt-4" })}
      >
        Back to dashboard
      </Link>
    </div>
  );
}
