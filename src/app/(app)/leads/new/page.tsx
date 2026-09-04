import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { checkPermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/app/page-header";
import { DeniedState } from "@/components/app/denied";
import { Card, CardContent } from "@/components/ui/primitives";
import { LeadForm, type LeadFormValues } from "../lead-form";

export const metadata: Metadata = { title: "New lead" };

const EMPTY: LeadFormValues = {
  name: "",
  companyName: "",
  email: "",
  phone: "",
  whatsapp: "",
  website: "",
  source: "MANUAL",
  industry: "",
  location: "",
  status: "NEW",
  estimatedValue: "",
  nextFollowUpAt: "",
  ownerId: "",
  tags: "",
};

export default async function NewLeadPage() {
  const check = await checkPermission("leads:create");
  if (!check.ok) return <DeniedState message="Your role can't create leads." />;

  const members = await prisma.membership.findMany({
    where: { orgId: check.ctx.org.id, status: "ACTIVE" },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { user: { name: "asc" } },
  });

  return (
    <div>
      <Link href="/leads" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Leads
      </Link>
      <PageHeader title="New lead" />
      <Card>
        <CardContent className="pt-5">
          <LeadForm
            mode="create"
            values={{ ...EMPTY, ownerId: check.ctx.user.id }}
            members={members.map((m) => ({ id: m.user.id, name: m.user.name }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
