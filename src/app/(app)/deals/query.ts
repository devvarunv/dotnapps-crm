import type { Prisma } from "@prisma/client";
import { parseListParams, filterValue, type SearchParams } from "@/lib/crm/query";

const SORTABLE = ["createdAt", "name", "value", "expectedCloseDate", "updatedAt"];

export function parseDealParams(raw: SearchParams) {
  const base = parseListParams(raw, { defaultSort: "updatedAt", sortable: SORTABLE });
  const status = filterValue(raw, "status");
  return {
    ...base,
    pipeline: filterValue(raw, "pipeline"),
    stage: filterValue(raw, "stage"),
    owner: filterValue(raw, "owner"),
    tag: filterValue(raw, "tag"),
    status: ["OPEN", "WON", "LOST"].includes(status) ? status : "",
    archived: filterValue(raw, "archived") === "1",
  };
}

export function buildDealWhere(
  orgId: string,
  p: ReturnType<typeof parseDealParams>,
): Prisma.DealWhereInput {
  const where: Prisma.DealWhereInput = { orgId, archived: p.archived };
  if (p.q) {
    where.OR = [
      { name: { contains: p.q, mode: "insensitive" } },
      { company: { name: { contains: p.q, mode: "insensitive" } } },
      { contact: { name: { contains: p.q, mode: "insensitive" } } },
    ];
  }
  if (p.pipeline) where.pipelineId = p.pipeline;
  if (p.stage) where.stageId = p.stage;
  if (p.owner === "unassigned") where.ownerId = null;
  else if (p.owner) where.ownerId = p.owner;
  if (p.status) where.status = p.status as Prisma.DealWhereInput["status"];
  if (p.tag) where.tags = { some: { id: p.tag } };
  return where;
}
