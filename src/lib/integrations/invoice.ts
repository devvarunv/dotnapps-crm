import type { Integration } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { mockCreateQuotation } from "./invoice-mock";
import type {
  ConnectionResult,
  CreateQuotationInput,
  ProviderQuotation,
} from "./invoice-types";

const PROVIDER = "DOTNAPPS_INVOICE" as const;
const TIMEOUT_MS = 8000;

export type IntegrationSummary = {
  configured: boolean;
  enabled: boolean;
  status: Integration["status"];
  mode: Integration["mode"];
  baseUrl: string | null;
  hasApiKey: boolean;
  hasWebhookSecret: boolean;
  advanceStageOnAccept: boolean;
  lastCheckedAt: Date | null;
  lastError: string | null;
};

const NOT_CONFIGURED: IntegrationSummary = {
  configured: false,
  enabled: false,
  status: "NOT_CONFIGURED",
  mode: "MOCK",
  baseUrl: null,
  hasApiKey: false,
  hasWebhookSecret: false,
  advanceStageOnAccept: true,
  lastCheckedAt: null,
  lastError: null,
};

export async function getInvoiceIntegration(orgId: string): Promise<IntegrationSummary> {
  const row = await prisma.integration.findUnique({
    where: { orgId_provider: { orgId, provider: PROVIDER } },
  });
  if (!row) return NOT_CONFIGURED;
  return {
    configured: row.status !== "NOT_CONFIGURED",
    enabled: row.status === "CONNECTED",
    status: row.status,
    mode: row.mode,
    baseUrl: row.baseUrl,
    hasApiKey: !!row.apiKeyCiphertext,
    hasWebhookSecret: !!row.webhookSecretCiphertext,
    advanceStageOnAccept: row.advanceStageOnAccept,
    lastCheckedAt: row.lastCheckedAt,
    lastError: row.lastError,
  };
}

type DecryptedConfig = {
  mode: Integration["mode"];
  baseUrl: string | null;
  apiKey: string | null;
  webhookSecret: string | null;
};

export async function getDecryptedConfig(orgId: string): Promise<DecryptedConfig | null> {
  const row = await prisma.integration.findUnique({
    where: { orgId_provider: { orgId, provider: PROVIDER } },
  });
  if (!row) return null;
  return {
    mode: row.mode,
    baseUrl: row.baseUrl,
    apiKey: row.apiKeyCiphertext ? decryptSecret(row.apiKeyCiphertext) : null,
    webhookSecret: row.webhookSecretCiphertext ? decryptSecret(row.webhookSecretCiphertext) : null,
  };
}

export async function getWebhookSecret(orgId: string): Promise<string | null> {
  const row = await prisma.integration.findUnique({
    where: { orgId_provider: { orgId, provider: PROVIDER } },
    select: { webhookSecretCiphertext: true },
  });
  return row?.webhookSecretCiphertext ? decryptSecret(row.webhookSecretCiphertext) : null;
}

async function providerFetch(
  cfg: DecryptedConfig,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  if (!cfg.baseUrl) throw new Error("No provider base URL configured.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${cfg.baseUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: cfg.apiKey ? `Bearer ${cfg.apiKey}` : "",
        ...(init?.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function testConnection(cfg: DecryptedConfig): Promise<ConnectionResult> {
  if (cfg.mode === "MOCK") {
    return { ok: true, detail: "Mock provider is always reachable (sandbox mode)." };
  }
  if (!cfg.baseUrl || !cfg.apiKey) {
    return { ok: false, detail: "Base URL and API key are required for live mode." };
  }
  try {
    const res = await providerFetch(cfg, "/v1/ping");
    if (res.ok) return { ok: true, detail: `Provider responded ${res.status}.` };
    return { ok: false, detail: `Provider responded ${res.status} ${res.statusText}.` };
  } catch (err) {
    return { ok: false, detail: `Could not reach provider: ${(err as Error).message}` };
  }
}

export async function providerCreateQuotation(
  cfg: DecryptedConfig,
  input: CreateQuotationInput,
): Promise<ProviderQuotation> {
  if (cfg.mode === "MOCK") return mockCreateQuotation(input);

  const res = await providerFetch(cfg, "/v1/quotations", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Provider rejected quotation (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as ProviderQuotation;
}
