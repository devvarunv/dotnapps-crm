import Link from "next/link";
import type { Metadata } from "next";
import { Bell, Check } from "lucide-react";

import { requireOrgContext } from "@/lib/context";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/app/page-header";
import { Button, buttonClassName } from "@/components/ui/button";
import { markNotificationReadAction, markAllNotificationsReadAction } from "./actions";

export const metadata: Metadata = { title: "Notifications" };

const TYPE_LABELS: Record<string, string> = {
  ASSIGNMENT: "Assigned to you",
  MENTION: "Mention",
  TASK_OVERDUE: "Overdue task",
  STAGE_CHANGE: "Stage change",
  CLOSE_APPROACHING: "Close date",
  AUTOMATION_FOLLOWUP: "Automation",
  GENERIC: "Notice",
};

export default async function NotificationsPage() {
  const ctx = await requireOrgContext();

  const items = await prisma.notification.findMany({
    where: { userId: ctx.user.id, orgId: ctx.org.id },
    orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
    take: 100,
  });
  const unread = items.filter((i) => !i.readAt).length;

  return (
    <div>
      <PageHeader
        title="Notifications"
        description={unread > 0 ? `${unread} unread` : "You're all caught up."}
        actions={
          unread > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <Button type="submit" variant="outline" size="sm">
                <Check className="size-4" /> Mark all read
              </Button>
            </form>
          ) : undefined
        }
      />

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          <Bell className="mx-auto mb-2 size-5" />
          Nothing here yet. Assignments, mentions and automation follow-ups show up here.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {items.map((n) => (
            <li
              key={n.id}
              className={
                "flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-3 text-sm " +
                (n.readAt ? "" : "bg-primary/5")
              }
            >
              <span className="mt-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                {TYPE_LABELS[n.type] ?? n.type}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {n.url ? (
                    <Link href={n.url} className="hover:underline">
                      {n.title}
                    </Link>
                  ) : (
                    n.title
                  )}
                </p>
                {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {n.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
              {!n.readAt && (
                <form action={markNotificationReadAction}>
                  <input type="hidden" name="id" value={n.id} />
                  <button className="text-xs font-medium text-primary hover:underline">
                    Mark read
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Manage what you&apos;re notified about in{" "}
        <Link href="/settings/notifications" className={buttonClassName({ variant: "ghost", size: "sm", className: "h-auto p-0 text-primary underline" })}>
          notification settings
        </Link>
        .
      </p>
    </div>
  );
}
