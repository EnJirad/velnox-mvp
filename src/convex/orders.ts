// ---------------------------------------------------------------------------
// Orders — checkout, order management, fulfillment
// ---------------------------------------------------------------------------

import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  computeCommission,
  computeShipping,
  generateOrderNumber,
  idempotencyKey,
  deriveOrderStatus,
} from "./lib";

/** Checkout — create order from cart */
export const checkout = mutation({
  args: {
    addressId: v.id("addresses"),
    paymentMethod: v.string(),
    notes: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Idempotency check
    if (args.idempotencyKey) {
      const existing = await ctx.db
        .query("orders")
        .filter((q) =>
          q.eq(q.field("idempotencyKey"), args.idempotencyKey),
        )
        .first();
      if (existing) return existing._id;
    }

    // Get cart items
    const cartItems = await ctx.db
      .query("cartItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (cartItems.length === 0) throw new Error("Cart is empty");

    // Get address
    const address = await ctx.db.get(args.addressId);
    if (!address || address.userId !== userId)
      throw new Error("Invalid address");

    // Compute totals server-side
    let itemsSubtotal = 0;
    const orderItemData: Array<{
      sellerId: string;
      productId: string;
      variantId?: string;
      productName: string;
      variantName?: string;
      image?: string;
      unitPrice: number;
      quantity: number;
      subtotal: number;
      commission: number;
      sellerNet: number;
      status: string;
    }> = [];

    for (const ci of cartItems) {
      const product = await ctx.db.get(ci.productId);
      if (!product) continue;

      // Verify stock
      if (product.stock - product.reserved < ci.quantity) {
        throw new Error(`Insufficient stock for ${product.name}`);
      }

      const variant = ci.variantId
        ? await ctx.db.get(ci.variantId)
        : null;

      const unitPrice = variant?.price ?? product.price;
      const subtotal = unitPrice * ci.quantity;
      const commission = computeCommission(subtotal);
      const sellerNet = subtotal - commission;

      itemsSubtotal += subtotal;

      orderItemData.push({
        sellerId: product.sellerId,
        productId: product._id,
        variantId: ci.variantId,
        productName: product.name,
        variantName: variant?.name,
        image: product.images[0],
        unitPrice,
        quantity: ci.quantity,
        subtotal,
        commission,
        sellerNet,
        status: "PENDING",
      });
    }

    const shippingFee = computeShipping(itemsSubtotal);
    const total = itemsSubtotal + shippingFee;
    const commissionTotal = orderItemData.reduce(
      (sum, i) => sum + i.commission,
      0,
    );

    // Create order
    const orderId = await ctx.db.insert("orders", {
      userId,
      orderNumber: generateOrderNumber(),
      status: "PENDING",
      currency: "THB",
      itemsSubtotal,
      shippingFee,
      discount: 0,
      total,
      commissionTotal,
      paymentMethod: args.paymentMethod,
      idempotencyKey: args.idempotencyKey ?? idempotencyKey(userId),
      shippingAddress: {
        name: address.name,
        phone: address.phone,
        line1: address.line1,
        province: address.province,
        postalCode: address.postalCode,
      },
      notes: args.notes,
      paidAt: args.paymentMethod === "cod" ? undefined : Date.now(),
    });

    // Create order items and reserve stock
    for (const item of orderItemData) {
      await ctx.db.insert("orderItems", {
        orderId,
        sellerId: item.sellerId as any,
        productId: item.productId as any,
        variantId: item.variantId as any,
        productName: item.productName,
        variantName: item.variantName,
        image: item.image,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        subtotal: item.subtotal,
        commission: item.commission,
        sellerNet: item.sellerNet,
        status: "PENDING",
      });

      // Reserve stock
      const product = await ctx.db.get(item.productId as any);
      if (product) {
        await ctx.db.patch(product._id, {
          reserved: product.reserved + item.quantity,
        });
      }
    }

    // Clear cart
    for (const ci of cartItems) {
      await ctx.db.delete(ci._id);
    }

    // Notify sellers
    const sellerIds = [...new Set(orderItemData.map((i) => i.sellerId))];
    for (const sid of sellerIds) {
      const seller = await ctx.db.get(sid as any);
      if (seller) {
        await ctx.db.insert("notifications", {
          userId: seller.userId,
          type: "NEW_ORDER",
          title: "New order received",
          body: `Order with ${orderItemData.filter((i) => i.sellerId === sid).length} item(s)`,
          link: `/seller?tab=orders`,
          read: false,
        });
      }
    }

    return orderId;
  },
});

/** List orders for current user */
export const listByUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    orders.sort((a, b) => b.paidAt ?? b.deliveredAt ?? 0 - (a.paidAt ?? a.deliveredAt ?? 0));

    const enriched = await Promise.all(
      orders.map(async (order) => {
        const items = await ctx.db
          .query("orderItems")
          .withIndex("by_order", (q) => q.eq("orderId", order._id))
          .collect();
        return { ...order, items };
      }),
    );

    return enriched;
  },
});

