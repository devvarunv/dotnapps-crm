import { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { getWebhookSecret } from "@/lib/integrations/invoice";
import { verifyWebhookSignature } from "@/lib/integrations/webhook";
import { processInvoiceEvent } from "@/lib/integrations/invoice-sync";
import type { WebhookEvent } from "@/lib/integrations/invoice-types";

const eventSchema = z.object({
  type: z.enum([
    "quotation.updated",
    "quotation.accepted",
    "quotation.declined",
    "invoice.created",
    "invoice.updated",
    "invoice.paid",
    "payment.recorded",
  ]),
  data: z.object({ externalId: z.string().min(1) }).passthrough(),
});

export async function POST(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("org");
  if (!orgId) return json({ error: "Missing org" }, 400);

  const integration = await prisma.integration.findUnique({
    where: { orgId_provider: { orgId, provider: "DOTNAPPS_INVOICE" } },
    select: { status: true },
  });
  if (!integration) return json({ error: "Integration not configured" }, 404);
  if (integration.status === "DISABLED") return json({ error: "Integration disabled" }, 409);

  const secret = await getWebhookSecret(orgId);
  if (!secret) return json({ error: "No signing secret" }, 500);

  const raw = await req.text();
  const signature =
    req.headers.get("x-dotnapps-signature") ?? req.headers.get("x-signature");

  if (!verifyWebhookSignature(raw, signature, secret)) {
    return json({ error: "Invalid signature" }, 401);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const parsed = eventSchema.safeParse(parsedJson);
  if (!parsed.success) return json({ error: "Unrecognised event shape" }, 422);

  const result = await processInvoiceEvent(orgId, parsed.data as WebhookEvent);
  return json({ status: result.status, detail: result.detail }, result.status === "FAILED" ? 500 : 200);
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
