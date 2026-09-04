"use client";

import { useEffect } from "react";

// Catches errors thrown by the root layout itself. Must render its own
// <html>/<body> since the normal layout tree failed.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "error",
        message: "root_error_boundary",
        digest: error.digest,
        error: { name: error.name, message: error.message },
      }),
    );
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            minHeight: "100dvh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 16,
            textAlign: "center",
            background: "#f8fafc",
            color: "#1e293b",
          }}
        >
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
            Dotnapps CRM hit an unexpected error
          </h1>
          <p style={{ fontSize: 14, color: "#64748b", maxWidth: 380, margin: 0 }}>
            The error has been logged. Reloading usually resolves it.
          </p>
          <button
            onClick={() => reset()}
            style={{
              height: 36,
              padding: "0 16px",
              borderRadius: 6,
              border: "none",
              background: "#4f46e5",
              color: "white",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
