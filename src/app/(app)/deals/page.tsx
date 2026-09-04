import type { Metadata } from "next";
import { checkPermission } from "@/lib/context";
import { ModulePlaceholder } from "@/components/app/module-placeholder";
import { DeniedState } from "@/components/app/denied";

export const metadata: Metadata = { title: "Deals" };

export default async function DealsPage() {
  const check = await checkPermission("deals:view");
  if (!check.ok) return <DeniedState />;

  return (
    <ModulePlaceholder
      title="Deals"
      description="Opportunities moving through your sales pipeline."
      phase={3}
      bullets={[
        "Value, currency, stage, probability, expected close, owner, source",
        "Win / loss reason and full audit history",
        "Related activities, tasks, notes, quotations, invoices and payments",
        "Architecture supports multiple pipelines",
      ]}
    />
  );
}
