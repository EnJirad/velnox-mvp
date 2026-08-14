import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { canAccessCenter, canSell, getCurrentUser } from "./users";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Is this product past its expected reorder window? (mirrors lib/reorder logic) */
const isReorderDue = (product: {
  avgCycleDays?: number;
  estimatedCycleDays?: number;
  lastOrderedAt?: number;
}) => {
  const cycle = product.avgCycleDays ?? product.estimatedCycleDays;
  if (cycle === undefined || product.lastOrderedAt === undefined) return false;
  return (Date.now() - product.lastOrderedAt) / DAY_MS >= cycle;
};

/**
 * Business-wide overview for the velcenter dashboard (admin only):
 * sales, orders, inventory health and goals in one place.
 */
export const overview = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user === null || !canAccessCenter(user.role)) throw new Error("Center only");

    const [orders, products, goals, users] = await Promise.all([
      ctx.db.query("orders").collect(),
      ctx.db.query("products").collect(),
      ctx.db.query("goals").collect(),
      ctx.db.query("users").collect(),
    ]);

    const activeOrders = orders.filter((o) => o.status !== "cancelled");
    const revenue = orders
      .filter((o) => o.status === "completed")
      .reduce((sum, o) => sum + o.total, 0);

    const lowStock = products.filter(
      (p) => p.reorderLevel > 0 && p.currentStock <= p.reorderLevel,
    );

    const customers = users.filter(
      (u) => u.role !== "admin" && u.role !== "seller",
    ).length;

    return {
      revenue,
      orderCount: activeOrders.length,
      pendingOrders: orders.filter((o) => o.status === "pending").length,
      completedOrders: orders.filter((o) => o.status === "completed").length,
      productCount: products.length,
      publishedCount: products.filter((p) => p.published).length,
      lowStockCount: lowStock.length,
      dueReorderCount: products.filter(isReorderDue).length,
      goalsTotal: goals.length,
      goalsAchieved: goals.filter(
        (g) => g.targetValue > 0 && g.currentValue >= g.targetValue,
      ).length,
      customerCount: customers,
    };
  },
});

/** Public store info for the velshop storefront (no auth). */
export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    const doc = await ctx.db
      .query("storeSettings")
      .withIndex("by_key", (q) => q.eq("key", "main"))
      .first();
    return doc ?? null;
  },
});

/** Update store settings shown on the storefront (seller/admin). */
export const updateSettings = mutation({
  args: {
    shopName: v.optional(v.string()),
    tagline: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    announcement: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (user === null) throw new Error("Not authenticated");
    if (!canSell(user.role)) throw new Error("Seller only");

    const existing = await ctx.db
      .query("storeSettings")
      .withIndex("by_key", (q) => q.eq("key", "main"))
      .first();

    const patch = {
      shopName: args.shopName?.trim() || undefined,
      tagline: args.tagline?.trim() || undefined,
      phone: args.phone?.trim() || undefined,
      address: args.address?.trim() || undefined,
      announcement: args.announcement?.trim() || undefined,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("storeSettings", { key: "main", ...patch });
    }
  },
});
