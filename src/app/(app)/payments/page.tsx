import type { Metadata } from "next";
import { checkPermission } from "@/lib/context";
import { ModulePlaceholder } from "@/components/app/module-placeholder";
import { DeniedState } from "@/components/app/denied";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage() {
  const check = await checkPermission("payments:view");
  if (!check.ok) return <DeniedState />;

  return (
    <ModulePlaceholder
      title="Payments"
      description="Payment events synchronized from Dotnapps Invoice."
      phase={4}
      bullets={[
        "Payment date, amount, method, transaction reference and linked invoice",
        "Events are synchronized and traceable, never faked",
        "Surface on the deal and customer timelines",
        "Webhook signatures verified before any event is stored",
      ]}
    />
  );
}
