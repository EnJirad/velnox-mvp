/**
 * Convex Intelligence layer (VelRepeat brain).
 *
 * Commerce data lives in Neon (source of truth). This module only holds the
 * Convex-owned state: customer interests/views, business events bridged from
 * Neon, and (in future) predictions + notifications.
 *
 * Node actions in `commerce.ts` reach these via ctx.runMutation / ctx.runQuery.
 */
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Record that a shopper is interested in a Neon product ("❤️ สนใจ").
 * productId is the NEON product id (commerce source of truth stays in Neon).
 */
export const recordInterest = mutation({
  args: { productId: v.string() },
  handler: async (ctx, { productId }) => {
    const userId = await getAuthUserId(ctx);
    await ctx.db.insert("interests", {
      userId: userId ?? undefined,
      productId,
      viewedAt: Date.now(),
    });
  },
});

/** Recent interest rows — newest first; optionally scoped to one customer. */
export const recentInterests = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, { userId }) => {
    if (userId) {
      return ctx.db
        .query("interests")
        .withIndex("by_user", (q) => q.eq("userId", userId as Id<"users">))
        .order("desc")
        .take(300);
    }
    return ctx.db.query("interests").order("desc").take(500);
  },
});

/**
 * Neon -> Convex business event bridge. The commerce layer (commerce.ts)
 * calls this whenever a business fact changes in Neon:
 * OrderCreated, PaymentConfirmed, OrderStatusChanged, InventoryChanged,
 * ProductUpdated, SubscriptionUpdated, ...
 * This is the realtime/intelligence foundation (live dashboards, push
 * notifications, VelRepeat reminders).
 */
export const recordBusinessEvent = mutation({
  args: {
    type: v.string(),
    entityId: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, { type, entityId, payload }) => {
    await ctx.db.insert("businessEvents", {
      type,
      entityId,
      payload,
      createdAt: Date.now(),
    });
  },
});
