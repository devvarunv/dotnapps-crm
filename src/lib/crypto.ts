import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Symmetric encryption for integration secrets at rest (API keys, webhook
 * secrets). The key is derived from AUTH_SECRET so nothing sensitive lives in
 * source. Format: base64( salt(16) | iv(12) | authTag(16) | ciphertext ).
 */

function keyFor(salt: Buffer): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required to encrypt integration secrets.");
  return scryptSync(secret, salt, 32);
}

export function encryptSecret(plain: string): string {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFor(salt), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, tag, enc]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const salt = buf.subarray(0, 16);
  const iv = buf.subarray(16, 28);
  const tag = buf.subarray(28, 44);
  const enc = buf.subarray(44);
  const decipher = createDecipheriv("aes-256-gcm", keyFor(salt), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

/** Last 4 characters of a secret, for display ("••••abcd"). */
export function maskSecret(plain: string): string {
  if (!plain) return "";
  return `••••${plain.slice(-4)}`;
}
