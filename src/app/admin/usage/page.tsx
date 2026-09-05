import Link from "next/link";
import type { Metadata } from "next";

import { prisma } from "@/lib/db";
import { parseListParams, paginate } from "@/lib/crm/query";
import { PLAN_METRICS, METRIC_LABELS, checkLimit, getSubscription } from "@/lib/billing/entitlements";
import { PageHeader } from "@/components/app/page-header";
import { ListToolbar } from "@/components/app/list-toolbar";
import { Pagination } from "@/components/app/pagination";
import { Card, Badge } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Usage · Super Admin" };

export default async function AdminUsagePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const p = parseListParams(raw, { defaultSort: "name", sortable: ["name", "createdAt"] });

  const [platformTotals, total] = await Promise.all([
    Promise.all([
      prisma.lead.count({ where: { archived: false } }),
      prisma.contact.count({ where: { archived: false } }),
      prisma.company.count({ where: { archived: false } }),
      prisma.deal.count({ where: { archived: false } }),
      prisma.organization.count(),
      prisma.user.count(),
    ]),
    prisma.organization.count(
      p.q ? { where: { name: { contains: p.q, mode: "insensitive" } } } : undefined,
    ),
  ]);
  const [leads, contacts, companies, deals, orgCount, userCount] = platformTotals;
  const pg = paginate(p.page, total);

  const orgs = await prisma.organization.findMany({
    where: p.q ? { name: { contains: p.q, mode: "insensitive" } } : undefined,
    orderBy: { [p.sort]: p.dir },
    skip: pg.skip,
    take: pg.take,
    select: { id: true, name: true },
  });

  const usageByOrg = await Promise.all(
    orgs.map(async (o) => {
      // Ensure the subscription row exists before checking metrics in
      // parallel below — otherwise every metric races to lazily create one.
      await getSubscription(o.id);
      return { org: o, usage: await Promise.all(PLAN_METRICS.map((m) => checkLimit(o.id, m))) };
    }),
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Usage" description="CRM volume and per-plan usage across the platform." />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Businesses", value: orgCount },
          { label: "Users", value: userCount },
          { label: "Leads", value: leads },
          { label: "Contacts", value: contacts },
          { label: "Companies", value: companies },
          { label: "Deals", value: deals },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
          </Card>
        ))}
      </section>

      <div>
        <h2 className="mb-3 text-sm font-semibold">Usage by business</h2>
        <ListToolbar filters={[]} searchPlaceholder="Search business…" />
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Business</th>
                {PLAN_METRICS.map((m) => (
                  <th key={m} className="whitespace-nowrap px-3 py-2 font-medium">
                    {METRIC_LABELS[m]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {usageByOrg.map(({ org, usage }) => (
                <tr key={org.id}>
                  <td className="px-4 py-2 font-medium">
                    <Link href={`/admin/businesses/${org.id}`} className="hover:underline">
                      {org.name}
                    </Link>
                  </td>
                  {usage.map((u) => (
                    <td key={u.metric} className="whitespace-nowrap px-3 py-2 tabular-nums">
                      {u.used}
                      {u.limit !== null && <span className="text-muted-foreground"> / {u.limit}</span>}
                      {u.limit !== null && u.used >= u.limit && (
                        <Badge tone="danger" className="ml-1">
                          max
                        </Badge>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              {usageByOrg.length === 0 && (
                <tr>
                  <td colSpan={PLAN_METRICS.length + 1} className="px-4 py-6 text-center text-muted-foreground">
                    No businesses match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
        <Pagination basePath="/admin/usage" raw={p.raw} current={pg.current} pages={pg.pages} total={total} />
      </div>
    </div>
  );
}
