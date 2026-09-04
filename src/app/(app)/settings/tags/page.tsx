import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { requireOrgContext } from "@/lib/context";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/app/page-header";
import { DeniedState } from "@/components/app/denied";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { CreateTag, TagList } from "./tags-client";

export const metadata: Metadata = { title: "Tags" };

export default async function TagsSettingsPage() {
  const ctx = await requireOrgContext();
  if (!can(ctx.role, "org:manage")) {
    return <DeniedState message="Only owners and admins manage tags." />;
  }

  const tags = await prisma.tag.findMany({
    where: { orgId: ctx.org.id },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { leads: true, contacts: true, companies: true } },
    },
  });

  return (
    <div>
      <Link href="/settings" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Settings
      </Link>
      <PageHeader title="Tags" description="Shared labels for leads, contacts and companies." />

      <Card className="mb-6">
        <CardHeader><CardTitle>New tag</CardTitle></CardHeader>
        <CardContent><CreateTag /></CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All tags ({tags.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {tags.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tags yet.</p>
          ) : (
            <TagList
              tags={tags.map((t) => ({
                id: t.id,
                name: t.name,
                color: t.color,
                usage: t._count.leads + t._count.contacts + t._count.companies,
              }))}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
