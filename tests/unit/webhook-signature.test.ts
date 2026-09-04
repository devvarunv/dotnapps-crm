import { describe, it, expect } from "vitest";
import { verifyWebhookSignature, signWebhookBody } from "@/lib/integrations/webhook";

describe("verifyWebhookSignature", () => {
  const secret = "whsec_test_123";
  const body = JSON.stringify({ type: "invoice.paid", data: { externalId: "x1" } });

  it("accepts a validly signed body", () => {
    const sig = signWebhookBody(body, secret);
    expect(verifyWebhookSignature(body, sig, secret)).toBe(true);
  });

  it("accepts a bare hex digest (no sha256= prefix)", () => {
    const sig = signWebhookBody(body, secret).replace("sha256=", "");
    expect(verifyWebhookSignature(body, sig, secret)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const sig = signWebhookBody(body, secret);
    expect(verifyWebhookSignature(body + " ", sig, secret)).toBe(false);
  });

  it("rejects the wrong secret", () => {
    const sig = signWebhookBody(body, secret);
    expect(verifyWebhookSignature(body, sig, "wrong-secret")).toBe(false);
  });

  it("rejects a missing signature header", () => {
    expect(verifyWebhookSignature(body, null, secret)).toBe(false);
  });

  it("rejects an empty secret", () => {
    const sig = signWebhookBody(body, secret);
    expect(verifyWebhookSignature(body, sig, "")).toBe(false);
  });
});
