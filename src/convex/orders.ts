import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  COMMISSION_RATE,
  CURRENCY,
  FLAT_SHIPPING_MINOR,
  FREE_SHIPPING_THRESHOLD_MINOR,
  audit,
  availableStock,
  deriveOrderStatus,
  generateOrderNumber,
  requireUser,
} from "./lib";

const shippingAddressValidator = v.object({
  name: v.string(),
  phone: v.string(),
  line1: v.string(),
  province: v.string(),
  postalCode: v.string(),
});

type Line = {
  productId: Id<"products">;
  variantId?: Id<"variants">;
  quantity: number;
  unitPrice: number;
  productName: string;
  variantName?: string;
  image?: string;
  sellerId: Id<"sellers">;
  sellerUserId: Id<"users">;
};

// ---------------------------------------------------------------------------
// Checkout — every financial number is computed here, server-side only.
// ---------------------------------------------------------------------------

export const createOrder = mutation({
  args: {
    sessionId: v.optional(v.string()),
    idempotencyKey: v.string(),
    shippingAddress: shippingAddressValidator,
    notes: v.optional(v.string()),
    paymentMethod: v.union(v.literal("cod"), v.literal("card")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Idempotency: a retried submission returns the original order.
    const existingOrders = await ctx.db.query("orders").collect();
    const duplicate = existingOrders.find(
      (order) => order.idempotencyKey === args.idempotencyKey,
    );
    if (duplicate) {
      return { orderId: duplicate._id, orderNumber: duplicate.orderNumber };
    }

    const cartItems = await ctx.db
      .query("cartItems")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    if (cartItems.length === 0) {
      throw new Error("Your cart is empty.");
    }

    // Validate stock and snapshot pricing before writing anything.
    const lines: Line[] = [];
    for (const item of cartItems) {
      const product = await ctx.db.get(item.productId);
      if (!product || product.status !== "ACTIVE") {
        throw new Error("An item in your cart is no longer available.");
      }
      const variant = item.variantId
        ? await ctx.db.get(item.variantId)
        : undefined;
      if (item.variantId && !variant) {
        throw new Error("A variant in your cart is no longer available.");
      }
      const stockDoc = variant ?? product;
      const available = availableStock(stockDoc);
      if (item.quantity > available) {
        throw new Error(`Only ${available} of "${product.name}" left in stock.`);
      }
      const seller = await ctx.db.get(product.sellerId);
      if (!seller) throw new Error("Seller for a cart item no longer exists.");
      lines.push({
        productId: product._id,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: variant?.price ?? product.price,
        productName: product.name,
        variantName: variant?.name,
        image: product.images[0],
        sellerId: product.sellerId,
        sellerUserId: seller.userId,
      });
    }

    const itemsSubtotal = lines.reduce(
      (sum, line) => sum + line.unitPrice * line.quantity,
      0,
    );
    const commissionTotal = Math.round(itemsSubtotal * COMMISSION_RATE);
    const shippingFee =
      itemsSubtotal >= FREE_SHIPPING_THRESHOLD_MINOR ? 0 : FLAT_SHIPPING_MINOR;
    const total = itemsSubtotal + shippingFee;

    const orderNumber = generateOrderNumber();
    const orderId = await ctx.db.insert("orders", {
      userId: user._id,
      orderNumber,
      status: "PENDING",
      currency: CURRENCY,
      itemsSubtotal,
      shippingFee,
      discount: 0,
      total,
      commissionTotal,
      paymentMethod: args.paymentMethod,
      idempotencyKey: args.idempotencyKey,
      shippingAddress: args.shippingAddress,
      notes: args.notes?.trim() || undefined,
    });

    for (const line of lines) {
      const subtotal = line.unitPrice * line.quantity;
      const commission = Math.round(subtotal * COMMISSION_RATE);
      await ctx.db.insert("orderItems", {
        orderId,
        sellerId: line.sellerId,
        productId: line.productId,
        variantId: line.variantId,
        productName: line.productName,
        variantName: line.variantName,
        image: line.image,
        unitPrice: line.unitPrice,
        quantity: line.quantity,
        subtotal,
        commission,
        sellerNet: subtotal - commission,
        status: "PENDING",
      });

      // Reserve stock: move from stock into reserved.
      if (line.variantId) {
        const variant = await ctx.db.get(line.variantId);
        if (variant) {
          await ctx.db.patch(line.variantId, {
            stock: variant.stock - line.quantity,
            reserved: variant.reserved + line.quantity,
          });
        }
      } else {
        const product = await ctx.db.get(line.productId);
        if (product) {
          await ctx.db.patch(line.productId, {
            stock: product.stock - line.quantity,
            reserved: product.reserved + line.quantity,
          });
        }
      }

      await ctx.db.insert("notifications", {
        userId: line.sellerUserId,
        type: "order",
        title: `New order ${orderNumber}`,
        body: `${line.productName} × ${line.quantity} — ฿${(subtotal / 100).toLocaleString()}`,
        link: "/seller",
        read: false,
      });
    }

    for (const item of cartItems) {
      await ctx.db.delete(item._id);
    }

    await audit(ctx, {
      actorId: user._id,
      action: "order.created",
      targetType: "orders",
      targetId: orderId,
      metadata: { orderNumber, total, items: lines.length },
    });

    return { orderId, orderNumber, total };
  },
});

export const cancelOrder = mutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    const user = await requireUser(ctx);
    const order = await ctx.db.get(orderId);
    if (!order || order.userId !== user._id) {
      throw new Error("Order not found.");
    }
    if (order.status !== "PENDING") {
      throw new Error("Only pending orders can be cancelled.");
    }
    await ctx.db.patch(orderId, { status: "CANCELLED", cancelledAt: Date.now() });
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", orderId))
      .collect();
    for (const item of items) {
      await ctx.db.patch(item._id, { status: "CANCELLED" });
      // Release the reservation back into sellable stock.
      if (item.variantId) {
        const variant = await ctx.db.get(item.variantId);
        if (variant) {
          await ctx.db.patch(item.variantId, {
            stock: variant.stock + item.quantity,
            reserved: Math.max(0, variant.reserved - item.quantity),
          });
        }
      } else {
        const product = await ctx.db.get(item.productId);
        if (product) {
          await ctx.db.patch(item.productId, {
            stock: product.stock + item.quantity,
            reserved: Math.max(0, product.reserved - item.quantity),
          });
        }
      }
      const seller = await ctx.db.get(item.sellerId);
      if (seller) {
        await ctx.db.insert("notifications", {
          userId: seller.userId,
          type: "order",
          title: `Order ${order.orderNumber} cancelled`,
          body: `${item.productName} × ${item.quantity} was cancelled by the customer.`,
          link: "/seller",
          read: false,
        });
      }
    }
    await audit(ctx, {
      actorId: user._id,
      action: "order.cancelled",
      targetType: "orders",
      targetId: orderId,
    });
  },
});

