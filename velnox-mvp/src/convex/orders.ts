import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { orderStatusValidator } from "./schema";
import { canSell, getCurrentUser } from "./users";

/**
 * Customer order flow (velshop): a signed-in customer places an order from
 * published products. Stock is deducted immediately; the seller confirms,
 * completes or cancels it in velseller / velcenter.
 */
export const placeOrder = mutation({
  args: {
    items: v.array(
      v.object({
        productId: v.id("products"),
        quantity: v.number(),
      }),
    ),
    customerName: v.string(),
    customerPhone: v.string(),
    customerAddress: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { items, customerName, customerPhone, customerAddress, note }) => {
    const user = await getCurrentUser(ctx);
    if (user === null) throw new Error("Not authenticated");
    if (items.length === 0) throw new Error("กรุณาเลือกสินค้าก่อนสั่งซื้อ");
    if (!customerName.trim() || !customerPhone.trim()) {
      throw new Error("กรุณากรอกชื่อและเบอร์โทร");
    }

    const now = Date.now();
    let total = 0;
    let itemCount = 0;

    // Validate every line, snapshot the details and deduct stock.
    const prepared = [];
    for (const item of items) {
      if (item.quantity <= 0) throw new Error("จำนวนสินค้าไม่ถูกต้อง");
      const product = await ctx.db.get(item.productId);
      if (!product || !product.published) throw new Error("สินค้าบางรายการไม่มีจำหน่ายแล้ว");
      if (product.price === undefined) throw new Error(`สินค้า "${product.name}" ยังไม่มีราคา`);
      if (product.currentStock < item.quantity) {
        throw new Error(`สต็อก "${product.name}" ไม่พอ (เหลือ ${product.currentStock} ${product.unit})`);
      }
      const subtotal = Math.round(product.price * item.quantity * 100) / 100;
      total += subtotal;
      itemCount += item.quantity;
      prepared.push({
        productId: product._id,
        productName: product.name,
        unit: product.unit,
        quantity: item.quantity,
        price: product.price,
        subtotal,
      });
      await ctx.db.patch(product._id, {
        currentStock: Math.max(0, product.currentStock - item.quantity),
        updatedAt: now,
      });
    }

    const orderId = await ctx.db.insert("orders", {
      userId: user._id,
      status: "pending",
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerAddress: customerAddress?.trim() || undefined,
      note: note?.trim() || undefined,
      total: Math.round(total * 100) / 100,
      itemCount,
      createdAt: now,
      updatedAt: now,
    });

    for (const line of prepared) {
      await ctx.db.insert("orderItems", {
        orderId,
        productId: line.productId,
        productName: line.productName,
        unit: line.unit,
        quantity: line.quantity,
        price: line.price,
        subtotal: line.subtotal,
      });
    }

    return orderId;
  },
});

const fetchOrdersWithItems = async (ctx: QueryCtx, orderIds: Id<"orders">[]) => {
  const rows = [];
  for (const id of orderIds) {
    const order = await ctx.db.get(id);
    if (!order) continue;
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();
    rows.push({ order, items });
  }
  return rows;
};

/** Orders placed by the signed-in customer (velshop "ออเดอร์ของฉัน"). */
export const myOrders = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user === null) throw new Error("Not authenticated");
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(50);
    return fetchOrdersWithItems(ctx, orders.map((o) => o._id));
  },
});

/** All customer orders (velseller / velcenter, seller or admin). */
export const allOrders = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user === null || !canSell(user.role)) throw new Error("Seller only");
    const orders = await ctx.db.query("orders").order("desc").take(100);
    return fetchOrdersWithItems(ctx, orders.map((o) => o._id));
  },
});

/** Update the fulfillment status of an order (seller/admin). */
export const updateStatus = mutation({
  args: {
    orderId: v.id("orders"),
    status: orderStatusValidator,
  },
  handler: async (ctx, { orderId, status }) => {
    const user = await getCurrentUser(ctx);
    if (user === null || !canSell(user.role)) throw new Error("Seller only");
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Order not found");

    // Restock when an order that already deducted stock gets cancelled.
    if (status === "cancelled" && order.status !== "cancelled") {
      const items = await ctx.db
        .query("orderItems")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();
      for (const item of items) {
        const product = await ctx.db.get(item.productId);
        if (product) {
          await ctx.db.patch(product._id, {
            currentStock: Math.max(0, product.currentStock + item.quantity),
            updatedAt: Date.now(),
          });
        }
      }
    }

    await ctx.db.patch(orderId, { status, updatedAt: Date.now() });
  },
});
