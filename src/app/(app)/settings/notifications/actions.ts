"use server";

import { revalidatePath } from "next/cache";
import type { NotificationType } from "@prisma/client";

import { requireOrgContext } from "@/lib/context";
import { prisma } from "@/lib/db";
import { type ActionState } from "@/lib/form";

const ALL_TYPES: NotificationType[] = [
  "ASSIGNMENT",
  "MENTION",
  "TASK_OVERDUE",
  "STAGE_CHANGE",
  "CLOSE_APPROACHING",
  "AUTOMATION_FOLLOWUP",
];

export async function saveNotificationPrefsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireOrgContext();

  const emailEnabled = formData.get("emailEnabled") === "on";
  // A checked box means "notify me"; unchecked → muted.
  const muted = ALL_TYPES.filter((t) => formData.get(`type_${t}`) !== "on");

  await prisma.notificationPreference.upsert({
    where: { orgId_userId: { orgId: ctx.org.id, userId: ctx.user.id } },
    create: {
      orgId: ctx.org.id,
      userId: ctx.user.id,
      emailEnabled,
      mutedTypes: muted,
    },
    update: { emailEnabled, mutedTypes: muted },
  });

  revalidatePath("/settings/notifications");
  return { ok: true, message: "Preferences saved." };
}