// ---------------------------------------------------------------------------
// Order read models
// ---------------------------------------------------------------------------

export const myOrders = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const result: { order: Doc<"orders">; items: Doc<"orderItems">[] }[] = [];
    for (const order of [...orders].reverse()) {
      const items = await ctx.db
        .query("orderItems")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();
      result.push({ order, items });
    }
    return result;
  },
});

export const getOrder = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    const user = await requireUser(ctx);
    const order = await ctx.db.get(orderId);
    if (!order) return null;
    const employee = await ctx.db
      .query("employees")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    const seller = await ctx.db
      .query("sellers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", orderId))
      .collect();
    const allowed =
      order.userId === user._id ||
      !!employee ||
      (!!seller && items.some((item) => item.sellerId === seller._id));
    if (!allowed) return null;
    return { order, items };
  },
});

// ---------------------------------------------------------------------------
// Seller order fulfillment
// ---------------------------------------------------------------------------

export const sellerOrders = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const seller = await ctx.db
      .query("sellers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!seller) return [];
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_seller", (q) => q.eq("sellerId", seller._id))
      .collect();
    const result = [];
    for (const item of [...items].reverse()) {
      const order = await ctx.db.get(item.orderId);
      if (!order) continue;
      const customer = await ctx.db.get(order.userId);
      result.push({
        item,
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
          createdAt: order._creationTime,
          paymentMethod: order.paymentMethod,
          customerName: customer?.name ?? customer?.email ?? "Guest",
        },
      });
    }
    return result;
  },
});

const ITEM_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
  REFUNDED: [],
};

export const updateOrderItemStatus = mutation({
  args: {
    orderItemId: v.id("orderItems"),
    status: v.union(
      v.literal("CONFIRMED"),
      v.literal("PROCESSING"),
      v.literal("SHIPPED"),
      v.literal("DELIVERED"),
      v.literal("CANCELLED"),
    ),
  },
  handler: async (ctx, { orderItemId, status }) => {
    const user = await requireUser(ctx);
    const seller = await ctx.db
      .query("sellers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    const item = await ctx.db.get(orderItemId);
    if (!item || item.sellerId !== seller?._id) {
      throw new Error("Order item not found.");
    }
    const allowed = ITEM_TRANSITIONS[item.status] ?? [];
    if (!allowed.includes(status)) {
      throw new Error(`Cannot move an item from ${item.status} to ${status}.`);
    }

    await ctx.db.patch(item._id, { status });

    // Stock bookkeeping on fulfillment / cancellation.
    if (status === "DELIVERED") {
      if (item.variantId) {
        const variant = await ctx.db.get(item.variantId);
        if (variant) {
          await ctx.db.patch(item.variantId, {
            reserved: Math.max(0, variant.reserved - item.quantity),
          });
        }
      } else {
        const product = await ctx.db.get(item.productId);
        if (product) {
          await ctx.db.patch(item.productId, {
            reserved: Math.max(0, product.reserved - item.quantity),
            totalSold: product.totalSold + item.quantity,
          });
        }
      }
    }
    if (status === "CANCELLED") {
      if (item.variantId) {
        const variant = await ctx.db.get(item.variantId);
        if (variant) {
          await ctx.db.patch(item.variantId, {
            stock: variant.stock + item.quantity,
            reserved: Math.max(0, variant.reserved - item.quantity),
          });
        }
      } else {
        const product = await ctx.db.get(item.productId);
        if (product) {
          await ctx.db.patch(item.productId, {
            stock: product.stock + item.quantity,
            reserved: Math.max(0, product.reserved - item.quantity),
          });
        }
      }
    }

    // Recompute the order-level status.
    const order = await ctx.db.get(item.orderId);
    if (order) {
      const orderItems = await ctx.db
        .query("orderItems")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();
      const nextStatus = deriveOrderStatus(orderItems) as Doc<"orders">["status"];
      await ctx.db.patch(order._id, {
        status: nextStatus,
        deliveredAt:
          nextStatus === "DELIVERED" ? Date.now() : order.deliveredAt,
      });
      await ctx.db.insert("notifications", {
        userId: order.userId,
        type: "order",
        title: `Order ${order.orderNumber} is now ${nextStatus.toLowerCase()}`,
        body: item.productName,
        link: "/shop/orders",
        read: false,
      });
    }

    await audit(ctx, {
      actorId: user._id,
      action: `order_item.${status.toLowerCase()}`,
      targetType: "orderItems",
      targetId: orderItemId,
    });
  },
});
