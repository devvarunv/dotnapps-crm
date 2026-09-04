import Link from "next/link";
import type { Metadata } from "next";
import { Search as SearchIcon, UserPlus, Contact as ContactIcon, Building2 } from "lucide-react";

import { requireOrgContext } from "@/lib/context";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { LEAD_STATUS_LABELS } from "@/lib/crm/labels";
import { PageHeader } from "@/components/app/page-header";
import { SearchBox } from "./search-box";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await requireOrgContext();
  const q = ((await searchParams).q ?? "").trim().slice(0, 120);

  const contains = { contains: q, mode: "insensitive" as const };
  const take = 8;

  const [leads, contacts, companies] = await Promise.all([
    q && can(ctx.role, "leads:view")
      ? prisma.lead.findMany({
          where: {
            orgId: ctx.org.id,
            archived: false,
            OR: [{ name: contains }, { email: contains }, { companyName: contains }, { phone: contains }],
          },
          take,
          orderBy: { updatedAt: "desc" },
          select: { id: true, name: true, companyName: true, status: true },
        })
      : [],
    q && can(ctx.role, "contacts:view")
      ? prisma.contact.findMany({
          where: {
            orgId: ctx.org.id,
            archived: false,
            OR: [{ name: contains }, { email: contains }, { phone: contains }],
          },
          take,
          orderBy: { updatedAt: "desc" },
          select: { id: true, name: true, title: true, company: { select: { name: true } } },
        })
      : [],
    q && can(ctx.role, "companies:view")
      ? prisma.company.findMany({
          where: {
            orgId: ctx.org.id,
            archived: false,
            OR: [{ name: contains }, { website: contains }, { industry: contains }],
          },
          take,
          orderBy: { updatedAt: "desc" },
          select: { id: true, name: true, industry: true },
        })
      : [],
  ]);

  const totalResults = leads.length + contacts.length + companies.length;

  return (
    <div>
      <PageHeader title="Search" description="Find leads, contacts and companies." />
      <SearchBox defaultValue={q} />

      {!q ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Type at least one character to search across your workspace.
        </p>
      ) : totalResults === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          No matches for “{q}”.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          <ResultGroup icon={UserPlus} title="Leads" count={leads.length}>
            {leads.map((l) => (
              <ResultRow key={l.id} href={`/leads/${l.id}`} primary={l.name} secondary={`${l.companyName ?? "—"} · ${LEAD_STATUS_LABELS[l.status]}`} />
            ))}
          </ResultGroup>
          <ResultGroup icon={ContactIcon} title="Contacts" count={contacts.length}>
            {contacts.map((c) => (
              <ResultRow key={c.id} href={`/contacts/${c.id}`} primary={c.name} secondary={[c.title, c.company?.name].filter(Boolean).join(" · ") || "—"} />
            ))}
          </ResultGroup>
          <ResultGroup icon={Building2} title="Companies" count={companies.length}>
            {companies.map((c) => (
              <ResultRow key={c.id} href={`/companies/${c.id}`} primary={c.name} secondary={c.industry ?? "—"} />
            ))}
          </ResultGroup>
        </div>
      )}
    </div>
  );
}

function ResultGroup({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: typeof SearchIcon;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div>
      <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3.5" /> {title} ({count})
      </h2>
      <div className="divide-y divide-border rounded-lg border border-border bg-card">
        {children}
      </div>
    </div>
  );
}

function ResultRow({
  href,
  primary,
  secondary,
}: {
  href: string;
  primary: string;
  secondary: string;
}) {
  return (
    <Link href={href} className="block px-4 py-2.5 text-sm hover:bg-muted/50">
      <span className="font-medium">{primary}</span>
      <span className="ml-2 text-xs text-muted-foreground">{secondary}</span>
    </Link>
  );
}
