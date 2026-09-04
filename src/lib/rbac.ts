import { Role } from "@prisma/client";

/**
 * Permission catalogue.
 *
 * Phase 1 enforces the organization / members / settings / admin permissions.
 * The CRM-module permissions are declared now so navigation and future
 * phases can consume a single, stable vocabulary. Format: "<domain>:<action>".
 */
export const PERMISSIONS = [
  // Organization & settings
  "org:view",
  "org:manage", // rename org, manage pipeline/stage/status config, integrations
  "members:view",
  "members:invite",
  "members:manage", // change role, suspend, remove
  "settings:manage",
  "billing:manage",
  "audit:view",
  "export:data",
  "import:data",

  // CRM core (wired up in later phases)
  "dashboard:view",
  "leads:view",
  "leads:create",
  "leads:edit",
  "leads:delete",
  "leads:assign",
  "contacts:view",
  "contacts:create",
  "contacts:edit",
  "contacts:delete",
  "companies:view",
  "companies:create",
  "companies:edit",
  "companies:delete",
  "deals:view",
  "deals:create",
  "deals:edit",
  "deals:delete",
  "deals:assign",
  "tasks:view",
  "tasks:create",
  "tasks:edit",
  "activities:view",
  "activities:create",
  "reports:view",
  "quotations:view",
  "invoices:view",
  "payments:view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL: Permission[] = [...PERMISSIONS];

const MANAGER: Permission[] = [
  "org:view",
  "members:view",
  "members:invite",
  "audit:view",
  "export:data",
  "import:data",
  "dashboard:view",
  "leads:view",
  "leads:create",
  "leads:edit",
  "leads:assign",
  "contacts:view",
  "contacts:create",
  "contacts:edit",
  "companies:view",
  "companies:create",
  "companies:edit",
  "deals:view",
  "deals:create",
  "deals:edit",
  "deals:assign",
  "tasks:view",
  "tasks:create",
  "tasks:edit",
  "activities:view",
  "activities:create",
  "reports:view",
  "quotations:view",
  "invoices:view",
  "payments:view",
];

const SALES: Permission[] = [
  "org:view",
  "members:view",
  "dashboard:view",
  "leads:view",
  "leads:create",
  "leads:edit",
  "contacts:view",
  "contacts:create",
  "contacts:edit",
  "companies:view",
  "companies:create",
  "companies:edit",
  "deals:view",
  "deals:create",
  "deals:edit",
  "tasks:view",
  "tasks:create",
  "tasks:edit",
  "activities:view",
  "activities:create",
  "reports:view",
  "quotations:view",
  "invoices:view",
  "payments:view",
];

const VIEWER: Permission[] = [
  "org:view",
  "members:view",
  "dashboard:view",
  "leads:view",
  "contacts:view",
  "companies:view",
  "deals:view",
  "tasks:view",
  "activities:view",
  "reports:view",
  "quotations:view",
  "invoices:view",
  "payments:view",
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  // OWNER and ADMIN both have every permission. Ownership transfer and
  // organization deletion are OWNER-only checks handled explicitly where
  // they are implemented, not via this matrix.
  OWNER: ALL,
  ADMIN: ALL,
  MANAGER,
  SALES,
  VIEWER,
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function canAny(role: Role, permissions: Permission[]): boolean {
  return permissions.some((p) => can(role, p));
}

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MANAGER: "Manager",
  SALES: "Sales",
  VIEWER: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  OWNER: "Full control of the organization, including billing and deletion.",
  ADMIN: "Full control of CRM data, members, and settings.",
  MANAGER: "Team visibility, can invite members and manage most CRM data.",
  SALES: "Works assigned leads, contacts, companies, deals, tasks and activities.",
  VIEWER: "Read-only access to permitted areas.",
};

/** Roles that a given role is allowed to assign to others. */
export function assignableRoles(role: Role): Role[] {
  switch (role) {
    case "OWNER":
      return ["ADMIN", "MANAGER", "SALES", "VIEWER"];
    case "ADMIN":
      return ["MANAGER", "SALES", "VIEWER"];
    case "MANAGER":
      return ["SALES", "VIEWER"];
    default:
      return [];
  }
}

export class PermissionError extends Error {
  constructor(permission: Permission) {
    super(`Missing permission: ${permission}`);
    this.name = "PermissionError";
  }
}
