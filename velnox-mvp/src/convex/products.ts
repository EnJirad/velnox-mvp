import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { canAccessCenter, canSell, getCurrentUser } from "./users";

const DAY_MS = 24 * 60 * 60 * 1000;

// Shared validator for product categories (kept in sync with schema.ts)
export const productCategory = v.union(
  v.literal("general"),
  v.literal("food"),
  v.literal("daily"),
  v.literal("beauty"),
  v.literal("packaging"),
  v.literal("other"),
);

/** List all inventory products owned by the signed-in user. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user === null) return [];
    return await ctx.db
      .query("products")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

/** Public storefront query: products the owner has published for sale. */
export const listPublished = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("products")
      .filter((q) => q.eq(q.field("published"), true))
      .order("desc")
      .collect();
  },
});

/** All products across the marketplace (velcenter view — owner/admin/staff). */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user === null || !canAccessCenter(user.role)) throw new Error("Center only");
    return await ctx.db.query("products").order("desc").collect();
  },
});

/**
 * VelRepeat: record that a shopper showed interest in a product (click / "สนใจ").
 * Kept per customer so Velnox can learn each person's interests over time.
 */
export const recordView = mutation({
  args: { productId: v.id("products") },
  handler: async (ctx, { productId }) => {
    const user = await getCurrentUser(ctx);
    await ctx.db.insert("productViews", {
      userId: user?._id,
      productId,
      viewedAt: Date.now(),
    });
  },
});

/** Most-interested products across all shoppers, last 30 days (public). */
export const popularProducts = query({
  args: {},
  handler: async (ctx) => {
    const since = Date.now() - 30 * DAY_MS;
    const views = await ctx.db.query("productViews").order("desc").take(500);
    const counts = new Map<
      string,
      { views: number; lastViewedAt: number }
    >();
    for (const view of views) {
      if (view.viewedAt < since) continue;
      const agg = counts.get(view.productId) ?? { views: 0, lastViewedAt: 0 };
      agg.views += 1;
      agg.lastViewedAt = Math.max(agg.lastViewedAt, view.viewedAt);
      counts.set(view.productId, agg);
    }

    const rows: {
      product: Doc<"products">;
      views: number;
      lastViewedAt: number;
    }[] = [];
    for (const [productId, agg] of counts) {
      const product = await ctx.db.get(productId as Id<"products">);
      if (!product || !product.published || product.price === undefined) continue;
      rows.push({ product, ...agg });
    }
    rows.sort((a, b) => b.views - a.views || b.lastViewedAt - a.lastViewedAt);
    return rows.slice(0, 8);
  },
});

/**
 * VelRepeat personalization: which products THIS customer is most interested in,
 * learned from their own clicks on velshop. Empty for signed-out visitors.
 */
export const customerInterests = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user === null) return [];
    const views = await ctx.db
      .query("productViews")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(300);

    const counts = new Map<
      string,
      { views: number; lastViewedAt: number }
    >();
    for (const view of views) {
      const agg = counts.get(view.productId) ?? { views: 0, lastViewedAt: 0 };
      agg.views += 1;
      agg.lastViewedAt = Math.max(agg.lastViewedAt, view.viewedAt);
      counts.set(view.productId, agg);
    }

    const rows: {
      product: Doc<"products">;
      views: number;
      lastViewedAt: number;
    }[] = [];
    for (const [productId, agg] of counts) {
      const product = await ctx.db.get(productId as Id<"products">);
      if (!product || !product.published || product.price === undefined) continue;
      rows.push({ product, ...agg });
    }
    rows.sort((a, b) => b.views - a.views || b.lastViewedAt - a.lastViewedAt);
    return rows.slice(0, 8);
  },
});

/** List the latest reorder (purchase) history for the signed-in user. */
export const listPurchases = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const user = await getCurrentUser(ctx);
    if (user === null) return [];
    const rows = await ctx.db
      .query("purchases")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit ?? 30);
    return rows;
  },
});

