import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { audit, requireUser, slugify } from "./lib";

const computeSellerStats = async (
  ctx: MutationCtx | QueryCtx,
  seller: Doc<"sellers">,
) => {
  const products = await ctx.db
    .query("products")
    .withIndex("by_seller", (q) => q.eq("sellerId", seller._id))
    .collect();
  const items = await ctx.db
    .query("orderItems")
    .withIndex("by_seller", (q) => q.eq("sellerId", seller._id))
    .collect();
  const payouts = await ctx.db
    .query("payouts")
    .withIndex("by_seller", (q) => q.eq("sellerId", seller._id))
    .collect();

  let revenue = 0; // delivered items, net of commission
  let outstanding = 0; // in-flight items, net of commission
  let commission = 0;
  for (const item of items) {
    if (item.status === "CANCELLED" || item.status === "REFUNDED") continue;
    commission += item.commission;
    if (item.status === "DELIVERED") revenue += item.sellerNet;
    else outstanding += item.sellerNet;
  }
  const paidPayouts = payouts
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + p.net, 0);
  const requestedPayouts = payouts
    .filter((p) => p.status !== "PAID")
    .reduce((sum, p) => sum + p.net, 0);
  const availableBalance = Math.max(0, revenue - paidPayouts - requestedPayouts);

  return {
    productCounts: {
      DRAFT: products.filter((p) => p.status === "DRAFT").length,
      PENDING_REVIEW: products.filter((p) => p.status === "PENDING_REVIEW").length,
      ACTIVE: products.filter((p) => p.status === "ACTIVE").length,
      ARCHIVED: products.filter((p) => p.status === "ARCHIVED").length,
    },
    orderCount: items.filter(
      (i) => i.status !== "CANCELLED" && i.status !== "REFUNDED",
    ).length,
    deliveredCount: items.filter((i) => i.status === "DELIVERED").length,
    revenue,
    outstanding,
    commission,
    availableBalance,
    paidPayouts,
    requestedPayouts,
  };
};

export const mySeller = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const seller = await ctx.db
      .query("sellers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    return seller ?? null;
  },
});

export const submitSellerApplication = mutation({
  args: {
    storeName: v.string(),
    storeSlug: v.string(),
    description: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    businessInfo: v.optional(v.string()),
    storeAddress: v.optional(v.string()),
    shippingSettings: v.optional(
      v.object({
        shipsNationwide: v.optional(v.boolean()),
        flatFee: v.optional(v.number()),
        freeShippingThreshold: v.optional(v.number()),
        processingDays: v.optional(v.number()),
      }),
    ),
    paymentInfo: v.optional(
      v.object({
        method: v.optional(v.string()),
        accountName: v.optional(v.string()),
        accountNumber: v.optional(v.string()),
        bankName: v.optional(v.string()),
      }),
    ),
    agreementAccepted: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!args.agreementAccepted) {
      throw new Error("You must accept the seller agreement.");
    }
    const storeName = args.storeName.trim();
    if (storeName.length < 2) throw new Error("Store name is too short.");
    let storeSlug = slugify(args.storeSlug || storeName);
    if (!storeSlug) throw new Error("Store URL is required.");

    const existing = await ctx.db
      .query("sellers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (existing) {
      if (["PENDING", "UNDER_REVIEW", "APPROVED"].includes(existing.status)) {
        throw new Error(
          `Your application is ${existing.status.toLowerCase()} and cannot be resubmitted.`,
        );
      }
      // Rejected sellers may revise and resubmit.
      await ctx.db.patch(existing._id, {
        storeName,
        storeSlug,
        description: args.description?.trim() || undefined,
        contactPerson: args.contactPerson?.trim() || undefined,
        contactPhone: args.contactPhone?.trim() || undefined,
        contactEmail: args.contactEmail?.trim() || undefined,
        businessInfo: args.businessInfo?.trim() || undefined,
        storeAddress: args.storeAddress?.trim() || undefined,
        shippingSettings: args.shippingSettings,
        paymentInfo: args.paymentInfo,
        agreementAccepted: true,
        status: "PENDING",
        rejectionReason: undefined,
        submittedAt: Date.now(),
      });
      await audit(ctx, {
        actorId: user._id,
        action: "seller.application_resubmitted",
        targetType: "sellers",
        targetId: existing._id,
      });
      return { id: existing._id };
    }

    const id = await ctx.db.insert("sellers", {
      userId: user._id,
      storeName,
      storeSlug,
      description: args.description?.trim() || undefined,
      contactPerson: args.contactPerson?.trim() || undefined,
      contactPhone: args.contactPhone?.trim() || undefined,
      contactEmail: args.contactEmail?.trim() || undefined,
      businessInfo: args.businessInfo?.trim() || undefined,
      storeAddress: args.storeAddress?.trim() || undefined,
      shippingSettings: args.shippingSettings,
      paymentInfo: args.paymentInfo,
      agreementAccepted: true,
      status: "PENDING",
      submittedAt: Date.now(),
    });
    await audit(ctx, {
      actorId: user._id,
      action: "seller.application_submitted",
      targetType: "sellers",
      targetId: id,
    });
    return { id };
  },
});

