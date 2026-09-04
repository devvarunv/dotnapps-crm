import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { LEAD_STATUSES, LEAD_SOURCES } from "@/lib/crm/labels";
import { type ReportRange, inRange } from "./query";

/**
 * Every function here reads the underlying CRM / Invoice-link rows and
 * aggregates them at read time. Nothing is cached or denormalised, so a
 * report always reconciles against the records it is derived from.
 */

const num = (d: Prisma.Decimal | null | undefined) => (d ? Number(d) : 0);

type Scope = { orgId: string; range: ReportRange; ownerId: string };

function ownerWhere(ownerId: string) {
  return ownerId === "unassigned" ? { ownerId: null } : ownerId ? { ownerId } : {};
}

/* ------------------------------------------------------------- leads ------ */

export async function leadMetrics({ orgId, range, ownerId }: Scope) {
  const createdAt = inRange(range);
  const base: Prisma.LeadWhereInput = {
    orgId,
    archived: false,
    ...ownerWhere(ownerId),
    ...(createdAt ? { createdAt } : {}),
  };

  const [total, converted, byStatusRows, bySourceRows, convertedBySource] =
    await Promise.all([
      prisma.lead.count({ where: base }),
      prisma.lead.count({ where: { ...base, convertedAt: { not: null } } }),
      prisma.lead.groupBy({ by: ["status"], where: base, _count: true }),
      prisma.lead.groupBy({ by: ["source"], where: base, _count: true }),
      prisma.lead.groupBy({
        by: ["source"],
        where: { ...base, convertedAt: { not: null } },
        _count: true,
      }),
    ]);

  const byStatus = LEAD_STATUSES.map((s) => ({
    status: s,
    count: byStatusRows.find((r) => r.status === s)?._count ?? 0,
  }));

  const convBySource = new Map(convertedBySource.map((r) => [r.source, r._count]));
  const bySource = LEAD_SOURCES.map((s) => {
    const count = bySourceRows.find((r) => r.source === s)?._count ?? 0;
    const conv = convBySource.get(s) ?? 0;
    return { source: s, count, converted: conv, rate: count ? conv / count : 0 };
  }).filter((r) => r.count > 0);

  return {
    total,
    converted,
    conversionRate: total ? converted / total : null,
    byStatus,
    bySource,
  };
}

/* ---------------------------------------------------------- pipeline ------ */

export async function pipelineMetrics({ orgId, ownerId }: Scope) {
  const deals = await prisma.deal.findMany({
    where: { orgId, archived: false, status: "OPEN", ...ownerWhere(ownerId) },
    select: { value: true, probability: true, stageId: true },
  });

  const stages = await prisma.pipelineStage.findMany({
    where: { orgId, kind: "OPEN" },
    orderBy: [{ pipelineId: "asc" }, { position: "asc" }],
    select: { id: true, name: true },
  });

  const byStage = stages.map((st) => {
    const rows = deals.filter((d) => d.stageId === st.id);
    return {
      stage: st.name,
      count: rows.length,
      value: rows.reduce((a, d) => a + num(d.value), 0),
    };
  });

  const openValue = deals.reduce((a, d) => a + num(d.value), 0);
  const weighted = deals.reduce(
    (a, d) => a + num(d.value) * ((d.probability ?? 0) / 100),
    0,
  );

  return { openCount: deals.length, openValue, weighted, byStage };
}

/* ----------------------------------------------------- deal outcomes ------ */

export async function dealOutcomeMetrics({ orgId, range, ownerId }: Scope) {
  const closedAt = inRange(range);
  const base: Prisma.DealWhereInput = {
    orgId,
    ...ownerWhere(ownerId),
    ...(closedAt ? { closedAt } : { closedAt: { not: null } }),
  };

  const won = await prisma.deal.findMany({
    where: { ...base, status: "WON" },
    select: { value: true, createdAt: true, closedAt: true, expectedCloseDate: true },
  });
  const lostCount = await prisma.deal.count({ where: { ...base, status: "LOST" } });

  const wonValue = won.reduce((a, d) => a + num(d.value), 0);
  const avgSize = won.length ? wonValue / won.length : 0;

  const cycles = won
    .filter((d) => d.closedAt)
    .map((d) => (d.closedAt!.getTime() - d.createdAt.getTime()) / 86_400_000);
  const avgCycleDays = cycles.length
    ? cycles.reduce((a, n) => a + n, 0) / cycles.length
    : null;

  const withExpected = won.filter((d) => d.expectedCloseDate && d.closedAt);
  const onTime = withExpected.filter(
    (d) => d.closedAt!.getTime() <= d.expectedCloseDate!.getTime(),
  ).length;

  return {
    wonCount: won.length,
    wonValue,
    lostCount,
    winRate: won.length + lostCount ? won.length / (won.length + lostCount) : null,
    avgSize,
    avgCycleDays,
    closedOnTime: onTime,
    closedLate: withExpected.length - onTime,
  };
}

