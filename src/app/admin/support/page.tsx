import Link from "next/link";
import type { Metadata } from "next";
import { LifeBuoy } from "lucide-react";

import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { ListToolbar } from "@/components/app/list-toolbar";
import { Card, Badge } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Support · Super Admin" };

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  TRIALING: "neutral",
  ACTIVE: "success",
  PAST_DUE: "warning",
  GRACE: "warning",
  SUSPENDED: "danger",
  CANCELED: "neutral",
};

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const q = (Array.isArray(raw.q) ? raw.q[0] : raw.q)?.trim() ?? "";

  const [matchedOrgs, matchedUsers, attention, staleInvites] = await Promise.all([
    q
      ? prisma.organization.findMany({
          where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: q, mode: "insensitive" } }] },
          take: 10,
          include: { subscription: { include: { plan: true } }, _count: { select: { memberships: true } } },
        })
      : Promise.resolve([]),
    q
      ? prisma.user.findMany({
          where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] },
          take: 10,
          include: { memberships: { include: { org: { select: { id: true, name: true } } } } },
        })
      : Promise.resolve([]),
    prisma.subscription.findMany({
      where: { status: { in: ["PAST_DUE", "GRACE", "SUSPENDED"] } },
      orderBy: { updatedAt: "desc" },
      include: { org: { select: { id: true, name: true } }, plan: true },
      take: 20,
    }),
    prisma.invite.findMany({
      where: { status: "PENDING", expiresAt: { lt: new Date(Date.now() + 3 * 86_400_000) } },
      orderBy: { expiresAt: "asc" },
      include: { org: { select: { id: true, name: true } } },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <LifeBuoy className="size-5 text-primary" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Support</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Look up a business or user, and see what needs attention right now.
          </p>
        </div>
      </div>

      <ListToolbar filters={[]} searchPlaceholder="Search a business or user by name/email…" />

      {q && (
        <section className="grid gap-4 sm:grid-cols-2">
          <div>
            <h2 className="mb-2 text-sm font-semibold">Businesses ({matchedOrgs.length})</h2>
            <Card className="divide-y divide-border">
              {matchedOrgs.map((o) => (
                <Link
                  key={o.id}
                  href={`/admin/businesses/${o.id}`}
                  className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm hover:bg-muted/30"
                >
                  <span className="font-medium">{o.name}</span>
                  <span className="text-xs text-muted-foreground">{o._count.memberships} members</span>
                  {o.subscription && (
                    <Badge tone={STATUS_TONE[o.subscription.status] ?? "neutral"}>
                      {o.subscription.status.toLowerCase()}
                    </Badge>
                  )}
                </Link>
              ))}
              {matchedOrgs.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">No match.</p>
              )}
            </Card>
          </div>
          <div>
            <h2 className="mb-2 text-sm font-semibold">Users ({matchedUsers.length})</h2>
            <Card className="divide-y divide-border">
              {matchedUsers.map((u) => (
                <div key={u.id} className="px-4 py-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{u.name}</span>
                    {u.isSuperAdmin && <Badge tone="brand">Super Admin</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {u.memberships.map((m) => (
                      <Link key={m.orgId} href={`/admin/businesses/${m.orgId}`}>
                        <Badge tone="neutral">
                          {m.org.name} · {m.role.toLowerCase()}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              {matchedUsers.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">No match.</p>
              )}
            </Card>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold">
          Businesses needing attention <span className="font-normal text-muted-foreground">(billing)</span>
        </h2>
        <Card className="divide-y divide-border">
          {attention.map((s) => (
            <Link
              key={s.id}
              href={`/admin/businesses/${s.orgId}`}
              className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/30"
            >
              <span className="font-medium">{s.org.name}</span>
              <Badge tone={STATUS_TONE[s.status] ?? "neutral"}>{s.status.toLowerCase()}</Badge>
              <span className="text-xs text-muted-foreground">{s.plan.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                period ends {formatDate(s.currentPeriodEnd)}
              </span>
            </Link>
          ))}
          {attention.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No business is past due, in grace, or suspended.
            </p>
          )}
        </Card>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Invites expiring soon</h2>
        <Card className="divide-y divide-border">
          {staleInvites.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
              <span className="font-medium">{i.email}</span>
              <Link href={`/admin/businesses/${i.orgId}`} className="text-xs text-muted-foreground hover:underline">
                {i.org.name}
              </Link>
              <span className="ml-auto text-xs text-muted-foreground">
                {i.expiresAt < new Date() ? "expired" : "expires"} {formatDate(i.expiresAt)}
              </span>
            </div>
          ))}
          {staleInvites.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Nothing expiring in the next 3 days.
            </p>
          )}
        </Card>
      </section>
    </div>
  );
}
