import type { Metadata } from "next";
import { checkPermission } from "@/lib/context";
import { ModulePlaceholder } from "@/components/app/module-placeholder";
import { DeniedState } from "@/components/app/denied";

export const metadata: Metadata = { title: "Quotations" };

export default async function QuotationsPage() {
  const check = await checkPermission("quotations:view");
  if (!check.ok) return <DeniedState />;

  return (
    <ModulePlaceholder
      title="Quotations"
      description="Quotations initiated from deals and tracked via Dotnapps Invoice."
      phase={4}
      bullets={[
        "Create a quotation from a deal with customer and line items prefilled",
        "Show quotation number, amount, status, date and expiry inside CRM",
        "Acceptance can advance the linked deal stage",
        "Dotnapps Invoice stays the source of truth for amounts and taxes",
      ]}
    />
  );
}
