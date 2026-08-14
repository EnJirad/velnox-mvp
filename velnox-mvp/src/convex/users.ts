import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import { ROLES, roleValidator } from "./schema";

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

/** Whether a user can use the seller tools (seller or admin). */
export const canSell = (role: string | undefined) =>
  role === ROLES.SELLER || role === ROLES.ADMIN;

/** Whether a user can access the velcenter (admin only). */
export const canAdmin = (role: string | undefined) => role === ROLES.ADMIN;

/**
 * Self-serve "open your shop": promotes the signed-in user to seller.
 * (MVP demo — production would gate this behind approval.)
 */
export const becomeSeller = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user === null) throw new Error("Not authenticated");
    if (user.role === ROLES.ADMIN) return;
    await ctx.db.patch(user._id, { role: ROLES.SELLER });
  },
});

/**
 * Self-serve "become admin": promotes the signed-in user to admin.
 * (MVP demo — production would gate this behind ownership/approval.)
 */
export const becomeAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user === null) throw new Error("Not authenticated");
    await ctx.db.patch(user._id, { role: ROLES.ADMIN });
  },
});

/** List all users (velcenter user management, admin only). */
export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user === null || !canAdmin(user.role)) throw new Error("Admin only");
    return await ctx.db.query("users").order("desc").collect();
  },
});

/** Change another user's role (velcenter, admin only). */
export const setRole = mutation({
  args: {
    userId: v.id("users"),
    role: roleValidator,
  },
  handler: async (ctx, { userId, role }) => {
    const user = await getCurrentUser(ctx);
    if (user === null || !canAdmin(user.role)) throw new Error("Admin only");
    await ctx.db.patch(userId, { role });
  },
});
