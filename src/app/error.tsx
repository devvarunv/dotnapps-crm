"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button, buttonClassName } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Structured client-side error report. In production this is the hook
    // point for a real error-tracking sink (see docs/OPERATIONS.md).
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "error",
        message: "client_error_boundary",
        digest: error.digest,
        error: { name: error.name, message: error.message },
      }),
    );
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-6 text-destructive" />
      </div>
      <div>
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          The error has been logged. You can try again, or head back to the
          dashboard.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-muted-foreground">Reference: {error.digest}</p>
        )}
      </div>
      <div className="flex gap-2">
        <Button onClick={() => reset()}>Try again</Button>
        <Link href="/dashboard" className={buttonClassName({ variant: "outline" })}>
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
