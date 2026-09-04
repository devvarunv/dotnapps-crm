import type { Metadata } from "next";
import { checkPermission } from "@/lib/context";
import { ModulePlaceholder } from "@/components/app/module-placeholder";
import { DeniedState } from "@/components/app/denied";

export const metadata: Metadata = { title: "Activities" };

export default async function ActivitiesPage() {
  const check = await checkPermission("activities:view");
  if (!check.ok) return <DeniedState />;

  return (
    <ModulePlaceholder
      title="Activities & Timeline"
      description="A chronological record of every interaction."
      phase={3}
      bullets={[
        "Call, Meeting, Email, WhatsApp, Follow-up, Demo, Note, Task",
        "Creator, timestamp and related entity on every entry",
        "Manual notes visually distinct from provider-confirmed messages",
        "Timeline available on Lead, Contact, Company and Deal pages",
      ]}
    />
  );
}
