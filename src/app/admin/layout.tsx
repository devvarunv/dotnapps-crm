import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { requireSuperAdmin } from "@/lib/context";
import { signOutAction } from "@/app/(app)/actions";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireSuperAdmin();

  return (
    <div className="min-h-dvh bg-muted/20">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="size-5 text-primary" />
            Dotnapps CRM · Super Admin
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
              Exit to app
            </Link>
            <span className="text-muted-foreground">{user.email}</span>
            <form action={signOutAction}>
              <button className="text-muted-foreground hover:text-foreground">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <nav className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl gap-1 px-4 text-sm">
          {[
            { href: "/admin", label: "Overview" },
            { href: "/admin/plans", label: "Plans" },
            { href: "/admin/subscriptions", label: "Subscriptions" },
          ].map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="border-b-2 border-transparent px-3 py-2.5 text-muted-foreground hover:text-foreground"
            >
              {t.label}
            </Link>
          ))}
        </div>
      </nav>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
