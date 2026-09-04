import type { Prisma } from "@prisma/client";
import {
  parseListParams,
  filterValue,
  type SearchParams,
} from "@/lib/crm/query";
import { LEAD_SOURCES, LEAD_STATUSES } from "@/lib/crm/labels";

const SORTABLE = ["createdAt", "name", "status", "estimatedValue", "nextFollowUpAt"];

export function parseLeadParams(raw: SearchParams) {
  const base = parseListParams(raw, { defaultSort: "createdAt", sortable: SORTABLE });
  const status = filterValue(raw, "status");
  const source = filterValue(raw, "source");
  return {
    ...base,
    status: (LEAD_STATUSES as string[]).includes(status) ? status : "",
    source: (LEAD_SOURCES as string[]).includes(source) ? source : "",
    owner: filterValue(raw, "owner"),
    tag: filterValue(raw, "tag"),
    archived: filterValue(raw, "archived") === "1",
  };
}

export function buildLeadWhere(
  orgId: string,
  p: ReturnType<typeof parseLeadParams>,
): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = { orgId, archived: p.archived };

  if (p.q) {
    where.OR = [
      { name: { contains: p.q, mode: "insensitive" } },
      { email: { contains: p.q, mode: "insensitive" } },
      { companyName: { contains: p.q, mode: "insensitive" } },
      { phone: { contains: p.q, mode: "insensitive" } },
    ];
  }
  if (p.status) where.status = p.status as Prisma.LeadWhereInput["status"];
  if (p.source) where.source = p.source as Prisma.LeadWhereInput["source"];
  if (p.owner === "unassigned") where.ownerId = null;
  else if (p.owner) where.ownerId = p.owner;
  if (p.tag) where.tags = { some: { id: p.tag } };

  return where;
}

export function leadOrderBy(
  p: ReturnType<typeof parseLeadParams>,
): Prisma.LeadOrderByWithRelationInput {
  return { [p.sort]: p.dir };
}
