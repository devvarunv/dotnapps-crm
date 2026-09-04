import type { Metadata } from "next";
import { checkPermission } from "@/lib/context";
import { ModulePlaceholder } from "@/components/app/module-placeholder";
import { DeniedState } from "@/components/app/denied";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const check = await checkPermission("reports:view");
  if (!check.ok) return <DeniedState />;

  return (
    <ModulePlaceholder
      title="Reports & Analytics"
      description="Pipeline, conversion and performance reporting."
      phase={6}
      bullets={[
        "Lead volume and conversion; lead source performance",
        "Pipeline value by stage; won vs lost; win rate; average deal size",
        "Sales cycle; expected vs actual close; salesperson performance",
        "Revenue by customer / source / product when Invoice integration is on",
      ]}
    />
  );
}
