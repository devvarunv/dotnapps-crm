import type { Metadata } from "next";
import { checkPermission } from "@/lib/context";
import { ModulePlaceholder } from "@/components/app/module-placeholder";
import { DeniedState } from "@/components/app/denied";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage() {
  const check = await checkPermission("tasks:view");
  if (!check.ok) return <DeniedState />;

  return (
    <ModulePlaceholder
      title="Tasks"
      description="Follow-ups and to-dos tied to any CRM record."
      phase={3}
      bullets={[
        "Relate a task to a Lead, Contact, Company or Deal",
        "Title, description, assignee, due date/time, priority, status",
        "My Tasks, Team Tasks and overdue views",
        "Completing a task records a timeline activity",
      ]}
    />
  );
}
