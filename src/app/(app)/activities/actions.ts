"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { fieldErrors, formValue, type ActionState } from "@/lib/form";
import { guard } from "@/lib/crm/guard";
import { activitySchema } from "@/lib/crm/validation";
import { logActivity } from "@/lib/crm/sales";
import { notifyMentions } from "@/lib/automation/notify";

/** Log a manual activity against a lead / contact / company / deal. */
export async function logActivityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("activities:create");
  if ("error" in g) return g.error;
  const { ctx } = g;

  const parsed = activitySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;

  // Exactly one parent, and it must belong to this org.
  const parents = [
    ["leadId", d.leadId, prisma.lead],
    ["contactId", d.contactId, prisma.contact],
    ["companyId", d.companyId, prisma.company],
    ["dealId", d.dealId, prisma.deal],
  ] as const;
  const picked = parents.filter(([, v]) => v);
  if (picked.length !== 1) return { error: "Attach the activity to one record." };

  const [field, id, model] = picked[0];
  if (!id) return { error: "Attach the activity to one record." };
  const exists = await (model as { findFirst: (a: unknown) => Promise<unknown> }).findFirst({
    where: { id, orgId: ctx.org.id },
    select: { id: true },
  });
  if (!exists) return { error: "That record no longer exists." };

  await prisma.$transaction((tx) =>
    logActivity(tx, {
      orgId: ctx.org.id,
      type: d.type as Prisma.ActivityCreateInput["type"],
      source: "MANUAL",
      subject: d.subject ?? null,
      body: d.body,
      createdById: ctx.user.id,
      occurredAt: d.occurredAt ? new Date(d.occurredAt) : new Date(),
      [field]: id,
    }),
  );

  const pathById: Record<string, string> = {
    leadId: `/leads/${id}`,
    contactId: `/contacts/${id}`,
    companyId: `/companies/${id}`,
    dealId: `/deals/${id}`,
  };

  await notifyMentions({
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    body: `${d.subject ?? ""} ${d.body}`,
    url: pathById[field],
    entityType: field.replace("Id", ""),
    entityId: id,
  });

  revalidatePath(pathById[field]);
  revalidatePath("/activities");
  return { ok: true, message: "Activity logged." };
}
