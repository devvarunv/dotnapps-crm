import Link from "next/link";
import type { Metadata } from "next";

import { getCurrentUser } from "@/lib/context";
import { prisma } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/rbac";
import { Logo } from "@/components/brand";
import { buttonClassName } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import { AcceptInviteButton } from "@/app/onboarding/accept-invite-button";

export const metadata: Metadata = { title: "Team invitation" };

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [invite, user] = await Promise.all([
    prisma.invite.findUnique({ where: { token }, include: { org: true, invitedBy: true } }),
    getCurrentUser(),
  ]);

  const nextPath = `/accept-invite/${token}`;

  const invalid =
    !invite ||
    invite.status !== "PENDING" ||
    invite.expiresAt < new Date();

  return (
    <div className="flex min-h-dvh flex-col bg-muted/30">
      <header className="mx-auto flex h-14 w-full max-w-md items-center px-4">
        <Logo />
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          {invalid ? (
            <>
              <h1 className="text-lg font-semibold">Invitation unavailable</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                This invitation link is invalid, has already been used, or has
                expired. Ask an administrator of the workspace to send a new one.
              </p>
              <Link
                href="/login"
                className={buttonClassName({ variant: "outline", className: "mt-4" })}
              >
                Go to login
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-lg font-semibold">
                Join {invite!.org.name}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {invite!.invitedBy.name} invited{" "}
                <span className="font-medium text-foreground">{invite!.email}</span>{" "}
                to join as{" "}
                <span className="font-medium text-foreground">
                  {ROLE_LABELS[invite!.role]}
                </span>
                .
              </p>

              <div className="mt-5">
                {!user ? (
                  <div className="space-y-3">
                    <Alert tone="info">
                      Log in or create an account with{" "}
                      <span className="font-medium">{invite!.email}</span> to
                      accept.
                    </Alert>
                    <div className="flex gap-2">
                      <Link
                        href={`/login?callbackUrl=${encodeURIComponent(nextPath)}`}
                        className={buttonClassName({ className: "flex-1" })}
                      >
                        Log in
                      </Link>
                      <Link
                        href={`/signup?next=${encodeURIComponent(nextPath)}`}
                        className={buttonClassName({ variant: "outline", className: "flex-1" })}
                      >
                        Sign up
                      </Link>
                    </div>
                  </div>
                ) : user.email.toLowerCase() !== invite!.email.toLowerCase() ? (
                  <Alert tone="error">
                    You&apos;re logged in as{" "}
                    <span className="font-medium">{user.email}</span>, but this
                    invite was sent to{" "}
                    <span className="font-medium">{invite!.email}</span>. Log out
                    and sign in with the invited email.
                  </Alert>
                ) : (
                  <AcceptInviteButton token={token} />
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
