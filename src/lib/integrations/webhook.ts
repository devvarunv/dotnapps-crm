import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify an HMAC-SHA256 signature over the raw request body.
 * Accepts `sha256=<hex>`, `v1=<hex>`, or a bare hex digest.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) return false;

  const provided = signatureHeader.includes("=")
    ? signatureHeader.split(",").map((p) => p.trim().split("=").pop() ?? "").pop() ?? ""
    : signatureHeader.trim();

  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");

  const a = Buffer.from(provided, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

/** Helper for tests / the mock simulator: produce a valid signature. */
export function signWebhookBody(rawBody: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`;
}
