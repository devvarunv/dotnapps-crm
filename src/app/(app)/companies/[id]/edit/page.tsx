import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { checkPermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/app/page-header";
import { DeniedState } from "@/components/app/denied";
import { Card, CardContent } from "@/components/ui/primitives";
import { CompanyForm } from "../../company-form";

export const metadata: Metadata = { title: "Edit company" };

export default async function EditCompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const check = await checkPermission("companies:edit");
  if (!check.ok) return <DeniedState message="Your role can't edit companies." />;

  const [company, members] = await Promise.all([
    prisma.company.findFirst({
      where: { id, orgId: check.ctx.org.id },
      include: { tags: { select: { name: true } } },
    }),
    prisma.membership.findMany({
      where: { orgId: check.ctx.org.id, status: "ACTIVE" },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
  ]);
  if (!company) notFound();

  return (
    <div>
      <Link href={`/companies/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> {company.name}
      </Link>
      <PageHeader title="Edit company" />
      <Card>
        <CardContent className="pt-5">
          <CompanyForm
            mode="edit"
            values={{
              id: company.id,
              name: company.name,
              website: company.website ?? "",
              industry: company.industry ?? "",
              size: company.size ?? "",
              gstin: company.gstin ?? "",
              ownerId: company.ownerId ?? "",
              tags: company.tags.map((t) => t.name).join(", "),
            }}
            members={members.map((m) => ({ id: m.user.id, name: m.user.name }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
