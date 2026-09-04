/**
 * Structured server-side logging. Writes one JSON line per event to stdout/
 * stderr so it's easy to ship to any log aggregator (the process's stdout is
 * the integration point — see docs/OPERATIONS.md for wiring a real APM/log
 * sink such as Sentry or Datadog).
 */

type Level = "info" | "warn" | "error";

function emit(level: Level, message: string, meta?: Record<string, unknown>) {
  const line = {
    ts: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  const out = JSON.stringify(line);
  if (level === "error") console.error(out);
  else if (level === "warn") console.warn(out);
  else console.log(out);
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => emit("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => emit("warn", message, meta),
  error: (message: string, error?: unknown, meta?: Record<string, unknown>) =>
    emit("error", message, {
      ...meta,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : error,
    }),
};
