import Link from "next/link";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { parseListParams, paginate } from "@/lib/crm/query";
import { PageHeader } from "@/components/app/page-header";
import { ListToolbar } from "@/components/app/list-toolbar";
import { Pagination } from "@/components/app/pagination";
import { Card, Badge } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Businesses · Super Admin" };

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  TRIALING: "neutral",
  ACTIVE: "success",
  PAST_DUE: "warning",
  GRACE: "warning",
  SUSPENDED: "danger",
  CANCELED: "neutral",
};

export default async function AdminBusinessesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const p = parseListParams(raw, { defaultSort: "createdAt", sortable: ["createdAt", "name"] });

  const where: Prisma.OrganizationWhereInput = p.q
    ? {
        OR: [
          { name: { contains: p.q, mode: "insensitive" } },
          { slug: { contains: p.q, mode: "insensitive" } },
        ],
      }
    : {};

  const total = await prisma.organization.count({ where });
  const pg = paginate(p.page, total);

  const orgs = await prisma.organization.findMany({
    where,
    orderBy: { [p.sort]: p.dir },
    skip: pg.skip,
    take: pg.take,
    include: {
      createdBy: { select: { name: true, email: true } },
      subscription: { include: { plan: true } },
      _count: { select: { memberships: true } },
    },
  });

  return (
    <div>
      <PageHeader
        title="Businesses"
        description={`${total} workspace${total === 1 ? "" : "s"} on the platform.`}
      />

      <ListToolbar filters={[]} searchPlaceholder="Search name or slug…" />

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Plan</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Members</th>
              <th className="px-4 py-2 font-medium">Owner</th>
              <th className="px-4 py-2 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orgs.map((o) => (
              <tr key={o.id} className="hover:bg-muted/30">
                <td className="px-4 py-2 font-medium">
                  <Link href={`/admin/businesses/${o.id}`} className="hover:underline">
                    {o.name}
                  </Link>
                  <div className="text-xs font-normal text-muted-foreground">{o.slug}</div>
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {o.subscription?.plan.name ?? "—"}
                </td>
                <td className="px-4 py-2">
                  {o.subscription ? (
                    <Badge tone={STATUS_TONE[o.subscription.status] ?? "neutral"}>
                      {o.subscription.status.toLowerCase()}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">no subscription</span>
                  )}
                </td>
                <td className="px-4 py-2 tabular-nums">{o._count.memberships}</td>
                <td className="px-4 py-2 text-muted-foreground">{o.createdBy.email}</td>
                <td className="px-4 py-2 text-muted-foreground">{formatDate(o.createdAt)}</td>
              </tr>
            ))}
            {orgs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  No businesses match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Pagination basePath="/admin/businesses" raw={p.raw} current={pg.current} pages={pg.pages} total={total} />
    </div>
  );
}
