import Link from "next/link";
import type { Metadata } from "next";
import { Check } from "lucide-react";

import { buttonClassName } from "@/components/ui/button";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";

export const metadata: Metadata = { title: "Pricing" };

const PLANS = [
  {
    name: "Starter",
    price: "$0",
    cadence: "14-day trial",
    blurb: "For a founder or a first sales hire getting organized.",
    features: [
      "Up to 3 team members",
      "Leads, contacts, companies",
      "1 pipeline",
      "CSV import & export",
      "Email support",
    ],
    highlighted: false,
  },
  {
    name: "Growth",
    price: "$29",
    cadence: "per user / month",
    blurb: "For a growing sales team that needs process and reporting.",
    features: [
      "Unlimited team members",
      "Multiple pipelines",
      "Rule-based follow-up automation",
      "Dotnapps Invoice integration",
      "Reports & analytics",
    ],
    highlighted: true,
  },
  {
    name: "Scale",
    price: "Custom",
    cadence: "annual",
    blurb: "For organizations with advanced permission and volume needs.",
    features: [
      "Granular roles & permissions",
      "Higher usage limits",
      "Priority support",
      "Audit export",
      "Onboarding assistance",
    ],
    highlighted: false,
  },
];

export default function PricingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            Simple, usage-based pricing
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Start on a free trial. Plans and limits are enforced server-side —
            no surprises, no fake upgrades.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={
                "flex flex-col rounded-xl border bg-card p-6 " +
                (plan.highlighted
                  ? "border-primary shadow-md ring-1 ring-primary/20"
                  : "border-border")
              }
            >
              {plan.highlighted && (
                <span className="mb-3 w-fit rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  Most popular
                </span>
              )}
              <h2 className="text-lg font-semibold">{plan.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{plan.blurb}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-semibold tracking-tight">
                  {plan.price}
                </span>
                <span className="text-sm text-muted-foreground">
                  {plan.cadence}
                </span>
              </div>
              <ul className="mt-5 space-y-2 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={buttonClassName({
                  variant: plan.highlighted ? "default" : "outline",
                  className: "mt-6 w-full",
                })}
              >
                Start free trial
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Billing, plan limits and subscription states are delivered in a later
          build phase. This page describes the intended plans.
        </p>
      </main>
      <MarketingFooter />
    </div>
  );
}
