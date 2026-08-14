import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";

// Shared validators for goal fields (kept in sync with schema.ts)
export const goalCategory = v.union(
  v.literal("revenue"),
  v.literal("orders"),
  v.literal("customers"),
  v.literal("other"),
);
export const goalPeriod = v.union(
  v.literal("monthly"),
  v.literal("quarterly"),
  v.literal("yearly"),
);

/** List all goals owned by the signed-in user. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user === null) return [];
    return await ctx.db
      .query("goals")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

/** Create a new business goal / target. */
export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    category: goalCategory,
    unit: v.string(),
    targetValue: v.number(),
    currentValue: v.number(),
    period: goalPeriod,
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (user === null) throw new Error("Not authenticated");
    const now = Date.now();
    return await ctx.db.insert("goals", {
      userId: user._id,
      title: args.title.trim(),
      description: args.description?.trim() || undefined,
      category: args.category,
      unit: args.unit.trim() || "ครั้ง",
      targetValue: args.targetValue,
      currentValue: args.currentValue,
      period: args.period,
      dueDate: args.dueDate,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Update an existing goal (only the owner can edit it). */
export const update = mutation({
  args: {
    goalId: v.id("goals"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(goalCategory),
    unit: v.optional(v.string()),
    targetValue: v.optional(v.number()),
    currentValue: v.optional(v.number()),
    period: v.optional(goalPeriod),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (user === null) throw new Error("Not authenticated");
    const goal = await ctx.db.get(args.goalId);
    if (!goal || goal.userId !== user._id) throw new Error("Goal not found");

    const { goalId, ...patch } = args;
    await ctx.db.patch(goalId, {
      ...patch,
      description: patch.description?.trim() || undefined,
      updatedAt: Date.now(),
    });
  },
});

/** Record progress by adding an amount to the goal's current value. */
export const addProgress = mutation({
  args: {
    goalId: v.id("goals"),
    amount: v.number(),
  },
  handler: async (ctx, { goalId, amount }) => {
    const user = await getCurrentUser(ctx);
    if (user === null) throw new Error("Not authenticated");
    const goal = await ctx.db.get(goalId);
    if (!goal || goal.userId !== user._id) throw new Error("Goal not found");
    await ctx.db.patch(goalId, {
      currentValue: Math.max(0, Math.round((goal.currentValue + amount) * 100) / 100),
      updatedAt: Date.now(),
    });
  },
});

/** Delete a goal (owner only). */
export const remove = mutation({
  args: { goalId: v.id("goals") },
  handler: async (ctx, { goalId }) => {
    const user = await getCurrentUser(ctx);
    if (user === null) throw new Error("Not authenticated");
    const goal = await ctx.db.get(goalId);
    if (!goal || goal.userId !== user._id) throw new Error("Goal not found");
    await ctx.db.delete(goalId);
  },
});
