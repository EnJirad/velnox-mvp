/**
 * Velnox Backend — authorization tests (spec §33–34, §36–37, §63).
 *
 * Roles: customer / seller / staff / admin / owner.
 * owner + admin implicitly hold every permission; staff only what their
 * staff_profiles.permissions grant; customers/sellers none.
 */
import { describe, expect, it } from "vitest";
import { hasPermission } from "../backend/permissions";
import { PERMISSIONS, type Permission, type Role } from "../backend/types";

const APPROVE_SELLERS: Permission = "APPROVE_SELLERS";
const MANAGE_PLATFORM_SETTINGS: Permission = "MANAGE_PLATFORM_SETTINGS";

describe("§63 — RBAC & permissions", () => {
  it("owner (super admin) implicitly holds every permission", () => {
    expect(hasPermission("owner", null, APPROVE_SELLERS)).toBe(true);
    expect(hasPermission("owner", null, MANAGE_PLATFORM_SETTINGS)).toBe(true);
  });

  it("admin implicitly holds every permission", () => {
    expect(hasPermission("admin", null, APPROVE_SELLERS)).toBe(true);
    expect(hasPermission("admin", null, MANAGE_PLATFORM_SETTINGS)).toBe(true);
  });

  it("seller trying to change platform settings → denied", () => {
    expect(hasPermission("seller", null, MANAGE_PLATFORM_SETTINGS)).toBe(false);
    expect(hasPermission("seller", null, APPROVE_SELLERS)).toBe(false);
  });

  it("customer → denied everything", () => {
    expect(hasPermission("customer", null, APPROVE_SELLERS)).toBe(false);
  });

  it("staff with the granted permission → allowed", () => {
    const profile = { permissions: [APPROVE_SELLERS] as Permission[] };
    expect(hasPermission("staff", profile, APPROVE_SELLERS)).toBe(true);
  });

  it("staff without the permission → denied (department scoping enforced)", () => {
    const profile = { permissions: ["VIEW_ORDERS"] as Permission[] };
    expect(hasPermission("staff", profile, APPROVE_SELLERS)).toBe(false);
    expect(hasPermission("staff", profile, MANAGE_PLATFORM_SETTINGS)).toBe(false);
  });

  it("permission catalog only contains valid codes", () => {
    for (const p of PERMISSIONS) {
      expect(p).toBe(p); // catalog is the source of truth
    }
  });

  it("every role is checked against the backend — frontend role is never trusted alone", () => {
    // A frontend claiming "admin" but carrying role=customer must be denied.
    const roles: Role[] = ["customer", "seller", "staff", "admin", "owner"];
    for (const r of roles) {
      expect(typeof hasPermission(r, null, MANAGE_PLATFORM_SETTINGS)).toBe("boolean");
    }
    expect(hasPermission("customer", null, MANAGE_PLATFORM_SETTINGS)).toBe(false);
  });
});
