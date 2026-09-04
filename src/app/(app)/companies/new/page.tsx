import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { checkPermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/app/page-header";
import { DeniedState } from "@/components/app/denied";
import { Card, CardContent } from "@/components/ui/primitives";
import { CompanyForm } from "../company-form";

export const metadata: Metadata = { title: "New company" };

export default async function NewCompanyPage() {
  const check = await checkPermission("companies:create");
  if (!check.ok) return <DeniedState message="Your role can't create companies." />;

  const members = await prisma.membership.findMany({
    where: { orgId: check.ctx.org.id, status: "ACTIVE" },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { user: { name: "asc" } },
  });

  return (
    <div>
      <Link href="/companies" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Companies
      </Link>
      <PageHeader title="New company" />
      <Card>
        <CardContent className="pt-5">
          <CompanyForm
            mode="create"
            values={{
              name: "",
              website: "",
              industry: "",
              size: "",
              gstin: "",
              ownerId: check.ctx.user.id,
              tags: "",
            }}
            members={members.map((m) => ({ id: m.user.id, name: m.user.name }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
