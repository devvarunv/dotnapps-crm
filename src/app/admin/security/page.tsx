import Link from "next/link";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { ShieldAlert } from "lucide-react";

import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { AUDIT_LABELS } from "@/lib/audit-labels";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { parseListParams, paginate } from "@/lib/crm/query";
import { PageHeader } from "@/components/app/page-header";
import { ListToolbar } from "@/components/app/list-toolbar";
import { Pagination } from "@/components/app/pagination";
import { Card, Badge } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Security · Super Admin" };

export default async function AdminSecurityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const p = parseListParams(raw, { defaultSort: "createdAt", sortable: ["createdAt"] });
  const scope = (Array.isArray(raw.scope) ? raw.scope[0] : raw.scope) ?? "";

  const where: Prisma.AuditLogWhereInput = {
    ...(scope === "platform" ? { orgId: null } : {}),
    ...(scope === "business" ? { orgId: { not: null } } : {}),
    ...(p.q
      ? {
          OR: [
            { action: { contains: p.q, mode: "insensitive" } },
            { actor: { name: { contains: p.q, mode: "insensitive" } } },
            { actor: { email: { contains: p.q, mode: "insensitive" } } },
            { org: { name: { contains: p.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [total, superAdmins] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.user.findMany({ where: { isSuperAdmin: true }, select: { id: true, name: true, email: true } }),
  ]);
  const pg = paginate(p.page, total);

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: pg.skip,
    take: pg.take,
    include: { actor: { select: { name: true, email: true } }, org: { select: { name: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShieldAlert className="size-5 text-primary" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Security</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Platform-wide audit trail, Super Admin access, and rate-limit policy.
          </p>
        </div>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold">
          Super Admins <span className="font-normal text-muted-foreground">({superAdmins.length})</span>
        </h2>
        <Card className="divide-y divide-border">
          {superAdmins.map((u) => (
            <div key={u.id} className="flex items-center gap-2 px-4 py-2 text-sm">
              <span className="font-medium">{u.name}</span>
              <span className="text-xs text-muted-foreground">{u.email}</span>
            </div>
          ))}
        </Card>
        <p className="mt-2 text-xs text-muted-foreground">
          Manage who has platform-level access from{" "}
          <Link href="/admin/users" className="underline">
            Users
          </Link>
          .
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Rate limit policy</h2>
        <Card className="divide-y divide-border">
          {Object.entries(RATE_LIMITS).map(([key, cfg]) => (
            <div key={key} className="flex items-center justify-between px-4 py-2 text-sm">
              <span className="font-medium">{key}</span>
              <span className="text-xs text-muted-foreground">
                {cfg.limit} requests / {Math.round(cfg.windowMs / 1000)}s
              </span>
            </div>
          ))}
        </Card>
        <p className="mt-2 text-xs text-muted-foreground">
          Configured limits (see <code>src/lib/rate-limit.ts</code>). Counters are in-process and not
          exposed live here — see the Health tab for process-level status.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Audit log</h2>
        <ListToolbar
          filters={[
            {
              name: "scope",
              label: "Scope",
              options: [
                { value: "platform", label: "Platform-level" },
                { value: "business", label: "Business-level" },
              ],
            },
          ]}
          searchPlaceholder="Search action, actor, or business…"
        />
        <Card className="divide-y divide-border">
          {logs.map((log) => (
            <div key={log.id} className="flex flex-wrap items-baseline gap-2 px-4 py-2 text-sm">
              <span className="font-medium">{AUDIT_LABELS[log.action] ?? log.action}</span>
              <span className="text-xs text-muted-foreground">
                {log.actor ? `${log.actor.name} (${log.actor.email})` : "System"}
                {log.org?.name ? ` · ${log.org.name}` : " · platform"}
                {log.ip ? ` · ${log.ip}` : ""} · {formatDate(log.createdAt)}
              </span>
            </div>
          ))}
          {logs.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No matching activity.</p>
          )}
        </Card>
        <Pagination basePath="/admin/security" raw={p.raw} current={pg.current} pages={pg.pages} total={total} />
      </section>
    </div>
  );
}
