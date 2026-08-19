// ---------------------------------------------------------------------------
// Center — VelCenter admin operations
// ---------------------------------------------------------------------------

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { EMPLOYEE_ROLES } from "./schema";

/** Check if current user is an employee */
const requireEmployee = async (ctx: any) => {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");

  const employee = await ctx.db
    .query("employees")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();

  if (!employee || employee.status !== "active") {
    throw new Error("Not an active employee");
  }

  return { userId, employee };
};

/** Bootstrap first employee as SUPER_ADMIN */
export const bootstrap = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if any employees exist
    const existing = await ctx.db.query("employees").first();
    if (existing) throw new Error("Employees already exist");

    const employeeId = `VL-${Date.now().toString(36).toUpperCase()}`;

    return await ctx.db.insert("employees", {
      userId,
      employeeId,
      role: EMPLOYEE_ROLES.SUPER_ADMIN,
      department: "Executive",
      status: "active",
      createdAt: Date.now(),
    });
  },
});

/** Check if current user is an employee */
export const isEmployee = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const employee = await ctx.db
      .query("employees")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return employee;
  },
});

/** Dashboard stats */
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    await requireEmployee(ctx);

    const totalSellers = (await ctx.db.query("sellers").collect()).length;
    const approvedSellers = (
      await ctx.db
        .query("sellers")
        .withIndex("by_slug", (q) => q)
        .collect()
    ).filter((s) => s.status === "APPROVED").length;

    const pendingApplications = (
      await ctx.db.query("sellers").collect()
    ).filter(
      (s) => s.status === "PENDING" || s.status === "UNDER_REVIEW",
    ).length;

    const totalProducts = (await ctx.db.query("products").collect()).length;
    const pendingProducts = (
      await ctx.db.query("products").collect()
    ).filter((p) => p.status === "PENDING_REVIEW").length;

    const totalOrders = (await ctx.db.query("orders").collect()).length;

    const totalRevenue = (
      await ctx.db.query("orders").collect()
    ).reduce((sum, o) => sum + o.total, 0);

    const pendingPayouts = (
      await ctx.db.query("payouts").collect()
    ).filter((p) => p.status === "PENDING").length;

    return {
      totalSellers,
      approvedSellers,
      pendingApplications,
      totalProducts,
      pendingProducts,
      totalOrders,
      totalRevenue,
      pendingPayouts,
    };
  },
});

/** List pending seller applications */
export const listPendingApplications = query({
  args: {},
  handler: async (ctx) => {
    await requireEmployee(ctx);

    const sellers = await ctx.db.query("sellers").collect();
    const pending = sellers.filter(
      (s) => s.status === "PENDING" || s.status === "UNDER_REVIEW",
    );

    const enriched = await Promise.all(
      pending.map(async (s) => {
        const user = await ctx.db.get(s.userId);
        return { ...s, userName: user?.name ?? "Unknown" };
      }),
    );

    return enriched;
  },
});

/** Approve a seller */
export const approveSeller = mutation({
  args: {
    sellerId: v.id("sellers"),
  },
  handler: async (ctx, args) => {
    const { employee } = await requireEmployee(ctx);

    const seller = await ctx.db.get(args.sellerId);
    if (!seller) throw new Error("Seller not found");

    await ctx.db.patch(args.sellerId, {
      status: "APPROVED",
      reviewedBy: employee.userId,
      reviewedAt: Date.now(),
      approvedAt: Date.now(),
    });

    // Notify seller
    await ctx.db.insert("notifications", {
      userId: seller.userId,
      type: "SELLER_APPROVED",
      title: "Application approved",
      body: "Your seller application has been approved!",
      link: "/seller",
      read: false,
    });

    return args.sellerId;
  },
});

/** Reject a seller */
export const rejectSeller = mutation({
  args: {
    sellerId: v.id("sellers"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { employee } = await requireEmployee(ctx);

    const seller = await ctx.db.get(args.sellerId);
    if (!seller) throw new Error("Seller not found");

    await ctx.db.patch(args.sellerId, {
      status: "REJECTED",
      rejectionReason: args.reason,
      reviewedBy: employee.userId,
      reviewedAt: Date.now(),
    });

    await ctx.db.insert("notifications", {
      userId: seller.userId,
      type: "SELLER_REJECTED",
      title: "Application rejected",
      body: args.reason,
      link: "/seller",
      read: false,
    });

    return args.sellerId;
  },
});

/** Suspend a seller */
export const suspendSeller = mutation({
  args: {
    sellerId: v.id("sellers"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { employee } = await requireEmployee(ctx);

    await ctx.db.patch(args.sellerId, {
      status: "SUSPENDED",
      rejectionReason: args.reason,
      reviewedBy: employee.userId,
      reviewedAt: Date.now(),
    });

    const seller = await ctx.db.get(args.sellerId);
    if (seller) {
      await ctx.db.insert("notifications", {
        userId: seller.userId,
        type: "SELLER_SUSPENDED",
        title: "Store suspended",
        body: args.reason,
        link: "/seller",
        read: false,
      });
    }

    return args.sellerId;
  },
});

/** Reactivate a seller */
export const reactivateSeller = mutation({
  args: { sellerId: v.id("sellers") },
  handler: async (ctx, args) => {
    await requireEmployee(ctx);

    await ctx.db.patch(args.sellerId, {
      status: "APPROVED",
      rejectionReason: undefined,
    });

    return args.sellerId;
  },
});

/** Review a product */
export const reviewProduct = mutation({
  args: {
    productId: v.id("products"),
    status: v.union(v.literal("ACTIVE"), v.literal("REJECTED")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { employee } = await requireEmployee(ctx);

    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");

    await ctx.db.patch(args.productId, {
      status: args.status,
      rejectionReason: args.reason,
      reviewedBy: employee.userId,
      reviewedAt: Date.now(),
    });

    const seller = await ctx.db.get(product.sellerId);
    if (seller) {
      await ctx.db.insert("notifications", {
        userId: seller.userId,
        type: args.status === "ACTIVE" ? "PRODUCT_APPROVED" : "PRODUCT_REJECTED",
        title: `Product ${args.status === "ACTIVE" ? "approved" : "rejected"}`,
        body: args.reason ?? "",
        link: "/seller?tab=products",
        read: false,
      });
    }

    return args.productId;
  },
});

/** Resolve a payout */
export const resolvePayout = mutation({
  args: {
    payoutId: v.id("payouts"),
    status: v.union(v.literal("PAID"), v.literal("PENDING")),
  },
  handler: async (ctx, args) => {
    await requireEmployee(ctx);

    await ctx.db.patch(args.payoutId, {
      status: args.status,
      paidAt: args.status === "PAID" ? Date.now() : undefined,
    });

    return args.payoutId;
  },
});

/** List all sellers */
export const listAllSellers = query({
  args: {},
  handler: async (ctx) => {
    await requireEmployee(ctx);

    const sellers = await ctx.db.query("sellers").collect();
    const enriched = await Promise.all(
      sellers.map(async (s) => {
        const user = await ctx.db.get(s.userId);
        return { ...s, userName: user?.name ?? "Unknown" };
      }),
    );

    return enriched;
  },
});

/** List all payouts */
export const listAllPayouts = query({
  args: {},
  handler: async (ctx) => {
    await requireEmployee(ctx);

    const payouts = await ctx.db.query("payouts").collect();
    const enriched = await Promise.all(
      payouts.map(async (p) => {
        const seller = await ctx.db.get(p.sellerId);
        return { ...p, sellerName: seller?.storeName ?? "Unknown" };
      }),
    );

    return enriched;
  },
});
