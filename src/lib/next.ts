/**
 * `redirect()` and `notFound()` work by throwing a control-flow error that
 * Next catches. Server actions that wrap calls in try/catch must re-throw
 * these instead of swallowing them.
 */
export function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    ((error as { digest: string }).digest.startsWith("NEXT_REDIRECT") ||
      (error as { digest: string }).digest === "NEXT_NOT_FOUND")
  );
}
