import type { Prisma } from "@prisma/client";
import { parseListParams, filterValue, type SearchParams } from "@/lib/crm/query";

const SORTABLE = ["createdAt", "name"];

export function parseContactParams(raw: SearchParams) {
  const base = parseListParams(raw, { defaultSort: "createdAt", sortable: SORTABLE });
  return {
    ...base,
    owner: filterValue(raw, "owner"),
    company: filterValue(raw, "company"),
    tag: filterValue(raw, "tag"),
    archived: filterValue(raw, "archived") === "1",
  };
}

export function buildContactWhere(
  orgId: string,
  p: ReturnType<typeof parseContactParams>,
): Prisma.ContactWhereInput {
  const where: Prisma.ContactWhereInput = { orgId, archived: p.archived };
  if (p.q) {
    where.OR = [
      { name: { contains: p.q, mode: "insensitive" } },
      { email: { contains: p.q, mode: "insensitive" } },
      { phone: { contains: p.q, mode: "insensitive" } },
    ];
  }
  if (p.owner === "unassigned") where.ownerId = null;
  else if (p.owner) where.ownerId = p.owner;
  if (p.company) where.companyId = p.company;
  if (p.tag) where.tags = { some: { id: p.tag } };
  return where;
}
