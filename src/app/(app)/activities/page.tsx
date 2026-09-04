import Link from "next/link";
import type { Metadata } from "next";
import { Activity as ActivityIcon } from "lucide-react";

import { checkPermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { paginate, filterValue } from "@/lib/crm/query";
import { ACTIVITY_TYPE_LABELS } from "@/lib/crm/labels";
import { PageHeader } from "@/components/app/page-header";
import { DeniedState } from "@/components/app/denied";
import { ListToolbar } from "@/components/app/list-toolbar";
import { Pagination } from "@/components/app/pagination";
import type { ActivityType } from "@prisma/client";

export const metadata: Metadata = { title: "Activities" };

const TYPES: ActivityType[] = [
  "NOTE",
  "CALL",
  "MEETING",
  "EMAIL",
  "WHATSAPP",
  "FOLLOW_UP",
  "DEMO",
  "TASK",
];

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const check = await checkPermission("activities:view");
  if (!check.ok) return <DeniedState />;
  const { ctx } = check;

  const raw = await searchParams;
  const typeFilter = filterValue(raw, "type");
  const pageNum = Math.max(1, parseInt(filterValue(raw, "page") || "1", 10) || 1);

  const where = {
    orgId: ctx.org.id,
    ...(TYPES.includes(typeFilter as ActivityType)
      ? { type: typeFilter as ActivityType }
      : {}),
  };

  const total = await prisma.activity.count({ where });
  const pg = paginate(pageNum, total);

  const activities = await prisma.activity.findMany({
    where,
    orderBy: { occurredAt: "desc" },
    skip: pg.skip,
    take: pg.take,
    include: {
      createdBy: { select: { name: true } },
      lead: { select: { id: true, name: true } },
      contact: { select: { id: true, name: true } },
      company: { select: { id: true, name: true } },
      deal: { select: { id: true, name: true } },
    },
  });

  function link(a: (typeof activities)[number]) {
    if (a.deal) return { label: a.deal.name, href: `/deals/${a.deal.id}` };
    if (a.lead) return { label: a.lead.name, href: `/leads/${a.lead.id}` };
    if (a.contact) return { label: a.contact.name, href: `/contacts/${a.contact.id}` };
    if (a.company) return { label: a.company.name, href: `/companies/${a.company.id}` };
    return null;
  }

  return (
    <div>
      <PageHeader title="Activities" description="Everything logged across the workspace." />

      <ListToolbar
        hideSearch
        filters={[
          {
            name: "type",
            label: "Type",
            options: TYPES.map((t) => ({ value: t, label: ACTIVITY_TYPE_LABELS[t] })),
          },
        ]}
      />

      {total === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          <ActivityIcon className="mx-auto mb-2 size-5" />
          No activity recorded yet.
        </p>
      ) : (
        <>
          <ol className="divide-y divide-border rounded-lg border border-border bg-card">
            {activities.map((a) => {
              const l = link(a);
              return (
                <li key={a.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-4 py-3 text-sm">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                    {ACTIVITY_TYPE_LABELS[a.type]}
                  </span>
                  <span className="font-medium">
                    {a.subject || (a.body ? a.body.slice(0, 80) : ACTIVITY_TYPE_LABELS[a.type])}
                  </span>
                  {l && (
                    <Link href={l.href} className="text-primary hover:underline">
                      {l.label}
                    </Link>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {a.createdBy?.name ?? "System"} ·{" "}
                    {a.occurredAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                    {a.source === "SYSTEM" ? " · system" : ""}
                  </span>
                </li>
              );
            })}
          </ol>
          <Pagination basePath="/activities" raw={raw} current={pg.current} pages={pg.pages} total={pg.total} />
        </>
      )}
    </div>
  );
}
