import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Search,
  UserPlus,
  Contact,
  Building2,
  Handshake,
  KanbanSquare,
  CheckSquare,
  Activity,
  FileText,
  ReceiptText,
  CreditCard,
  BarChart3,
  Settings,
} from "lucide-react";

import type { Permission } from "./rbac";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  permission: Permission;
  /** Module lands in a later build phase; Foundation ships the shell only. */
  phase: 1 | 2 | 3 | 4 | 6;
};

export type NavGroup = {
  label: string | null;
  items: NavItem[];
};

export const NAV: NavGroup[] = [
  {
    label: null,
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "dashboard:view", phase: 1 },
      { label: "Search", href: "/search", icon: Search, permission: "dashboard:view", phase: 1 },
    ],
  },
  {
    label: "CRM",
    items: [
      { label: "Leads", href: "/leads", icon: UserPlus, permission: "leads:view", phase: 1 },
      { label: "Contacts", href: "/contacts", icon: Contact, permission: "contacts:view", phase: 1 },
      { label: "Companies", href: "/companies", icon: Building2, permission: "companies:view", phase: 1 },
    ],
  },
  {
    label: "Sales",
    items: [
      { label: "Deals", href: "/deals", icon: Handshake, permission: "deals:view", phase: 1 },
      { label: "Pipeline", href: "/pipeline", icon: KanbanSquare, permission: "deals:view", phase: 1 },
      { label: "Tasks", href: "/tasks", icon: CheckSquare, permission: "tasks:view", phase: 1 },
      { label: "Activities", href: "/activities", icon: Activity, permission: "activities:view", phase: 1 },
    ],
  },
  {
    label: "Revenue",
    items: [
      { label: "Quotations", href: "/quotations", icon: FileText, permission: "quotations:view", phase: 1 },
      { label: "Invoices", href: "/invoices", icon: ReceiptText, permission: "invoices:view", phase: 1 },
      { label: "Payments", href: "/payments", icon: CreditCard, permission: "payments:view", phase: 1 },
    ],
  },
  {
    label: "Insights",
    items: [
      { label: "Reports", href: "/reports", icon: BarChart3, permission: "reports:view", phase: 1 },
    ],
  },
  {
    label: null,
    items: [
      { label: "Settings", href: "/settings", icon: Settings, permission: "org:view", phase: 1 },
    ],
  },
];

/** Flat list of module pages that render the "planned" placeholder. */
export const PLACEHOLDER_MODULES = NAV.flatMap((g) => g.items).filter(
  (i) => i.phase > 1,
);
