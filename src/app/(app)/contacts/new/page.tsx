import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { checkPermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/app/page-header";
import { DeniedState } from "@/components/app/denied";
import { Card, CardContent } from "@/components/ui/primitives";
import { ContactForm } from "../contact-form";

export const metadata: Metadata = { title: "New contact" };

export default async function NewContactPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string }>;
}) {
  const check = await checkPermission("contacts:create");
  if (!check.ok) return <DeniedState message="Your role can't create contacts." />;

  const { companyId } = await searchParams;
  const [members, companies] = await Promise.all([
    prisma.membership.findMany({
      where: { orgId: check.ctx.org.id, status: "ACTIVE" },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.company.findMany({
      where: { orgId: check.ctx.org.id, archived: false },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
  ]);

  return (
    <div>
      <Link href="/contacts" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Contacts
      </Link>
      <PageHeader title="New contact" />
      <Card>
        <CardContent className="pt-5">
          <ContactForm
            mode="create"
            values={{
              name: "",
              title: "",
              email: "",
              phone: "",
              whatsapp: "",
              companyId: companyId ?? "",
              source: "",
              ownerId: check.ctx.user.id,
              tags: "",
            }}
            members={members.map((m) => ({ id: m.user.id, name: m.user.name }))}
            companies={companies}
          />
        </CardContent>
      </Card>
    </div>
  );
}
