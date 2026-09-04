import type { Metadata } from "next";
import { checkPermission } from "@/lib/context";
import { ModulePlaceholder } from "@/components/app/module-placeholder";
import { DeniedState } from "@/components/app/denied";

export const metadata: Metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const check = await checkPermission("deals:view");
  if (!check.ok) return <DeniedState />;

  return (
    <ModulePlaceholder
      title="Pipeline"
      description="A Kanban board of deals by stage."
      phase={3}
      bullets={[
        "Columns per stage with drag-and-drop deal movement",
        "Every stage change writes an audit / activity event",
        "Cards show deal name, company, value, owner and expected close",
        "Filters for owner, source, date, value, tag and stage",
      ]}
    />
  );
}
