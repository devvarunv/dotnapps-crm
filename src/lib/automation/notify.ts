import type { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type NotifyInput = {
  orgId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  entityType?: string;
  entityId?: string;
  url?: string;
  /** Skip if the same (userId,type,entityId) notification exists unread. */
  dedupe?: boolean;
};

/** Create one in-app notification, honouring the user's muted types. */
export async function notify(input: NotifyInput): Promise<void> {
  const pref = await prisma.notificationPreference.findUnique({
    where: { orgId_userId: { orgId: input.orgId, userId: input.userId } },
    select: { mutedTypes: true },
  });
  if (pref?.mutedTypes.includes(input.type)) return;

  if (input.dedupe && input.entityId) {
    const existing = await prisma.notification.findFirst({
      where: {
        userId: input.userId,
        type: input.type,
        entityId: input.entityId,
        readAt: null,
      },
      select: { id: true },
    });
    if (existing) return;
  }

  await prisma.notification.create({
    data: {
      orgId: input.orgId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      url: input.url,
    },
  });
}

export async function notifyMany(
  userIds: string[],
  input: Omit<NotifyInput, "userId">,
): Promise<void> {
  await Promise.all(
    [...new Set(userIds)].map((userId) => notify({ ...input, userId })),
  );
}

/** Notify a user that something was assigned to them (never self). */
export async function notifyAssignment(opts: {
  orgId: string;
  assigneeId: string | null | undefined;
  actorId: string | null | undefined;
  title: string;
  url: string;
  entityType: string;
  entityId: string;
}): Promise<void> {
  if (!opts.assigneeId || opts.assigneeId === opts.actorId) return;
  await notify({
    orgId: opts.orgId,
    userId: opts.assigneeId,
    type: "ASSIGNMENT",
    title: opts.title,
    url: opts.url,
    entityType: opts.entityType,
    entityId: opts.entityId,
    dedupe: true,
  });
}

/** @mentions inside an activity / note body. Matches member first or full name. */
export async function notifyMentions(opts: {
  orgId: string;
  actorId: string;
  body: string;
  url: string;
  entityType: string;
  entityId: string;
}): Promise<void> {
  const handles = [...opts.body.matchAll(/@([\w][\w.'-]{1,40})/g)].map((m) =>
    m[1].toLowerCase(),
  );
  if (handles.length === 0) return;

  const members = await prisma.membership.findMany({
    where: { orgId: opts.orgId, status: "ACTIVE" },
    select: { userId: true, user: { select: { name: true, email: true } } },
  });

  const hits = members.filter((m) => {
    const first = m.user.name.split(/\s+/)[0]?.toLowerCase() ?? "";
    const full = m.user.name.toLowerCase().replace(/\s+/g, "");
    const emailLocal = m.user.email.split("@")[0]?.toLowerCase() ?? "";
    return handles.some((h) => h === first || h === full || h === emailLocal);
  });

  await notifyMany(
    hits.map((h) => h.userId).filter((id) => id !== opts.actorId),
    {
      orgId: opts.orgId,
      type: "MENTION",
      title: "You were mentioned",
      body: opts.body.slice(0, 140),
      url: opts.url,
      entityType: opts.entityType,
      entityId: opts.entityId,
    },
  );
}

export function unreadCountWhere(userId: string): Prisma.NotificationWhereInput {
  return { userId, readAt: null };
}
