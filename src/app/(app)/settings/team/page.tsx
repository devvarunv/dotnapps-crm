import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { requireOrgContext } from "@/lib/context";
import { prisma } from "@/lib/db";
import { can, assignableRoles, ROLE_LABELS } from "@/lib/rbac";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/app/page-header";
import { DeniedState } from "@/components/app/denied";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui/primitives";
import {
  InviteForm,
  MemberRoleControl,
  RemoveMemberButton,
  RevokeInviteButton,
} from "./team-client";

export const metadata: Metadata = { title: "Team members" };

export default async function TeamPage() {
  const ctx = await requireOrgContext();
  if (!can(ctx.role, "members:view")) return <DeniedState />;

  const canInvite = can(ctx.role, "members:invite");
  const canManage = can(ctx.role, "members:manage");
  const roles = assignableRoles(ctx.role);

  const [members, invites] = await Promise.all([
    prisma.membership.findMany({
      where: { orgId: ctx.org.id },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    }),
    prisma.invite.findMany({
      where: { orgId: ctx.org.id, status: "PENDING" },
      include: { invitedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div>
      <Link
        href="/settings"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Settings
      </Link>
      <PageHeader
        title="Team members"
        description="People with access to this workspace."
      />

      {canInvite && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Invite a teammate</CardTitle>
          </CardHeader>
          <CardContent>
            <InviteForm roles={roles} />
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>
            Members{" "}
            <span className="font-normal text-muted-foreground">
              ({members.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {members.map((m) => {
              const isSelf = m.userId === ctx.user.id;
              const isOwner = m.role === "OWNER";
              const editable = canManage && !isSelf && !isOwner;
              return (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {m.user.name}
                      {isSelf && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (you)
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.user.email} · joined {formatDate(m.createdAt)}
                    </p>
                  </div>

                  {editable ? (
                    <MemberRoleControl
                      membershipId={m.id}
                      currentRole={m.role}
                      roles={roles}
                    />
                  ) : (
                    <Badge tone={isOwner ? "brand" : "neutral"}>
                      {ROLE_LABELS[m.role]}
                    </Badge>
                  )}

                  {editable ? (
                    <RemoveMemberButton membershipId={m.id} name={m.user.name} />
                  ) : (
                    <span className="w-9" />
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {canInvite && invites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending invitations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {invites.map((inv) => {
                const expired = inv.expiresAt < new Date();
                return (
                  <li
                    key={inv.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{inv.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {ROLE_LABELS[inv.role]} · invited by {inv.invitedBy.name} ·{" "}
                        {expired ? (
                          <span className="text-destructive">expired</span>
                        ) : (
                          <>expires {formatDate(inv.expiresAt)}</>
                        )}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}
                        /accept-invite/{inv.token}
                      </p>
                    </div>
                    <RevokeInviteButton inviteId={inv.id} />
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
