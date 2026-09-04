"use client";

import { useActionState, useState, useTransition } from "react";
import { Copy, Check } from "lucide-react";

import { IDLE } from "@/lib/form";
import { Input, Select } from "@/components/ui/input";
import { Field, Alert } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { SubmitButton, FormError, FormSuccess } from "@/components/form";
import type { IntegrationSummary } from "@/lib/integrations/invoice";
import {
  saveInvoiceIntegrationAction,
  testInvoiceConnectionAction,
  regenerateWebhookSecretAction,
} from "./actions";

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded border border-border bg-background px-2 py-1 text-xs">
        {value}
      </code>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard unavailable */
          }
        }}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </Button>
    </div>
  );
}

export function IntegrationForm({
  summary,
  webhookUrl,
}: {
  summary: IntegrationSummary;
  webhookUrl: string;
}) {
  const [state, action] = useActionState(saveInvoiceIntegrationAction, IDLE);
  const [testState, setTestState] = useState<{ ok?: boolean; msg?: string }>({});
  const [rotated, setRotated] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const err = state.fieldErrors ?? {};

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-4">
        <Field label="Mode" htmlFor="mode" error={err.mode}
          hint="Mock mode uses a built-in sandbox — no real Dotnapps Invoice account, no real money.">
          <Select id="mode" name="mode" defaultValue={summary.mode}>
            <option value="MOCK">Mock (sandbox / development)</option>
            <option value="LIVE">Live (connect a real Dotnapps Invoice account)</option>
          </Select>
        </Field>

        <Field label="Dotnapps Invoice base URL" htmlFor="baseUrl" error={err.baseUrl}
          hint="Required for live mode, e.g. https://invoice.dotnapps.com/api">
          <Input id="baseUrl" name="baseUrl" defaultValue={summary.baseUrl ?? ""} placeholder="https://…" />
        </Field>

        <Field label="API key" htmlFor="apiKey" error={err.apiKey}
          hint={summary.hasApiKey ? "A key is stored. Leave blank to keep it." : "Required for live mode."}>
          <Input id="apiKey" name="apiKey" type="password" autoComplete="off"
            placeholder={summary.hasApiKey ? "•••••••• (stored)" : ""} />
        </Field>

        <Field label="Webhook signing secret" htmlFor="webhookSecret" error={err.webhookSecret}
          hint={summary.hasWebhookSecret ? "A secret is stored. Leave blank to keep it." : "Auto-generated if left blank."}>
          <Input id="webhookSecret" name="webhookSecret" type="password" autoComplete="off"
            placeholder={summary.hasWebhookSecret ? "•••••••• (stored)" : ""} />
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="advanceStageOnAccept" defaultChecked={summary.advanceStageOnAccept} />
          Advance the deal to the next stage when a quotation is accepted
        </label>

        <FormError message={state.error} />
        <FormSuccess message={state.ok ? state.message : undefined} />

        <div className="flex gap-2">
          <SubmitButton pendingText="Saving…">Save integration</SubmitButton>
          {summary.configured && (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await testInvoiceConnectionAction();
                  setTestState({ ok: r.ok, msg: r.ok ? r.message : r.error });
                })
              }
            >
              Test connection
            </Button>
          )}
        </div>
        {testState.msg && (
          <Alert tone={testState.ok ? "success" : "error"}>{testState.msg}</Alert>
        )}
      </form>

      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <h3 className="text-sm font-semibold">Webhook endpoint</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Point Dotnapps Invoice webhooks here. Requests are rejected unless the
          <code className="mx-1">X-Dotnapps-Signature</code> HMAC matches your
          signing secret.
        </p>
        <div className="mt-2">
          <CopyField value={webhookUrl} />
        </div>
        {summary.configured && (
          <div className="mt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await regenerateWebhookSecretAction();
                  setRotated(r.ok ? ((r.data?.secret as string) ?? null) : null);
                })
              }
            >
              Regenerate signing secret
            </Button>
            {rotated && (
              <Alert tone="success" className="mt-2">
                New signing secret (copy it now — it isn&apos;t shown again):
                <div className="mt-1"><CopyField value={rotated} /></div>
              </Alert>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
