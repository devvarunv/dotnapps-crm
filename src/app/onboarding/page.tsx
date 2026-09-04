import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getAuthContext } from "@/lib/context";
import { prisma } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/rbac";
import { Logo } from "@/components/brand";
import { OnboardingForm } from "./onboarding-form";
import { AcceptInviteButton } from "./accept-invite-button";
import { signOutAction } from "@/app/(app)/actions";

export const metadata: Metadata = { title: "Set up your business" };

export default async function OnboardingPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (ctx.membership) redirect("/dashboard");

  const invites = await prisma.invite.findMany({
    where: {
      email: ctx.user.email.toLowerCase(),
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    include: { org: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex min-h-dvh flex-col bg-muted/30">
      <header className="mx-auto flex h-14 w-full max-w-lg items-center justify-between px-4">
        <Logo href={null} />
        <form action={signOutAction}>
          <button className="text-sm text-muted-foreground hover:text-foreground">
            Sign out
          </button>
        </form>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-6 px-4 py-10">
        {invites.length > 0 && (
          <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h2 className="text-sm font-semibold">You have pending invitations</h2>
            <ul className="mt-3 space-y-3">
              {invites.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{inv.org.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Role: {ROLE_LABELS[inv.role]}
                    </p>
                  </div>
                  <AcceptInviteButton token={inv.token} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h1 className="text-xl font-semibold tracking-tight">
            Create your business
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This is your workspace. You&apos;ll be its owner and can invite your
            team next.
          </p>
          <div className="mt-6 rounded-lg border border-border bg-card p-6 shadow-sm">
            <OnboardingForm />
          </div>
        </section>
      </main>
    </div>
  );
}
