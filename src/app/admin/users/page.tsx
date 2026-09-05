import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";

import { requireSuperAdmin } from "@/lib/context";
import { prisma } from "@/lib/db";
import { formatDate, initials } from "@/lib/utils";
import { parseListParams, paginate } from "@/lib/crm/query";
import { PageHeader } from "@/components/app/page-header";
import { ListToolbar } from "@/components/app/list-toolbar";
import { Pagination } from "@/components/app/pagination";
import { Card, Badge } from "@/components/ui/primitives";
import { ToggleSuperAdminButton } from "./users-client";

export const metadata: Metadata = { title: "Users · Super Admin" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireSuperAdmin();
  const raw = await searchParams;
  const p = parseListParams(raw, { defaultSort: "createdAt", sortable: ["createdAt", "name", "email"] });

  const where: Prisma.UserWhereInput = p.q
    ? {
        OR: [
          { name: { contains: p.q, mode: "insensitive" } },
          { email: { contains: p.q, mode: "insensitive" } },
        ],
      }
    : {};

  const total = await prisma.user.count({ where });
  const pg = paginate(p.page, total);

  const users = await prisma.user.findMany({
    where,
    orderBy: { [p.sort]: p.dir },
    skip: pg.skip,
    take: pg.take,
    include: {
      memberships: {
        where: { status: "ACTIVE" },
        include: { org: { select: { id: true, name: true } } },
      },
    },
  });

  return (
    <div>
      <PageHeader title="Users" description={`${total} user${total === 1 ? "" : "s"} on the platform.`} />

      <ListToolbar filters={[]} searchPlaceholder="Search name or email…" />

      <Card className="divide-y divide-border">
        {users.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium">
              {initials(u.name)}
            </span>
            <div className="min-w-[180px]">
              <p className="font-medium">{u.name}</p>
              <p className="text-xs text-muted-foreground">{u.email}</p>
            </div>
            <div className="flex flex-wrap gap-1">
              {u.memberships.map((m) => (
                <Badge key={m.orgId} tone="neutral">
                  {m.org.name}
                </Badge>
              ))}
              {u.memberships.length === 0 && (
                <span className="text-xs text-muted-foreground">no workspace</span>
              )}
            </div>
            {u.isSuperAdmin && <Badge tone="brand">Super Admin</Badge>}
            <span className="text-xs text-muted-foreground">joined {formatDate(u.createdAt)}</span>
            <div className="ml-auto">
              <ToggleSuperAdminButton userId={u.id} name={u.name} isSuperAdmin={u.isSuperAdmin} />
            </div>
          </div>
        ))}
        {users.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">No users match.</p>
        )}
      </Card>

      <Pagination basePath="/admin/users" raw={p.raw} current={pg.current} pages={pg.pages} total={total} />

      <p className="mt-4 text-xs text-muted-foreground">
        Signed in as {me.email}. You can't revoke your own Super Admin access, and at least one
        Super Admin must always remain.
      </p>
    </div>
  );
}
