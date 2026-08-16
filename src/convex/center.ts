import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { audit, requireUser } from "./lib";

/** Employee guard shared by every VelCenter function. */
const requireEmployee = async (ctx: MutationCtx | QueryCtx) => {
  const user = await requireUser(ctx);
  const employee = await ctx.db
    .query("employees")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .first();
  if (!employee || employee.status !== "active") {
    throw new Error("VelCenter access is restricted to Velnox employees.");
  }
  return { user, employee };
};

/**
 * First-user bootstrap: when the company has no employees yet, the first
 * signed-in user to open VelCenter becomes the Super Admin. This gives a
 * fresh deployment an owner; afterwards every center action is
 * employee-gated.
 */
export const claimBootstrapAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const first = await ctx.db.query("employees").first();
    if (first) {
      throw new Error("VelCenter access is managed by the platform team.");
    }
    const id = await ctx.db.insert("employees", {
      userId: user._id,
      employeeId: "VL-0001",
      role: "SUPER_ADMIN",
      department: "Leadership",
      status: "active",
      createdAt: Date.now(),
    });
    await ctx.db.patch(user._id, { accountType: "employee" });
    await audit(ctx, {
      actorId: user._id,
      action: "employee.bootstrap_super_admin",
      targetType: "employees",
      targetId: id,
    });
    return { id };
  },
});

export const isEmployee = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const employee = await ctx.db
      .query("employees")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    return employee ?? null;
  },
});

export const centerStats = query({
  args: {},
  handler: async (ctx) => {
    await requireEmployee(ctx);
    const [products, sellers, orders, payouts] = await Promise.all([
      ctx.db.query("products").collect(),
      ctx.db.query("sellers").collect(),
      ctx.db.query("orders").collect(),
      ctx.db.query("payouts").collect(),
    ]);
    const grossMerchandiseValue = orders
      .filter((o) => o.status !== "CANCELLED")
      .reduce((sum, o) => sum + o.total, 0);
    return {
      products: products.length,
      activeProducts: products.filter((p) => p.status === "ACTIVE").length,
      pendingProductReviews: products.filter(
        (p) => p.status === "PENDING_REVIEW",
      ).length,
      sellers: sellers.length,
      approvedSellers: sellers.filter((s) => s.status === "APPROVED").length,
      pendingSellerApplications: sellers.filter((s) =>
        ["PENDING", "UNDER_REVIEW"].includes(s.status),
      ).length,
      orders: orders.length,
      grossMerchandiseValue,
      pendingPayouts: payouts.filter((p) => p.status !== "PAID").length,
    };
  },
});

export const listSellerApplications = query({
  args: {},
  handler: async (ctx) => {
    await requireEmployee(ctx);
    const sellers = await ctx.db.query("sellers").collect();
    const result = [];
    for (const seller of [...sellers].reverse()) {
      const user = await ctx.db.get(seller.userId);
      result.push({
        id: seller._id,
        storeName: seller.storeName,
        storeSlug: seller.storeSlug,
        status: seller.status,
        submittedAt: seller.submittedAt ?? seller._creationTime,
        rejectionReason: seller.rejectionReason,
        contactEmail: seller.contactEmail ?? user?.email,
        contactPerson: seller.contactPerson,
        contactPhone: seller.contactPhone,
        businessInfo: seller.businessInfo,
        description: seller.description,
        agreementAccepted: seller.agreementAccepted,
      });
    }
    return result;
  },
});

