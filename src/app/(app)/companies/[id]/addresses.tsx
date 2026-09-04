"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";

import { IDLE } from "@/lib/form";
import { ADDRESS_KIND_LABELS, ADDRESS_KINDS } from "@/lib/crm/labels";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { SubmitButton, FormError } from "@/components/form";
import { saveAddressAction, deleteAddressAction } from "../actions";

export type AddressItem = {
  id: string;
  kind: string;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
};

export function Addresses({
  companyId,
  addresses,
  canEdit,
}: {
  companyId: string;
  addresses: AddressItem[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<string | "new" | null>(null);

  return (
    <div className="space-y-3">
      {addresses.length === 0 && editing !== "new" && (
        <p className="text-sm text-muted-foreground">No addresses recorded.</p>
      )}

      <ul className="space-y-2">
        {addresses.map((a) =>
          editing === a.id ? (
            <li key={a.id}>
              <AddressForm
                companyId={companyId}
                address={a}
                onDone={() => setEditing(null)}
              />
            </li>
          ) : (
            <li
              key={a.id}
              className="flex items-start justify-between gap-3 rounded-md border border-border p-3 text-sm"
            >
              <div>
                <p className="font-medium">{ADDRESS_KIND_LABELS[a.kind as keyof typeof ADDRESS_KIND_LABELS]}</p>
                <p className="text-muted-foreground">
                  {[a.line1, a.line2, a.city, a.state, a.postalCode, a.country]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </p>
              </div>
              {canEdit && (
                <div className="flex gap-1">
                  <button
                    onClick={() => setEditing(a.id)}
                    className="rounded p-1 text-muted-foreground hover:bg-muted"
                    aria-label="Edit address"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <form action={deleteAddressAction}>
                    <input type="hidden" name="addressId" value={a.id} />
                    <button
                      className="rounded p-1 text-muted-foreground hover:bg-muted"
                      aria-label="Delete address"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </form>
                </div>
              )}
            </li>
          ),
        )}
      </ul>

      {canEdit &&
        (editing === "new" ? (
          <AddressForm companyId={companyId} onDone={() => setEditing(null)} />
        ) : (
          <Button variant="outline" size="sm" onClick={() => setEditing("new")}>
            <Plus className="size-4" /> Add address
          </Button>
        ))}
    </div>
  );
}

function AddressForm({
  companyId,
  address,
  onDone,
}: {
  companyId: string;
  address?: AddressItem;
  onDone: () => void;
}) {
  const [state, action] = useActionState(saveAddressAction, IDLE);
  useEffect(() => {
    if (state.ok) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  const err = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-3 rounded-md border border-border p-3">
      <input type="hidden" name="companyId" value={companyId} />
      {address && <input type="hidden" name="addressId" value={address.id} />}

      <Field label="Type" htmlFor="kind" error={err.kind}>
        <Select id="kind" name="kind" defaultValue={address?.kind ?? "BILLING"}>
          {ADDRESS_KINDS.map((k) => (
            <option key={k} value={k}>{ADDRESS_KIND_LABELS[k]}</option>
          ))}
        </Select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Address line 1" htmlFor="line1" error={err.line1}>
          <Input id="line1" name="line1" defaultValue={address?.line1 ?? ""} />
        </Field>
        <Field label="Address line 2" htmlFor="line2" error={err.line2}>
          <Input id="line2" name="line2" defaultValue={address?.line2 ?? ""} />
        </Field>
        <Field label="City" htmlFor="city" error={err.city}>
          <Input id="city" name="city" defaultValue={address?.city ?? ""} />
        </Field>
        <Field label="State / region" htmlFor="state" error={err.state}>
          <Input id="state" name="state" defaultValue={address?.state ?? ""} />
        </Field>
        <Field label="Postal code" htmlFor="postalCode" error={err.postalCode}>
          <Input id="postalCode" name="postalCode" defaultValue={address?.postalCode ?? ""} />
        </Field>
        <Field label="Country" htmlFor="country" error={err.country}>
          <Input id="country" name="country" defaultValue={address?.country ?? ""} />
        </Field>
      </div>
      <FormError message={state.error} />
      <div className="flex gap-2">
        <SubmitButton size="sm" pendingText="Saving…">Save address</SubmitButton>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
