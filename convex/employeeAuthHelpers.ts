/**
 * Velnox — internal Convex helpers for employee password auth.
 *
 * Queries/mutations cannot live in a `"use node"` file (only actions can), so
 * the Convex-table access for employee auth lives here and is called from the
 * node actions in employeeAuth.ts via ctx.runQuery / ctx.runMutation.
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Department, Role } from "../backend/types";

export const PASSWORD_PROVIDER = "password";

/** Find the Convex auth user by exact email, if any. */
export const _getUserByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();
  },
});

export const _getUserById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => ctx.db.get(userId),
});

/** Does a password account already exist for this email? */
export const _passwordAccountExists = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", PASSWORD_PROVIDER).eq("providerAccountId", email),
      )
      .unique();
    return account !== null;
  },
});

/** Patch an employee's Convex auth user (role/department/force-change flag). */
export const _patchUser = mutation({
  args: {
    userId: v.id("users"),
    role: v.optional(v.string()),
    department: v.optional(v.string()),
    mustChangePassword: v.optional(v.boolean()),
  },
  handler: async (ctx, { userId, role, department, mustChangePassword }) => {
    await ctx.db.patch(userId, {
      ...(role ? { role: role as Role } : {}),
      ...(department !== undefined ? { department: department as Department | undefined } : {}),
      ...(mustChangePassword !== undefined ? { mustChangePassword } : {}),
    });
  },
});