export const reviewSeller = mutation({
  args: {
    sellerId: v.id("sellers"),
    decision: v.union(v.literal("APPROVED"), v.literal("REJECTED")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { sellerId, decision, reason }) => {
    const { user } = await requireEmployee(ctx);
    const seller = await ctx.db.get(sellerId);
    if (!seller) throw new Error("Seller application not found.");
    if (!["PENDING", "UNDER_REVIEW", "REJECTED"].includes(seller.status)) {
      throw new Error("This application has already been reviewed.");
    }
    await ctx.db.patch(sellerId, {
      status: decision,
      rejectionReason: decision === "REJECTED" ? reason?.trim() : undefined,
      reviewedBy: user._id,
      reviewedAt: Date.now(),
      approvedAt: decision === "APPROVED" ? Date.now() : undefined,
    });
    if (decision === "APPROVED") {
      await ctx.db.patch(seller.userId, { accountType: "seller" });
    }
    await ctx.db.insert("notifications", {
      userId: seller.userId,
      type: "seller",
      title:
        decision === "APPROVED"
          ? "Welcome to Velnox — your store is live!"
          : "Your seller application was not approved",
      body:
        decision === "APPROVED"
          ? "You can now add products and start selling on Velshop."
          : reason?.trim() || "Please revise your application and resubmit.",
      link: "/seller",
      read: false,
    });
    await audit(ctx, {
      actorId: user._id,
      action: `seller.${decision.toLowerCase()}`,
      targetType: "sellers",
      targetId: sellerId,
      metadata: { reason: reason?.trim() },
    });
  },
});

export const updateSellerStatus = mutation({
  args: {
    sellerId: v.id("sellers"),
    status: v.union(
      v.literal("APPROVED"),
      v.literal("SUSPENDED"),
      v.literal("DISABLED"),
    ),
  },
  handler: async (ctx, { sellerId, status }) => {
    const { user } = await requireEmployee(ctx);
    const seller = await ctx.db.get(sellerId);
    if (!seller) throw new Error("Seller not found.");
    await ctx.db.patch(sellerId, { status });
    await ctx.db.insert("notifications", {
      userId: seller.userId,
      type: "seller",
      title: `Your store was ${status.toLowerCase()}`,
      body: "Contact Velnox support if you believe this is a mistake.",
      link: "/seller",
      read: false,
    });
    await audit(ctx, {
      actorId: user._id,
      action: `seller.status_${status.toLowerCase()}`,
      targetType: "sellers",
      targetId: sellerId,
    });
  },
});

export const listProductReviews = query({
  args: {},
  handler: async (ctx) => {
    await requireEmployee(ctx);
    const products = await ctx.db
      .query("products")
      .withIndex("by_status", (q) => q.eq("status", "PENDING_REVIEW"))
      .collect();
    const result = [];
    for (const product of [...products].reverse()) {
      const seller = await ctx.db.get(product.sellerId);
      result.push({
        id: product._id,
        name: product.name,
        price: product.price,
        images: product.images,
        stock: product.stock,
        description: product.description,
        sellerName: seller?.storeName ?? "Unknown store",
        updatedAt: product.updatedAt,
      });
    }
    return result;
  },
});

export const reviewProduct = mutation({
  args: {
    productId: v.id("products"),
    decision: v.union(v.literal("ACTIVE"), v.literal("REJECTED")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { productId, decision, reason }) => {
    const { user } = await requireEmployee(ctx);
    const product = await ctx.db.get(productId);
    if (!product) throw new Error("Product not found.");
    if (product.status !== "PENDING_REVIEW") {
      throw new Error("This product is not pending review.");
    }
    await ctx.db.patch(productId, {
      status: decision,
      rejectionReason: decision === "REJECTED" ? reason?.trim() : undefined,
      reviewedBy: user._id,
      reviewedAt: Date.now(),
      updatedAt: Date.now(),
    });
    const seller = await ctx.db.get(product.sellerId);
    if (seller) {
      await ctx.db.insert("notifications", {
        userId: seller.userId,
        type: "product",
        title:
          decision === "ACTIVE"
            ? `"${product.name}" is now live on Velshop`
            : `"${product.name}" was not approved`,
        body:
          decision === "ACTIVE"
            ? "Customers can now find and buy this product."
            : reason?.trim() || "Please edit and resubmit the product.",
        link: "/seller",
        read: false,
      });
    }
    await audit(ctx, {
      actorId: user._id,
      action: `product.${decision === "ACTIVE" ? "approved" : "rejected"}`,
      targetType: "products",
      targetId: productId,
      metadata: { reason: reason?.trim() },
    });
  },
});

export const listSellers = query({
  args: {},
  handler: async (ctx) => {
    await requireEmployee(ctx);
    const sellers = await ctx.db.query("sellers").collect();
    const result = [];
    for (const seller of [...sellers].reverse()) {
      const user = await ctx.db.get(seller.userId);
      const productCount = await ctx.db
        .query("products")
        .withIndex("by_seller", (q) => q.eq("sellerId", seller._id))
        .collect();
      result.push({
        id: seller._id,
        storeName: seller.storeName,
        storeSlug: seller.storeSlug,
        status: seller.status,
        submittedAt: seller.submittedAt ?? seller._creationTime,
        approvedAt: seller.approvedAt,
        email: user?.email,
        productCount: productCount.length,
      });
    }
    return result;
  },
});

export const listAllOrders = query({
  args: {},
  handler: async (ctx) => {
    await requireEmployee(ctx);
    const orders = await ctx.db.query("orders").collect();
    const result = [];
    for (const order of [...orders].reverse()) {
      const user = await ctx.db.get(order.userId);
      const items = await ctx.db
        .query("orderItems")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();
      result.push({
        id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.total,
        itemCount: items.length,
        customerEmail: user?.email,
        customerName: user?.name,
        createdAt: order._creationTime,
        paymentMethod: order.paymentMethod,
      });
    }
    return result;
  },
});

export const listPayouts = query({
  args: {},
  handler: async (ctx) => {
    await requireEmployee(ctx);
    const payouts = await ctx.db.query("payouts").collect();
    const result = [];
    for (const payout of [...payouts].reverse()) {
      const seller = await ctx.db.get(payout.sellerId);
      result.push({
        id: payout._id,
        storeName: seller?.storeName ?? "Unknown store",
        net: payout.net,
        gross: payout.gross,
        commission: payout.commission,
        status: payout.status,
        periodStart: payout.periodStart,
        periodEnd: payout.periodEnd,
        paidAt: payout.paidAt,
      });
    }
    return result;
  },
});

export const resolvePayout = mutation({
  args: { payoutId: v.id("payouts") },
  handler: async (ctx, { payoutId }) => {
    const { user } = await requireEmployee(ctx);
    const payout = await ctx.db.get(payoutId);
    if (!payout) throw new Error("Payout not found.");
    if (payout.status === "PAID") throw new Error("Payout already paid.");
    await ctx.db.patch(payoutId, { status: "PAID", paidAt: Date.now() });
    const seller = await ctx.db.get(payout.sellerId);
    if (seller) {
      await ctx.db.insert("notifications", {
        userId: seller.userId,
        type: "payout",
        title: "Payout sent",
        body: `฿${(payout.net / 100).toLocaleString()} was paid to your account.`,
        link: "/seller",
        read: false,
      });
    }
    await audit(ctx, {
      actorId: user._id,
      action: "payout.paid",
      targetType: "payouts",
      targetId: payoutId,
      metadata: { net: payout.net },
    });
  },
});