/** Create a new inventory product. */
export const create = mutation({
  args: {
    name: v.string(),
    category: productCategory,
    unit: v.string(),
    currentStock: v.number(),
    reorderLevel: v.number(),
    price: v.optional(v.number()),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    published: v.optional(v.boolean()),
    supplier: v.optional(v.string()),
    estimatedCycleDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (user === null) throw new Error("Not authenticated");
    const now = Date.now();
    return await ctx.db.insert("products", {
      userId: user._id,
      name: args.name.trim(),
      category: args.category,
      unit: args.unit.trim() || "ชิ้น",
      currentStock: Math.max(0, args.currentStock),
      reorderLevel: Math.max(0, args.reorderLevel),
      price: args.price && args.price > 0 ? args.price : undefined,
      description: args.description?.trim() || undefined,
      imageUrl: args.imageUrl?.trim() || undefined,
      published: args.published ?? false,
      supplier: args.supplier?.trim() || undefined,
      estimatedCycleDays:
        args.estimatedCycleDays && args.estimatedCycleDays > 0
          ? Math.round(args.estimatedCycleDays)
          : undefined,
      avgCycleDays: undefined,
      purchaseCount: 0,
      lastOrderedAt: undefined,
      lastPurchaseQty: undefined,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Update an inventory product (owner only). */
export const update = mutation({
  args: {
    productId: v.id("products"),
    name: v.optional(v.string()),
    category: v.optional(productCategory),
    unit: v.optional(v.string()),
    currentStock: v.optional(v.number()),
    reorderLevel: v.optional(v.number()),
    price: v.optional(v.number()),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    published: v.optional(v.boolean()),
    supplier: v.optional(v.string()),
    estimatedCycleDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (user === null) throw new Error("Not authenticated");
    const product = await ctx.db.get(args.productId);
    if (!product || product.userId !== user._id) throw new Error("Product not found");

    const { productId, ...patch } = args;
    await ctx.db.patch(productId, {
      ...patch,
      name: patch.name?.trim(),
      unit: patch.unit?.trim(),
      supplier: patch.supplier?.trim() || undefined,
      price: patch.price && patch.price > 0 ? patch.price : undefined,
      description: patch.description?.trim() || undefined,
      imageUrl: patch.imageUrl?.trim() || undefined,
      estimatedCycleDays:
        patch.estimatedCycleDays && patch.estimatedCycleDays > 0
          ? Math.round(patch.estimatedCycleDays)
          : undefined,
      updatedAt: Date.now(),
    });
  },
});

/** Publish / unpublish a product for the velshop storefront (the merchant who owns it). */
export const togglePublished = mutation({
  args: {
    productId: v.id("products"),
    published: v.boolean(),
  },
  handler: async (ctx, { productId, published }) => {
    const user = await getCurrentUser(ctx);
    if (user === null || !canSell(user.role)) throw new Error("Seller only");
    const product = await ctx.db.get(productId);
    if (!product || product.userId !== user._id) throw new Error("Product not found");
    if (published && !product.price) throw new Error("ต้องตั้งราคาก่อนจึงจะประกาศขายได้");
    await ctx.db.patch(productId, { published, updatedAt: Date.now() });
  },
});

/**
 * Record a reorder (purchase from supplier): restocks the product and learns
 * the purchase cycle — Velnox "Remember → Learn". Each gap between two
 * consecutive orders feeds a rolling average of the cycle in days.
 */
export const recordPurchase = mutation({
  args: {
    productId: v.id("products"),
    quantity: v.number(),
    cost: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { productId, quantity, cost, note }) => {
    const user = await getCurrentUser(ctx);
    if (user === null) throw new Error("Not authenticated");
    const product = await ctx.db.get(productId);
    if (!product || product.userId !== user._id) throw new Error("Product not found");
    if (quantity <= 0) throw new Error("Quantity must be positive");

    const now = Date.now();
    let avgCycleDays = product.avgCycleDays;
    if (product.lastOrderedAt !== undefined) {
      const gapDays = (now - product.lastOrderedAt) / DAY_MS;
      if (gapDays >= 0.5) {
        const prevCount = product.purchaseCount;
        const prevAvg = avgCycleDays ?? gapDays;
        avgCycleDays = Math.round(((prevAvg * prevCount + gapDays) / (prevCount + 1)) * 10) / 10;
      }
    }

    await ctx.db.insert("purchases", {
      userId: user._id,
      productId,
      quantity,
      cost: cost && cost > 0 ? cost : undefined,
      note: note?.trim() || undefined,
      orderedAt: now,
      createdAt: now,
    });

    await ctx.db.patch(productId, {
      currentStock: Math.max(0, product.currentStock + quantity),
      lastOrderedAt: now,
      avgCycleDays,
      purchaseCount: product.purchaseCount + 1,
      lastPurchaseQty: quantity,
      updatedAt: now,
    });
  },
});

/** Record a sale / usage: deducts stock from the product. */
export const recordSale = mutation({
  args: {
    productId: v.id("products"),
    quantity: v.number(),
  },
  handler: async (ctx, { productId, quantity }) => {
    const user = await getCurrentUser(ctx);
    if (user === null) throw new Error("Not authenticated");
    const product = await ctx.db.get(productId);
    if (!product || product.userId !== user._id) throw new Error("Product not found");
    if (quantity <= 0) throw new Error("Quantity must be positive");

    await ctx.db.patch(productId, {
      currentStock: Math.max(0, product.currentStock - quantity),
      updatedAt: Date.now(),
    });
  },
});

/** Delete a product (owner only). Also removes its purchase history. */
export const remove = mutation({
  args: { productId: v.id("products") },
  handler: async (ctx, { productId }) => {
    const user = await getCurrentUser(ctx);
    if (user === null) throw new Error("Not authenticated");
    const product = await ctx.db.get(productId);
    if (!product || product.userId !== user._id) throw new Error("Product not found");
    const history = await ctx.db
      .query("purchases")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    await Promise.all(
      history.filter((p) => p.productId === productId).map((p) => ctx.db.delete(p._id)),
    );
    await ctx.db.delete(productId);
  },
});
