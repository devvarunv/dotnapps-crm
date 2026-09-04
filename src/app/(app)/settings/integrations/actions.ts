"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { encryptSecret } from "@/lib/crypto";
import { fieldErrors, formValue, type ActionState } from "@/lib/form";
import { guard } from "@/lib/crm/guard";
import { getDecryptedConfig, testConnection } from "@/lib/integrations/invoice";

const PROVIDER = "DOTNAPPS_INVOICE" as const;

const schema = z.object({
  mode: z.enum(["LIVE", "MOCK"]),
  baseUrl: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.replace(/\/$/, "") : ""))
    .refine((v) => v === "" || /^https?:\/\/.+/.test(v), "Enter a valid http(s) URL"),
  apiKey: z.string().trim().optional(),
  webhookSecret: z.string().trim().optional(),
  advanceStageOnAccept: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
});

export async function saveInvoiceIntegrationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const g = await guard("integration:manage");
  if ("error" in g) return g.error;
  const { ctx } = g;

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;

  if (d.mode === "LIVE" && !d.baseUrl) {
    return { fieldErrors: { baseUrl: "Live mode needs the Dotnapps Invoice base URL." } };
  }

  const existing = await prisma.integration.findUnique({
    where: { orgId_provider: { orgId: ctx.org.id, provider: PROVIDER } },
  });

  const apiKeyCiphertext = d.apiKey
    ? encryptSecret(d.apiKey)
    : existing?.apiKeyCiphertext ?? null;

  let webhookSecretCiphertext = existing?.webhookSecretCiphertext ?? null;
  if (d.webhookSecret) webhookSecretCiphertext = encryptSecret(d.webhookSecret);
  if (!webhookSecretCiphertext) {
    webhookSecretCiphertext = encryptSecret(randomBytes(24).toString("hex"));
  }

  if (d.mode === "LIVE" && !apiKeyCiphertext) {
    return { fieldErrors: { apiKey: "Live mode needs an API key." } };
  }

  await prisma.integration.upsert({
    where: { orgId_provider: { orgId: ctx.org.id, provider: PROVIDER } },
    create: {
      orgId: ctx.org.id,
      provider: PROVIDER,
      mode: d.mode,
      baseUrl: d.baseUrl || null,
      apiKeyCiphertext,
      webhookSecretCiphertext,
      advanceStageOnAccept: d.advanceStageOnAccept,
      status: "CONNECTED",
    },
    update: {
      mode: d.mode,
      baseUrl: d.baseUrl || null,
      apiKeyCiphertext,
      webhookSecretCiphertext,
      advanceStageOnAccept: d.advanceStageOnAccept,
      status: "CONNECTED",
      lastError: null,
    },
  });

  // Verify immediately so the status reflects reality.
  const cfg = await getDecryptedConfig(ctx.org.id);
  if (cfg) {
    const result = await testConnection(cfg);
    await prisma.integration.update({
      where: { orgId_provider: { orgId: ctx.org.id, provider: PROVIDER } },
      data: {
        status: result.ok ? "CONNECTED" : "ERROR",
        lastCheckedAt: new Date(),
        lastError: result.ok ? null : result.detail,
      },
    });
  }

  await recordAudit({
    action: "integration.configure",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
    metadata: { provider: PROVIDER, mode: d.mode },
  });

  revalidatePath("/settings/integrations");
  return { ok: true, message: "Integration saved." };
}

export async function testInvoiceConnectionAction(): Promise<ActionState> {
  const g = await guard("integration:manage");
  if ("error" in g) return g.error;
  const { ctx } = g;

  const cfg = await getDecryptedConfig(ctx.org.id);
  if (!cfg) return { error: "Configure the integration first." };

  const result = await testConnection(cfg);
  await prisma.integration.update({
    where: { orgId_provider: { orgId: ctx.org.id, provider: PROVIDER } },
    data: {
      status: result.ok ? "CONNECTED" : "ERROR",
      lastCheckedAt: new Date(),
      lastError: result.ok ? null : result.detail,
    },
  });
  revalidatePath("/settings/integrations");
  return result.ok
    ? { ok: true, message: result.detail }
    : { error: result.detail };
}

export async function setInvoiceEnabledAction(formData: FormData): Promise<void> {
  const g = await guard("integration:manage");
  if ("error" in g) return;
  const { ctx } = g;

  const enable = String(formData.get("enable") ?? "") === "true";
  const row = await prisma.integration.findUnique({
    where: { orgId_provider: { orgId: ctx.org.id, provider: PROVIDER } },
  });
  if (!row) return;

  await prisma.integration.update({
    where: { orgId_provider: { orgId: ctx.org.id, provider: PROVIDER } },
    data: { status: enable ? "CONNECTED" : "DISABLED" },
  });
  await recordAudit({
    action: enable ? "integration.enable" : "integration.disable",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
  });
  revalidatePath("/settings/integrations");
}

export async function disconnectInvoiceAction(): Promise<void> {
  const g = await guard("integration:manage");
  if ("error" in g) return;
  const { ctx } = g;

  await prisma.integration.deleteMany({
    where: { orgId: ctx.org.id, provider: PROVIDER },
  });
  await recordAudit({
    action: "integration.disconnect",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
  });
  revalidatePath("/settings/integrations");
}

export async function regenerateWebhookSecretAction(): Promise<ActionState> {
  const g = await guard("integration:manage");
  if ("error" in g) return g.error;
  const { ctx } = g;

  const row = await prisma.integration.findUnique({
    where: { orgId_provider: { orgId: ctx.org.id, provider: PROVIDER } },
    select: { id: true },
  });
  if (!row) return { error: "Configure the integration first." };

  const secret = randomBytes(24).toString("hex");
  await prisma.integration.update({
    where: { orgId_provider: { orgId: ctx.org.id, provider: PROVIDER } },
    data: { webhookSecretCiphertext: encryptSecret(secret) },
  });
  await recordAudit({
    action: "integration.rotate_webhook_secret",
    orgId: ctx.org.id,
    actorId: ctx.user.id,
  });
  revalidatePath("/settings/integrations");
  return { ok: true, message: `New signing secret: ${secret}`, data: { secret } };
}