/** Get a single order by ID (owner only) */
export const get = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const order = await ctx.db.get(args.orderId);
    if (!order || order.userId !== userId) return null;

    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();

    return { ...order, items };
  },
});

/** Cancel an order (customer — only PENDING or CONFIRMED) */
export const cancel = mutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const order = await ctx.db.get(args.orderId);
    if (!order || order.userId !== userId)
      throw new Error("Unauthorized");
    if (order.status !== "PENDING" && order.status !== "CONFIRMED") {
      throw new Error("Order cannot be cancelled at this stage");
    }

    // Release stock
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();

    for (const item of items) {
      const product = await ctx.db.get(item.productId);
      if (product) {
        await ctx.db.patch(product._id, {
          reserved: Math.max(0, product.reserved - item.quantity),
        });
      }
      await ctx.db.patch(item._id, { status: "CANCELLED" });
    }

    await ctx.db.patch(args.orderId, {
      status: "CANCELLED",
      cancelledAt: Date.now(),
    });
  },
});

/** List all orders (for VelCenter) */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const orders = await ctx.db.query("orders").collect();
    orders.sort((a, b) => (b.paidAt ?? 0) - (a.paidAt ?? 0));

    const enriched = await Promise.all(
      orders.map(async (order) => {
        const user = await ctx.db.get(order.userId);
        const items = await ctx.db
          .query("orderItems")
          .withIndex("by_order", (q) => q.eq("orderId", order._id))
          .collect();
        return { ...order, customerName: user?.name ?? "Unknown", items };
      }),
    );

    return enriched;
  },
});

/** Seller fulfill order item (confirm → process → ship → deliver) */
export const updateItemStatus = mutation({
  args: {
    orderItemId: v.id("orderItems"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const { getAuthUserId } = await import("@convex-dev/auth/server");
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const item = await ctx.db.get(args.orderItemId);
    if (!item) throw new Error("Order item not found");

    const seller = await ctx.db.get(item.sellerId);
    if (!seller || seller.userId !== userId)
      throw new Error("Unauthorized");

    await ctx.db.patch(args.orderItemId, { status: args.status as any });

    // Update order-level status
    const allItems = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", item.orderId))
      .collect();

    const statuses = allItems.map((i) =>
      i._id === args.orderItemId ? args.status : i.status,
    );
    const orderStatus = deriveOrderStatus(statuses);

    await ctx.db.patch(item.orderId, { status: orderStatus as any });

    // On deliver: release reserved, increment sold
    if (args.status === "DELIVERED") {
      const product = await ctx.db.get(item.productId);
      if (product) {
        await ctx.db.patch(product._id, {
          reserved: Math.max(0, product.reserved - item.quantity),
          totalSold: product.totalSold + item.quantity,
        });
      }
    }

    // On cancel: release reserved
    if (args.status === "CANCELLED") {
      const product = await ctx.db.get(item.productId);
      if (product) {
        await ctx.db.patch(product._id, {
          reserved: Math.max(0, product.reserved - item.quantity),
        });
      }
    }

    return args.orderItemId;
  },
});
