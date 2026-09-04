"use client";

import { useActionState } from "react";
import { IDLE } from "@/lib/form";
import { Select } from "@/components/ui/input";
import { SubmitButton, FormError } from "@/components/form";
import { convertLeadAction } from "../actions";

export function ConvertPanel({
  leadId,
  leadName,
  companyName,
  companies,
}: {
  leadId: string;
  leadName: string;
  companyName: string | null;
  companies: { id: string; name: string }[];
}) {
  const [state, action] = useActionState(convertLeadAction, IDLE);

  return (
    <form action={action} className="space-y-3 text-sm">
      <input type="hidden" name="leadId" value={leadId} />

      <label className="flex items-start gap-2">
        <input type="checkbox" name="createContact" defaultChecked className="mt-0.5" />
        <span>
          Create a contact for <strong>{leadName}</strong>
        </span>
      </label>

      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          name="createCompany"
          defaultChecked={!!companyName}
          disabled={!companyName}
          className="mt-0.5"
        />
        <span>
          Create a company{" "}
          {companyName ? (
            <>
              from <strong>{companyName}</strong>
            </>
          ) : (
            <span className="text-muted-foreground">(no company name on this lead)</span>
          )}
        </span>
      </label>

      {companies.length > 0 && (
        <div>
          <p className="mb-1 text-muted-foreground">…or link to an existing company</p>
          <Select name="companyId" defaultValue="">
            <option value="">None</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>
      )}

      <FormError message={state.error} />
      <SubmitButton size="sm" pendingText="Converting…">
        Convert lead
      </SubmitButton>
    </form>
  );
}
