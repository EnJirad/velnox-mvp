import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { mutation, query, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  BOOTSTRAP_ENV_VAR,
  bootstrapConfigured,
  bootstrapSecretMatches,
} from "../backend/bootstrap";
import { ROLES, departmentValidator, roleValidator } from "./schema";

/**
 * Get the current signed in user. Returns null if the user is not signed in.
 * Usage: const signedInUser = await ctx.runQuery(api.authHelpers.currentUser);
 * THIS FUNCTION IS READ-ONLY. DO NOT MODIFY.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);

    if (user === null) {
      return null;
    }

    return user;
  },
});

/**
 * Use this function internally to get the current user data. Remember to handle the null user case.
 * @param ctx
 * @returns
 */
export const getCurrentUser = async (ctx: QueryCtx) => {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    return null;
  }
  return await ctx.db.get(userId);
};

/** Whether a user can use the velseller merchant tools (seller, admin or owner). */
export const canSell = (role: string | undefined) =>
  role === ROLES.SELLER || role === ROLES.ADMIN || role === ROLES.OWNER;

/** Whether a user can manage the whole storefront / company data (admin or owner). */
export const canAdmin = (role: string | undefined) =>
  role === ROLES.ADMIN || role === ROLES.OWNER;

/** Whether a user can enter velcenter at all (owner, admin or staff). */
export const canAccessCenter = (role: string | undefined) =>
  role === ROLES.OWNER || role === ROLES.ADMIN || role === ROLES.STAFF;

/** Only the company owner can manage employees / roles. */
export const canManageStaff = (role: string | undefined) => role === ROLES.OWNER;

/** True while the company still has no owner (only the bootstrap secret can create one). */
export const ownerExists = query({
  args: {},
  handler: async (ctx) => {
    const owners = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), ROLES.OWNER))
      .take(1);
    return owners.length > 0;
  },
});

/**
 * Whether the one-time owner bootstrap is available (no owner yet AND the
 * operator configured BOOTSTRAP_OWNER_SECRET). The frontend uses this to
 * decide between the bootstrap-code form and the locked gate.
 */
export const ownerBootstrapStatus = query({
  args: {},
  handler: async (ctx) => {
    const owners = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), ROLES.OWNER))
      .take(1);
    return {
      ownerExists: owners.length > 0,
      configured: bootstrapConfigured(),
    };
  },
});

/**
 * Claim the velcenter as company owner with the one-time bootstrap code
 * (spec §31). Requirements, all enforced server-side:
 *   - signed in
 *   - no owner exists yet (after first use the mechanism is permanently
 *     invalidated — an owner can only be created by this path once)
 *   - the presented code matches BOOTSTRAP_OWNER_SECRET (constant-time
 *     compare; the secret itself is never logged or returned)
 * The claim is recorded as a business event for the audit trail.
 */
export const claimOwner = mutation({
  args: { bootstrapCode: v.string() },
  handler: async (ctx, { bootstrapCode }) => {
    const user = await getCurrentUser(ctx);
    if (user === null) throw new Error("Not authenticated");
    if (canManageStaff(user.role)) return;
    if (!bootstrapConfigured()) {
      throw new Error(
        `ยังไม่พร้อมใช้งาน — ผู้ดูแลระบบต้องตั้งค่า ${BOOTSTRAP_ENV_VAR} (รหัสเปิดใช้งานครั้งเดียว) ใน Keys/API keys ก่อน`,
      );
    }
    const owners = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), ROLES.OWNER))
      .take(1);
    if (owners.length > 0) {
      throw new Error("เจ้าของบริษัทถูกตั้งไว้แล้ว — กลไกเปิดใช้งานถูกปิดถาวร");
    }
    const valid = await bootstrapSecretMatches(bootstrapCode);
    if (!valid) throw new Error("รหัสเปิดใช้งานไม่ถูกต้อง");

    await ctx.db.patch(user._id, { role: ROLES.OWNER });
    // Audit trail (never logs the code — only that a claim happened).
    try {
      await ctx.runMutation(api.intelligence.recordBusinessEvent, {
        type: "OwnerBootstrapped",
        entityId: user._id,
        payload: { at: Date.now() },
      });
    } catch (err) {
      console.error("[users] OwnerBootstrapped event failed:", err);
    }
  },
});

/**
 * Sync the Convex role for a seller's auth account (owner/admin only — the
 * mutation checks the ACTOR's Convex role server-side, so a customer can
 * never promote themselves). Called by the center seller-review action after
 * an approval/suspension; Neon sellers.status stays the source of truth.
 */
export const setSellerRoleInternal = mutation({
  args: { convexUserId: v.string(), activated: v.boolean() },
  handler: async (ctx, { convexUserId, activated }) => {
    const actor = await getCurrentUser(ctx);
    if (actor === null || !canAdmin(actor.role)) {
      throw new Error("Owner/Admin only");
    }
    const target = await ctx.db.get(convexUserId as Id<"users">);
    if (!target) return;
    const desired = activated ? ROLES.SELLER : ROLES.CUSTOMER;
    if (target.role !== desired) {
      await ctx.db.patch(target._id, { role: desired });
    }
  },
});

/** List all users for employee management (company owner only). */
export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    // No data is returned unless the caller is the owner — safe for non-owners.
    if (user === null || !canManageStaff(user.role)) return [];
    return await ctx.db.query("users").order("desc").collect();
  },
});

/**
 * Set another user's role + department (velcenter employee management,
 * company owner only). Admins/staff can view data but cannot touch access.
 */
export const setUserAccess = mutation({
  args: {
    userId: v.id("users"),
    role: roleValidator,
    department: v.optional(departmentValidator),
  },
  handler: async (ctx, { userId, role, department }) => {
    const user = await getCurrentUser(ctx);
    if (user === null || !canManageStaff(user.role)) throw new Error("Owner only");
    if (userId === user._id) throw new Error("ไม่สามารถเปลี่ยนสิทธิ์ของตัวเองได้");
    await ctx.db.patch(userId, {
      role,
      department: department ?? undefined,
    });
  },
});
