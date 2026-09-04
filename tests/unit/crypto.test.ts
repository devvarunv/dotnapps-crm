import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.AUTH_SECRET ??= "test-only-secret-do-not-use-in-prod";
});

describe("crypto (integration secret encryption)", () => {
  it("round-trips a plaintext value", async () => {
    const { encryptSecret, decryptSecret } = await import("@/lib/crypto");
    const plain = "sk_live_super_secret_api_key";
    const ciphertext = encryptSecret(plain);
    expect(ciphertext).not.toContain(plain);
    expect(decryptSecret(ciphertext)).toBe(plain);
  });

  it("produces different ciphertext each time (random salt/IV)", async () => {
    const { encryptSecret } = await import("@/lib/crypto");
    const a = encryptSecret("same-value");
    const b = encryptSecret("same-value");
    expect(a).not.toBe(b);
  });

  it("fails to decrypt tampered ciphertext", async () => {
    const { encryptSecret, decryptSecret } = await import("@/lib/crypto");
    const ciphertext = encryptSecret("do-not-leak-me");
    const buf = Buffer.from(ciphertext, "base64");
    buf[buf.length - 1] ^= 0xff; // flip a byte in the encrypted payload
    expect(() => decryptSecret(buf.toString("base64"))).toThrow();
  });

  it("masks a secret to only its last 4 characters", async () => {
    const { maskSecret } = await import("@/lib/crypto");
    expect(maskSecret("abcd1234")).toBe("••••1234");
    expect(maskSecret("")).toBe("");
  });
});
