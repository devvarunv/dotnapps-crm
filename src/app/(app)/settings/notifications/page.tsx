import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { requireOrgContext } from "@/lib/context";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { PrefsForm } from "./prefs-form";

export const metadata: Metadata = { title: "Notification settings" };

export default async function NotificationSettingsPage() {
  const ctx = await requireOrgContext();

  const pref = await prisma.notificationPreference.findUnique({
    where: { orgId_userId: { orgId: ctx.org.id, userId: ctx.user.id } },
  });

  return (
    <div>
      <Link href="/settings" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Settings
      </Link>
      <PageHeader
        title="Notifications"
        description="Choose what shows up in your notification list."
      />
      <Card>
        <CardHeader><CardTitle>Your preferences</CardTitle></CardHeader>
        <CardContent>
          <PrefsForm
            emailEnabled={pref?.emailEnabled ?? false}
            muted={(pref?.mutedTypes ?? []) as string[]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
