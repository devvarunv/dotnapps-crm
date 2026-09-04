import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { checkPermission } from "@/lib/context";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/app/page-header";
import { DeniedState } from "@/components/app/denied";
import { Card, CardContent } from "@/components/ui/primitives";
import { ContactForm } from "../../contact-form";

export const metadata: Metadata = { title: "Edit contact" };

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const check = await checkPermission("contacts:edit");
  if (!check.ok) return <DeniedState message="Your role can't edit contacts." />;

  const [contact, members, companies] = await Promise.all([
    prisma.contact.findFirst({
      where: { id, orgId: check.ctx.org.id },
      include: { tags: { select: { name: true } } },
    }),
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
  if (!contact) notFound();

  return (
    <div>
      <Link href={`/contacts/${id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> {contact.name}
      </Link>
      <PageHeader title="Edit contact" />
      <Card>
        <CardContent className="pt-5">
          <ContactForm
            mode="edit"
            values={{
              id: contact.id,
              name: contact.name,
              title: contact.title ?? "",
              email: contact.email ?? "",
              phone: contact.phone ?? "",
              whatsapp: contact.whatsapp ?? "",
              companyId: contact.companyId ?? "",
              source: contact.source ?? "",
              ownerId: contact.ownerId ?? "",
              tags: contact.tags.map((t) => t.name).join(", "),
            }}
            members={members.map((m) => ({ id: m.user.id, name: m.user.name }))}
            companies={companies}
          />
        </CardContent>
      </Card>
    </div>
  );
}
