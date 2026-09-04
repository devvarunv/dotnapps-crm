import Link from "next/link";
import {
  ArrowRight,
  UserPlus,
  Contact,
  Building2,
  Handshake,
  KanbanSquare,
  CheckSquare,
  Activity,
  FileText,
  ShieldCheck,
  Layers,
} from "lucide-react";

import { buttonClassName } from "@/components/ui/button";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";

const FLOW = [
  "Lead",
  "Contact / Company",
  "Deal",
  "Quotation",
  "Invoice",
  "Payment",
  "Revenue",
];

const FEATURES = [
  { icon: UserPlus, title: "Leads", body: "Sources, statuses, ownership, tags, notes, bulk actions and conversion without losing history." },
  { icon: Contact, title: "Contacts", body: "People with a full 360° timeline of every activity, deal and payment." },
  { icon: Building2, title: "Companies", body: "Accounts with addresses, multiple contacts, and financial totals from Dotnapps Invoice." },
  { icon: Handshake, title: "Deals", body: "Configurable pipelines with win/loss reasons, probability and expected close." },
  { icon: KanbanSquare, title: "Pipeline", body: "Drag-and-drop Kanban where every stage change is an audit event." },
  { icon: CheckSquare, title: "Tasks", body: "Follow-ups tied to any record, with reminders and overdue views." },
  { icon: Activity, title: "Activities", body: "Calls, meetings, emails and notes in one chronological timeline." },
  { icon: FileText, title: "Revenue integration", body: "Create and track quotations, invoices and payments through Dotnapps Invoice." },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 py-20 text-center">
          <p className="mx-auto mb-4 w-fit rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
            V1 · No AI · Production-grade multi-tenant SaaS
          </p>
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Turn leads into customers. Customers into revenue.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg text-muted-foreground">
            Dotnapps CRM is one connected workspace for leads, contacts,
            companies, deals, follow-ups, quotations, invoices and payments —
            fast, secure, and built on strict organization isolation.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link href="/signup" className={buttonClassName({ size: "lg" })}>
              Start free <ArrowRight />
            </Link>
            <Link
              href="/pricing"
              className={buttonClassName({ variant: "outline", size: "lg" })}
            >
              See pricing
            </Link>
          </div>
        </section>

        {/* Golden flow */}
        <section className="border-y border-border bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-10">
            <p className="mb-4 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              The golden flow
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {FLOW.map((step, i) => (
                <div key={step} className="flex items-center gap-2">
                  <span className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium">
                    {step}
                  </span>
                  {i < FLOW.length - 1 && (
                    <ArrowRight className="size-4 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-4 py-20">
          <h2 className="text-center text-2xl font-semibold tracking-tight">
            Everything a sales team needs, nothing it doesn&apos;t
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-lg border border-border bg-card p-5"
              >
                <f.icon className="size-5 text-primary" />
                <h3 className="mt-3 text-sm font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Trust */}
        <section className="border-t border-border bg-muted/30">
          <div className="mx-auto grid max-w-6xl gap-4 px-4 py-16 sm:grid-cols-3">
            {[
              { icon: ShieldCheck, title: "Secure by default", body: "Real auth, server-side RBAC, and tenant isolation checked on every object access." },
              { icon: Layers, title: "Auditable", body: "Every important mutation is written to an append-only audit log." },
              { icon: FileText, title: "One source of truth", body: "CRM owns the relationship; Dotnapps Invoice owns the money. No duplicated accounting." },
            ].map((f) => (
              <div key={f.title}>
                <f.icon className="size-5 text-primary" />
                <h3 className="mt-3 text-sm font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-4 py-20 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">
            Create your workspace in under a minute
          </h2>
          <p className="mt-2 text-muted-foreground">
            Sign up, name your business, invite your team, and add your first
            lead.
          </p>
          <Link
            href="/signup"
            className={buttonClassName({ size: "lg", className: "mt-6" })}
          >
            Get started <ArrowRight />
          </Link>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
