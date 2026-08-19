// ---------------------------------------------------------------------------
// Sellers — application lifecycle, profile, stats, payouts
// ---------------------------------------------------------------------------

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/** Get current user's seller record */
export const getCurrentSeller = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    return await ctx.db
      .query("sellers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});

/** Get seller by slug (public) */
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sellers")
      .withIndex("by_slug", (q) => q.eq("storeSlug", args.slug))
      .first();
  },
});

/** Submit a seller application */
export const apply = mutation({
  args: {
    storeName: v.string(),
    storeSlug: v.string(),
    description: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    businessInfo: v.optional(v.string()),
    storeAddress: v.optional(v.string()),
    agreementAccepted: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check existing
    const existing = await ctx.db
      .query("sellers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing && existing.status !== "REJECTED") {
      throw new Error("Application already exists");
    }

    const now = Date.now();

    if (existing) {
      // Resubmit rejected application
      await ctx.db.patch(existing._id, {
        storeName: args.storeName,
        storeSlug: args.storeSlug,
        description: args.description,
        contactPerson: args.contactPerson,
        contactPhone: args.contactPhone,
        contactEmail: args.contactEmail,
        businessInfo: args.businessInfo,
        storeAddress: args.storeAddress,
        agreementAccepted: args.agreementAccepted,
        status: "PENDING",
        rejectionReason: undefined,
        submittedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("sellers", {
      userId,
      storeName: args.storeName,
      storeSlug: args.storeSlug,
      description: args.description,
      contactPerson: args.contactPerson,
      contactPhone: args.contactPhone,
      contactEmail: args.contactEmail,
      businessInfo: args.businessInfo,
      storeAddress: args.storeAddress,
      agreementAccepted: args.agreementAccepted,
      status: "PENDING",
      submittedAt: now,
    });
  },
});

/** Update seller profile */
export const updateProfile = mutation({
  args: {
    sellerId: v.id("sellers"),
    storeName: v.optional(v.string()),
    description: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    storeAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const seller = await ctx.db.get(args.sellerId);
    if (!seller || seller.userId !== userId)
      throw new Error("Unauthorized");

    const updates: Record<string, unknown> = {};
    if (args.storeName !== undefined) updates.storeName = args.storeName;
    if (args.description !== undefined) updates.description = args.description;
    if (args.contactPerson !== undefined) updates.contactPerson = args.contactPerson;
    if (args.contactPhone !== undefined) updates.contactPhone = args.contactPhone;
    if (args.storeAddress !== undefined) updates.storeAddress = args.storeAddress;

    await ctx.db.patch(args.sellerId, updates);
    return args.sellerId;
  },
});

/** Update store logo */
export const updateStoreLogo = mutation({
  args: {
    sellerId: v.id("sellers"),
    logo: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const seller = await ctx.db.get(args.sellerId);
    if (!seller || seller.userId !== userId)
      throw new Error("Unauthorized");

    await ctx.db.patch(args.sellerId, { logo: args.logo });
    return args.sellerId;
  },
});

/** Update store banner */
export const updateStoreBanner = mutation({
  args: {
    sellerId: v.id("sellers"),
    banner: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const seller = await ctx.db.get(args.sellerId);
    if (!seller || seller.userId !== userId)
      throw new Error("Unauthorized");

    await ctx.db.patch(args.sellerId, { banner: args.banner });
    return args.sellerId;
  },
});

/** Seller stats */
export const getStats = query({
  args: { sellerId: v.id("sellers") },
  handler: async (ctx, args) => {
    const seller = await ctx.db.get(args.sellerId);
    if (!seller) return null;

    const products = await ctx.db
      .query("products")
      .withIndex("by_seller", (q) => q.eq("sellerId", args.sellerId))
      .collect();

    const orderItems = await ctx.db
      .query("orderItems")
      .withIndex("by_seller", (q) => q.eq("sellerId", args.sellerId))
      .collect();

    const totalRevenue = orderItems
      .filter((i) => i.status === "DELIVERED")
      .reduce((sum, i) => sum + i.sellerNet, 0);

    const totalCommission = orderItems
      .filter((i) => i.status === "DELIVERED")
      .reduce((sum, i) => sum + i.commission, 0);

    const activeProducts = products.filter(
      (p) => p.status === "ACTIVE",
    ).length;

    const totalSold = products.reduce((sum, p) => sum + p.totalSold, 0);

    return {
      totalRevenue,
      totalCommission,
      activeProducts,
      totalProducts: products.length,
      totalSold,
      pendingOrders: orderItems.filter((i) => i.status === "PENDING")
        .length,
    };
  },
});

/** Request a payout */
export const requestPayout = mutation({
  args: {
    sellerId: v.id("sellers"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const seller = await ctx.db.get(args.sellerId);
    if (!seller || seller.userId !== userId)
      throw new Error("Unauthorized");
    if (seller.status !== "APPROVED")
      throw new Error("Seller not approved");

    // Compute available balance
    const orderItems = await ctx.db
      .query("orderItems")
      .withIndex("by_seller", (q) => q.eq("sellerId", args.sellerId))
      .collect();

    const delivered = orderItems.filter((i) => i.status === "DELIVERED");
    const gross = delivered.reduce((sum, i) => sum + i.subtotal, 0);
    const commission = delivered.reduce((sum, i) => sum + i.commission, 0);
    const net = gross - commission;

    // Check existing pending payouts
    const existingPayouts = await ctx.db
      .query("payouts")
      .withIndex("by_seller", (q) => q.eq("sellerId", args.sellerId))
      .collect();

    const alreadyPaid = existingPayouts
      .filter((p) => p.status === "PAID")
      .reduce((sum, p) => sum + p.net, 0);

    const available = net - alreadyPaid;
    if (available <= 0) throw new Error("No available balance");

    return await ctx.db.insert("payouts", {
      sellerId: args.sellerId,
      periodStart: Date.now() - 30 * 24 * 60 * 60 * 1000,
      periodEnd: Date.now(),
      gross,
      commission,
      fees: 0,
      refunds: 0,
      net: available,
      status: "PENDING",
    });
  },
});

/** List payouts for a seller */
export const listPayouts = query({
  args: { sellerId: v.id("sellers") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("payouts")
      .withIndex("by_seller", (q) => q.eq("sellerId", args.sellerId))
      .collect();
  },
});
