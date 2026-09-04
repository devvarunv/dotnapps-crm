import type { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { prisma } from "./db";

export type AuditInput = {
  action: string;
  orgId?: string | null;
  actorId?: string | null;
  targetType?: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
};

/**
 * Append-only record of a security-sensitive or business-critical change.
 * Never throws into the caller's happy path — a failed audit write is logged
 * but does not roll back the action that succeeded.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  let ip: string | undefined;
  try {
    const h = await headers();
    ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      undefined;
  } catch {
    // headers() is unavailable outside a request scope (e.g. seed script).
  }

  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        orgId: input.orgId ?? null,
        actorId: input.actorId ?? null,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: input.metadata,
        ip,
      },
    });
  } catch (err) {
    console.error("[audit] failed to record", input.action, err);
  }
}
