import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { requireOrgContext } from "@/lib/context";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { OrgForm } from "./org-form";

export const metadata: Metadata = { title: "Organization" };

export default async function OrganizationSettingsPage() {
  const ctx = await requireOrgContext();
  const editable = can(ctx.role, "org:manage");

  const [memberCount, createdBy] = await Promise.all([
    prisma.membership.count({ where: { orgId: ctx.org.id, status: "ACTIVE" } }),
    prisma.user.findUnique({
      where: { id: ctx.org.createdById },
      select: { name: true },
    }),
  ]);

  return (
    <div>
      <Link
        href="/settings"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Settings
      </Link>
      <PageHeader title="Organization" />

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Business name</CardTitle>
          </CardHeader>
          <CardContent>
            <OrgForm defaultName={ctx.org.name} editable={editable} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workspace</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Workspace URL slug</dt>
                <dd className="font-medium">{ctx.org.slug}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Active members</dt>
                <dd className="font-medium">{memberCount}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd className="font-medium">{formatDate(ctx.org.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Created by</dt>
                <dd className="font-medium">{createdBy?.name ?? "—"}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