export const updateSellerProfile = mutation({
  args: {
    storeName: v.optional(v.string()),
    description: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    storeAddress: v.optional(v.string()),
    returnAddress: v.optional(
      v.object({
        contactPerson: v.optional(v.string()),
        phone: v.optional(v.string()),
        line1: v.optional(v.string()),
        district: v.optional(v.string()),
        subdistrict: v.optional(v.string()),
        province: v.optional(v.string()),
        postalCode: v.optional(v.string()),
        country: v.optional(v.string()),
      }),
    ),
    shippingSettings: v.optional(
      v.object({
        shipsNationwide: v.optional(v.boolean()),
        flatFee: v.optional(v.number()),
        freeShippingThreshold: v.optional(v.number()),
        processingDays: v.optional(v.number()),
      }),
    ),
    paymentInfo: v.optional(
      v.object({
        method: v.optional(v.string()),
        accountName: v.optional(v.string()),
        accountNumber: v.optional(v.string()),
        bankName: v.optional(v.string()),
      }),
    ),
    policies: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const seller = await ctx.db
      .query("sellers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!seller || seller.status !== "APPROVED") {
      throw new Error("Only approved sellers can edit their store.");
    }
    const patch: Record<string, unknown> = {};
    if (args.storeName?.trim()) patch.storeName = args.storeName.trim();
    if (args.description !== undefined)
      patch.description = args.description.trim() || undefined;
    if (args.contactPerson !== undefined)
      patch.contactPerson = args.contactPerson.trim() || undefined;
    if (args.contactPhone !== undefined)
      patch.contactPhone = args.contactPhone.trim() || undefined;
    if (args.contactEmail !== undefined)
      patch.contactEmail = args.contactEmail.trim() || undefined;
    if (args.storeAddress !== undefined)
      patch.storeAddress = args.storeAddress.trim() || undefined;
    if (args.returnAddress !== undefined) patch.returnAddress = args.returnAddress;
    if (args.shippingSettings !== undefined)
      patch.shippingSettings = args.shippingSettings;
    if (args.paymentInfo !== undefined) patch.paymentInfo = args.paymentInfo;
    if (args.policies !== undefined) patch.policies = args.policies.trim() || undefined;
    await ctx.db.patch(seller._id, patch as never);
  },
});

export const sellerStats = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const seller = await ctx.db
      .query("sellers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!seller) return null;
    return computeSellerStats(ctx, seller);
  },
});

export const requestPayout = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const seller = await ctx.db
      .query("sellers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!seller || seller.status !== "APPROVED") {
      throw new Error("Only approved sellers can request payouts.");
    }
    const stats = await computeSellerStats(ctx, seller);
    if (stats.availableBalance <= 0) {
      throw new Error("You have no available balance to withdraw.");
    }
    const id = await ctx.db.insert("payouts", {
      sellerId: seller._id,
      periodStart: Date.now() - 30 * 24 * 60 * 60 * 1000,
      periodEnd: Date.now(),
      gross: stats.revenue,
      commission: stats.commission,
      fees: 0,
      refunds: 0,
      net: stats.availableBalance,
      status: "PENDING",
    });
    await audit(ctx, {
      actorId: user._id,
      action: "payout.requested",
      targetType: "payouts",
      targetId: id,
      metadata: { net: stats.availableBalance },
    });
    return { id };
  },
});

export const myPayouts = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const seller = await ctx.db
      .query("sellers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!seller) return [];
    const payouts = await ctx.db
      .query("payouts")
      .withIndex("by_seller", (q) => q.eq("sellerId", seller._id))
      .collect();
    return [...payouts].reverse();
  },
});

// ---------------------------------------------------------------------------
// Image mutations (called by the upload action after Cloudinary succeeds)
// ---------------------------------------------------------------------------

/** Update the seller's store logo URL (called by upload action). */
export const updateStoreLogo = mutation({
  args: { logoUrl: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const seller = await ctx.db
      .query("sellers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!seller) throw new Error("No seller account found.");
    await ctx.db.patch(seller._id, { logo: args.logoUrl });
  },
});

/** Update the seller's store banner URL (called by upload action). */
export const updateStoreBanner = mutation({
  args: { bannerUrl: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const seller = await ctx.db
      .query("sellers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!seller) throw new Error("No seller account found.");
    await ctx.db.patch(seller._id, { banner: args.bannerUrl });
  },
});
