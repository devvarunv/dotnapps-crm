import { requireOrgContext } from "@/lib/context";
import { prisma } from "@/lib/db";
import { Sidebar, type SidebarOrg } from "@/components/app/sidebar";
import { BillingBanner } from "@/components/app/billing-banner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireOrgContext();

  const orgs: SidebarOrg[] = ctx.memberships.map((m) => ({
    id: m.orgId,
    name: m.org.name,
    role: m.role,
  }));

  const unreadNotifications = await prisma.notification.count({
    where: { userId: ctx.user.id, orgId: ctx.org.id, readAt: null },
  });

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <Sidebar
        role={ctx.role}
        activeOrgId={ctx.org.id}
        orgs={orgs}
        user={{ name: ctx.user.name, email: ctx.user.email }}
        isSuperAdmin={ctx.user.isSuperAdmin}
        unreadNotifications={unreadNotifications}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <BillingBanner orgId={ctx.org.id} />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
