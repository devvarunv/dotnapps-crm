"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronsUpDown, LogOut, Shield, Check } from "lucide-react";
import type { Role } from "@prisma/client";

import { cn, initials } from "@/lib/utils";
import { NAV } from "@/lib/nav";
import { can } from "@/lib/rbac";
import { ROLE_LABELS } from "@/lib/rbac";
import { Logo } from "@/components/brand";
import { switchOrgAction, signOutAction } from "@/app/(app)/actions";

export type SidebarOrg = { id: string; name: string; role: Role };
export type SidebarUser = { name: string; email: string };

export function Sidebar({
  role,
  activeOrgId,
  orgs,
  user,
  isSuperAdmin,
}: {
  role: Role;
  activeOrgId: string;
  orgs: SidebarOrg[];
  user: SidebarUser;
  isSuperAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const activeOrg = orgs.find((o) => o.id === activeOrgId);

  const nav = (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4 dnc-scroll">
      {NAV.map((group, gi) => {
        const items = group.items.filter((i) => can(role, i.permission));
        if (items.length === 0) return null;
        return (
          <div key={gi} className="space-y-1">
            {group.label && (
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
            )}
            {items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <item.icon className="size-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.phase > 1 && (
                    <span className="rounded bg-muted px-1 text-[10px] font-medium text-muted-foreground">
                      Soon
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        );
      })}

      {isSuperAdmin && (
        <div className="space-y-1">
          <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Platform
          </p>
          <Link
            href="/admin"
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
              pathname.startsWith("/admin")
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Shield className="size-4 shrink-0" />
            Super Admin
          </Link>
        </div>
      )}
    </nav>
  );

  const orgSwitcher = (
    <div className="border-b border-border p-3">
      <details className="group relative">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md border border-border bg-background px-2.5 py-2 text-sm hover:bg-muted">
          <span className="grid size-6 shrink-0 place-items-center rounded bg-primary text-[11px] font-bold text-primary-foreground">
            {initials(activeOrg?.name ?? "?")}
          </span>
          <span className="flex-1 truncate text-left font-medium">
            {activeOrg?.name ?? "Select workspace"}
          </span>
          <ChevronsUpDown className="size-4 text-muted-foreground" />
        </summary>
        <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-md border border-border bg-popover shadow-lg">
          {orgs.map((o) => (
            <form key={o.id} action={switchOrgAction}>
              <input type="hidden" name="orgId" value={o.id} />
              <button
                type="submit"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <span className="flex-1 truncate">{o.name}</span>
                <span className="text-xs text-muted-foreground">
                  {ROLE_LABELS[o.role]}
                </span>
                {o.id === activeOrgId && <Check className="size-4 text-primary" />}
              </button>
            </form>
          ))}
          <Link
            href="/onboarding"
            className="block border-t border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            + Create workspace
          </Link>
        </div>
      </details>
    </div>
  );

  const userBox = (
    <div className="border-t border-border p-3">
      <div className="flex items-center gap-2 px-1 py-1">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">
          {initials(user.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
      </div>
      <form action={signOutAction} className="mt-1">
        <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
          <LogOut className="size-4" />
          Sign out
        </button>
      </form>
    </div>
  );

  const panel = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center px-4">
        <Logo href="/dashboard" className="text-sm" />
      </div>
      {orgSwitcher}
      {nav}
      {userBox}
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex h-14 items-center gap-3 border-b border-border bg-background px-4 lg:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="rounded-md p-1.5 hover:bg-muted"
        >
          <Menu className="size-5" />
        </button>
        <Logo href="/dashboard" className="text-sm" />
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-72 border-r border-border bg-card">
            <button
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
              className="absolute right-3 top-4 rounded-md p-1 hover:bg-muted"
            >
              <X className="size-5" />
            </button>
            {panel}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-card lg:block">
        <div className="sticky top-0 h-dvh">{panel}</div>
      </aside>
    </>
  );
}
