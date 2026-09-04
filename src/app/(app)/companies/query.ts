import type { Prisma } from "@prisma/client";
import { parseListParams, filterValue, type SearchParams } from "@/lib/crm/query";

const SORTABLE = ["createdAt", "name"];

export function parseCompanyParams(raw: SearchParams) {
  const base = parseListParams(raw, { defaultSort: "createdAt", sortable: SORTABLE });
  return {
    ...base,
    owner: filterValue(raw, "owner"),
    industry: filterValue(raw, "industry"),
    tag: filterValue(raw, "tag"),
    archived: filterValue(raw, "archived") === "1",
  };
}

export function buildCompanyWhere(
  orgId: string,
  p: ReturnType<typeof parseCompanyParams>,
): Prisma.CompanyWhereInput {
  const where: Prisma.CompanyWhereInput = { orgId, archived: p.archived };
  if (p.q) {
    where.OR = [
      { name: { contains: p.q, mode: "insensitive" } },
      { website: { contains: p.q, mode: "insensitive" } },
      { industry: { contains: p.q, mode: "insensitive" } },
    ];
  }
  if (p.owner === "unassigned") where.ownerId = null;
  else if (p.owner) where.ownerId = p.owner;
  if (p.industry) where.industry = { equals: p.industry, mode: "insensitive" };
  if (p.tag) where.tags = { some: { id: p.tag } };
  return where;
}
