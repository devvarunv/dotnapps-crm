import Link from "next/link";
import type { Metadata } from "next";
import { Check } from "lucide-react";

import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/billing/entitlements";
import { buttonClassName } from "@/components/ui/button";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-chrome";

export const metadata: Metadata = { title: "Pricing" };
export const revalidate = 300;

export default async function PricingPage() {
  const plans = await prisma.subscriptionPlan.findMany({
    where: { isPublic: true, active: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            Simple, usage-based pricing
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Start on a free trial. Plan limits are enforced server-side — no
            surprises, no fake upgrades.
          </p>
        </div>

        {plans.length === 0 ? (
          <p className="mt-12 text-center text-sm text-muted-foreground">
            Plans are being configured. Check back shortly.
          </p>
        ) : (
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {plans.map((plan, i) => {
              const highlighted = i === 1 && plans.length >= 3;
              return (
                <div
                  key={plan.id}
                  className={
                    "flex flex-col rounded-xl border bg-card p-6 " +
                    (highlighted
                      ? "border-primary shadow-md ring-1 ring-primary/20"
                      : "border-border")
                  }
                >
                  {highlighted && (
                    <span className="mb-3 w-fit rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      Most popular
                    </span>
                  )}
                  <h2 className="text-lg font-semibold">{plan.name}</h2>
                  {plan.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                  )}
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-semibold tracking-tight">
                      {formatPrice(plan)}
                    </span>
                    {plan.trialDays > 0 && plan.priceCents === 0 && (
                      <span className="text-sm text-muted-foreground">
                        · {plan.trialDays}-day trial
                      </span>
                    )}
                  </div>
                  <ul className="mt-5 flex-1 space-y-2 text-sm">
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
                      variant: highlighted ? "default" : "outline",
                      className: "mt-6 w-full",
                    })}
                  >
                    Start free trial
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Plans and limits are configurable by the platform team. Upgrades,
          downgrades and cancellation are self-serve in Settings → Subscription.
        </p>
      </main>
      <MarketingFooter />
    </div>
  );
}
