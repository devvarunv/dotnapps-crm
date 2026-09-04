"use server";

import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/context";
import { prisma } from "@/lib/db";

export async function markNotificationReadAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext();
  const id = String(formData.get("id") ?? "");
  await prisma.notification.updateMany({
    where: { id, userId: ctx.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const ctx = await requireOrgContext();
  await prisma.notification.updateMany({
    where: { userId: ctx.user.id, orgId: ctx.org.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}
