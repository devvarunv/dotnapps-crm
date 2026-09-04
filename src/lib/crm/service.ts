import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * Validate that an owner id (if given) belongs to an active member of the org.
 * Returns `null` for "unassigned", throws for a cross-tenant / invalid id.
 */
export async function resolveOwnerId(
  orgId: string,
  ownerId: string | undefined | null,
): Promise<string | null> {
  if (!ownerId) return null;
  const membership = await prisma.membership.findFirst({
    where: { orgId, userId: ownerId, status: "ACTIVE" },
    select: { userId: true },
  });
  if (!membership) throw new Error("Selected owner is not a member of this workspace.");
  return ownerId;
}

/** Confirm a related record id belongs to this org (or return null). */
export async function assertCompanyInOrg(
  orgId: string,
  companyId: string | undefined | null,
): Promise<string | null> {
  if (!companyId) return null;
  const found = await prisma.company.findFirst({
    where: { id: companyId, orgId },
    select: { id: true },
  });
  if (!found) throw new Error("That company was not found in this workspace.");
  return companyId;
}

/**
 * Resolve a comma-separated list of tag names to tag ids within an org,
 * creating any that don't exist yet. Returns ids for a Prisma `set`.
 */
export async function resolveTagIds(
  tx: Tx,
  orgId: string,
  names: string[],
): Promise<{ id: string }[]> {
  const clean = [...new Set(names.map((n) => n.trim()).filter(Boolean))].slice(0, 30);
  const out: { id: string }[] = [];
  for (const name of clean) {
    const tag = await tx.tag.upsert({
      where: { orgId_name: { orgId, name } },
      create: { orgId, name },
      update: {},
      select: { id: true },
    });
    out.push({ id: tag.id });
  }
  return out;
}

export function parseTagNames(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export function decimalToInput(value: Prisma.Decimal | null): string {
  return value ? value.toString() : "";
}

export function formatMoney(value: Prisma.Decimal | null): string {
  if (!value) return "—";
  const n = Number(value);
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
