import type { Metadata } from "next";
import { checkPermission } from "@/lib/context";
import { ModulePlaceholder } from "@/components/app/module-placeholder";
import { DeniedState } from "@/components/app/denied";

export const metadata: Metadata = { title: "Invoices" };

export default async function InvoicesPage() {
  const check = await checkPermission("invoices:view");
  if (!check.ok) return <DeniedState />;

  return (
    <ModulePlaceholder
      title="Invoices"
      description="Read-only visibility into invoices from Dotnapps Invoice."
      phase={4}
      bullets={[
        "Invoice number, customer, amount, paid amount, balance, due date, status",
        "Navigate to the source invoice in Dotnapps Invoice",
        "No financial calculation logic is reimplemented in CRM",
        "Clear setup state shown when the integration is not configured",
      ]}
    />
  );
}