/* ------------------------------------------------ salesperson report ------ */

export async function salespersonMetrics({ orgId, range, ownerId }: Scope) {
  const createdAt = inRange(range);
  const members = await prisma.membership.findMany({
    where: { orgId, status: "ACTIVE", ...(ownerId ? { userId: ownerId } : {}) },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { user: { name: "asc" } },
  });

  return Promise.all(
    members.map(async (m) => {
      const uid = m.user.id;
      const [leads, wonAgg, openAgg, tasksDone] = await Promise.all([
        prisma.lead.count({
          where: { orgId, ownerId: uid, archived: false, ...(createdAt ? { createdAt } : {}) },
        }),
        prisma.deal.aggregate({
          where: {
            orgId,
            ownerId: uid,
            status: "WON",
            ...(createdAt ? { closedAt: createdAt } : { closedAt: { not: null } }),
          },
          _count: true,
          _sum: { value: true },
        }),
        prisma.deal.aggregate({
          where: { orgId, ownerId: uid, archived: false, status: "OPEN" },
          _sum: { value: true },
        }),
        prisma.task.count({
          where: {
            orgId,
            assigneeId: uid,
            status: "COMPLETED",
            ...(createdAt ? { completedAt: createdAt } : {}),
          },
        }),
      ]);
      return {
        userId: uid,
        name: m.user.name,
        leads,
        dealsWon: wonAgg._count,
        wonValue: num(wonAgg._sum.value),
        openPipeline: num(openAgg._sum.value),
        tasksCompleted: tasksDone,
      };
    }),
  );
}

/* ---------------------------------------------------------- revenue ------- */

export async function revenueMetrics({ orgId, range }: Scope) {
  const paidAt = inRange(range);

  const payments = await prisma.paymentEvent.findMany({
    where: { orgId, ...(paidAt ? { paidAt } : {}) },
    select: {
      amount: true,
      invoice: {
        select: {
          company: { select: { id: true, name: true } },
          deal: { select: { source: true } },
        },
      },
    },
  });

  const collected = payments.reduce((a, p) => a + num(p.amount), 0);

  const bySourceMap = new Map<string, number>();
  const byCustomerMap = new Map<string, { name: string; total: number }>();
  for (const p of payments) {
    const src = p.invoice.deal?.source ?? "OTHER";
    bySourceMap.set(src, (bySourceMap.get(src) ?? 0) + num(p.amount));
    const co = p.invoice.company;
    if (co) {
      const cur = byCustomerMap.get(co.id) ?? { name: co.name, total: 0 };
      cur.total += num(p.amount);
      byCustomerMap.set(co.id, cur);
    }
  }

  const [outstandingAgg, quotationsInRange, quotationsConverted] = await Promise.all([
    prisma.invoiceLink.aggregate({
      where: { orgId, status: { in: ["SENT", "PARTIAL", "OVERDUE"] } },
      _sum: { balance: true },
    }),
    prisma.quotationLink.count({
      where: { orgId, ...(paidAt ? { createdAt: paidAt } : {}) },
    }),
    prisma.quotationLink.count({
      where: {
        orgId,
        ...(paidAt ? { createdAt: paidAt } : {}),
        invoices: { some: {} },
      },
    }),
  ]);

  return {
    collected,
    outstanding: num(outstandingAgg._sum.balance),
    quotationToInvoiceRate: quotationsInRange ? quotationsConverted / quotationsInRange : null,
    quotationsInRange,
    quotationsConverted,
    bySource: [...bySourceMap.entries()]
      .map(([source, total]) => ({ source, total }))
      .sort((a, b) => b.total - a.total),
    byCustomer: [...byCustomerMap.values()].sort((a, b) => b.total - a.total).slice(0, 6),
  };
}
