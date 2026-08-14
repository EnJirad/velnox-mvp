import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
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

/**
 * Self-serve "open your shop": promotes the signed-in user to seller.
 * (MVP — production would gate this behind approval.)
 */
export const becomeSeller = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user === null) throw new Error("Not authenticated");
    if (canSell(user.role)) return;
    await ctx.db.patch(user._id, { role: ROLES.SELLER });
  },
});

/** True while the company still has no owner (the first one claims it). */
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
 * Claim the velcenter as company owner. Only possible while no owner exists
 * yet — after that, access is granted exclusively by the owner.
 */
export const becomeOwner = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user === null) throw new Error("Not authenticated");
    if (canManageStaff(user.role)) return;
    const owners = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("role"), ROLES.OWNER))
      .take(1);
    if (owners.length > 0) throw new Error("เจ้าของบริษัทถูกตั้งไว้แล้ว");
    await ctx.db.patch(user._id, { role: ROLES.OWNER });
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
