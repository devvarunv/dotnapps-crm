import { describe, it, expect } from "vitest";
import { can, canAny, assignableRoles, ROLE_PERMISSIONS } from "@/lib/rbac";

describe("rbac", () => {
  it("OWNER and ADMIN have every declared permission", () => {
    expect(ROLE_PERMISSIONS.OWNER.length).toBeGreaterThan(0);
    for (const perm of ROLE_PERMISSIONS.OWNER) {
      expect(can("ADMIN", perm)).toBe(true);
    }
  });

  it("VIEWER can only view, never create/edit/delete", () => {
    expect(can("VIEWER", "leads:view")).toBe(true);
    expect(can("VIEWER", "leads:create")).toBe(false);
    expect(can("VIEWER", "leads:edit")).toBe(false);
    expect(can("VIEWER", "deals:delete")).toBe(false);
  });

  it("SALES cannot manage members or the organization", () => {
    expect(can("SALES", "members:manage")).toBe(false);
    expect(can("SALES", "org:manage")).toBe(false);
    expect(can("SALES", "leads:create")).toBe(true);
  });

  it("MANAGER can invite but not manage members", () => {
    expect(can("MANAGER", "members:invite")).toBe(true);
    expect(can("MANAGER", "members:manage")).toBe(false);
  });

  it("canAny is true if at least one permission matches", () => {
    expect(canAny("VIEWER", ["leads:create", "leads:view"])).toBe(true);
    expect(canAny("VIEWER", ["leads:create", "leads:delete"])).toBe(false);
  });

  it("assignableRoles never includes OWNER and shrinks with seniority", () => {
    expect(assignableRoles("OWNER")).toContain("ADMIN");
    expect(assignableRoles("OWNER")).not.toContain("OWNER");
    expect(assignableRoles("ADMIN")).not.toContain("OWNER");
    expect(assignableRoles("ADMIN")).not.toContain("ADMIN");
    expect(assignableRoles("MANAGER")).toEqual(["SALES", "VIEWER"]);
    expect(assignableRoles("SALES")).toEqual([]);
    expect(assignableRoles("VIEWER")).toEqual([]);
  });

  it("integration:manage is restricted to OWNER/ADMIN", () => {
    expect(can("OWNER", "integration:manage")).toBe(true);
    expect(can("ADMIN", "integration:manage")).toBe(true);
    expect(can("MANAGER", "integration:manage")).toBe(false);
    expect(can("SALES", "integration:manage")).toBe(false);
  });
});
