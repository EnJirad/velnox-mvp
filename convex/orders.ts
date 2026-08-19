/**
 * @deprecated LEGACY Convex-table order module (V3 migration).
 *
 * Orders are authoritative in Neon (`backend/orders.ts`, `backend/checkout.ts`).
 * No frontend references this module (verified 2026-08-16) — the storefront
 * reads orders via `convex/customer.ts` / `convex/commerce.ts` node actions
 * (`myOrders`, `orderDetail`, `sellerOrders`). Kept only because removing the
 * table rows from schema.ts would require a Convex data migration; safe to
 * delete after `convex/_generated` is regenerated without these functions.
 */
import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { orderStatusValidator } from "./schema";
import { canAdmin, canSell, getCurrentUser } from "./users";

/**
 * NOTE: order creation lives in the Commerce Core only (customer.ts
 * checkoutAction → src/backend/checkout.ts → Neon). The legacy Convex-table
 * placeOrder flow was removed (Phase 11) because it bypassed the Neon ledger,
 * commissions, idempotency and audit trail.
 */

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

/**
 * Customer Memory (velshop "Velnox จำคุณได้"): the products this customer
 * orders regularly, learned from their own order history. Returns the
 * still-published items, ranked by how often the customer orders them, with
 * the last order date so the shop can remind them when it's time again.
 * Returns [] for signed-out visitors instead of throwing, so the storefront
 * can safely subscribe to this query for everyone.
 */
export const customerRegulars = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user === null) return [];

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(100);

    const active = orders.filter((o) => o.status !== "cancelled");
    const byProduct = new Map<
      Id<"products">,
      { times: number; qty: number; lastOrderedAt: number }
    >();

    for (const order of active) {
      const items = await ctx.db
        .query("orderItems")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();
      for (const item of items) {
        const agg = byProduct.get(item.productId) ?? {
          times: 0,
          qty: 0,
          lastOrderedAt: 0,
        };
        agg.times += 1;
        agg.qty += item.quantity;
        agg.lastOrderedAt = Math.max(agg.lastOrderedAt, order.createdAt);
        byProduct.set(item.productId, agg);
      }
    }

    const rows: {
      product: Doc<"products">;
      times: number;
      qty: number;
      lastOrderedAt: number;
    }[] = [];

    for (const [productId, agg] of byProduct) {
      const product = await ctx.db.get(productId);
      if (!product || !product.published || product.price === undefined) continue;
      rows.push({ product, ...agg });
    }

    rows.sort(
      (a, b) => b.times - a.times || b.lastOrderedAt - a.lastOrderedAt,
    );
    return rows.slice(0, 8);
  },
});

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

/**
 * Customer orders (velseller / velcenter).
 * - Merchants (seller) only see orders containing THEIR products, and only
 *   their own line items — each merchant manages their own shop's backend.
 * - Company (admin/owner) sees every order across the marketplace.
 */
export const allOrders = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user === null || !(canSell(user.role) || user.role === "staff")) {
      throw new Error("Seller only");
    }
    const orders = await ctx.db.query("orders").order("desc").take(100);

    if (canAdmin(user.role) || user.role === "staff") {
      return fetchOrdersWithItems(ctx, orders.map((o) => o._id));
    }

    const myProducts = await ctx.db
      .query("products")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const myIds = new Set(myProducts.map((p) => p._id));

    const rows: { order: Doc<"orders">; items: Doc<"orderItems">[] }[] = [];
    for (const order of orders) {
      const items = await ctx.db
        .query("orderItems")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();
      const mine = items.filter((i) => myIds.has(i.productId));
      if (mine.length === 0) continue;
      rows.push({ order, items: mine });
    }
    return rows;
  },
});

const SELLER_COMMISSION_RATE = 0.03; // Velnox charges 3% per item sold
const RETURN_COVERAGE_RATE = 0.1; // returns covered up to 10% of sales

/**
 * Merchant income report (velseller "รายได้"): gross sales, returned value,
 * the 3% commission, and the payout estimate under Velnox's return policy
 * (returns beyond 10% of sales are the merchant's responsibility).
 */
export const sellerIncome = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user === null || !canSell(user.role)) throw new Error("Seller only");

    const myProducts = await ctx.db
      .query("products")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const myIds = new Set(myProducts.map((p) => p._id));
    const orders = await ctx.db.query("orders").order("desc").take(200);

    let gross = 0;
    let grossCount = 0;
    let returns = 0;
    let returnCount = 0;
    const transactions: {
      order: Doc<"orders">;
      items: Doc<"orderItems">[];
      subtotal: number;
      pending: boolean;
    }[] = [];

    for (const order of orders) {
      const items = await ctx.db
        .query("orderItems")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();
      const mine = items.filter((i) => myIds.has(i.productId));
      if (mine.length === 0) continue;
      const subtotal = Math.round(mine.reduce((s, i) => s + i.subtotal, 0) * 100) / 100;
      const qty = mine.reduce((s, i) => s + i.quantity, 0);

      if (order.status === "cancelled") {
        returns += subtotal;
        returnCount += qty;
      } else if (order.status === "completed") {
        gross += subtotal;
        grossCount += qty;
        transactions.push({ order, items: mine, subtotal, pending: false });
      } else {
        transactions.push({ order, items: mine, subtotal, pending: true });
      }
    }

    gross = Math.round(gross * 100) / 100;
    returns = Math.round(returns * 100) / 100;
    const commission = Math.round(gross * SELLER_COMMISSION_RATE * 100) / 100;
    const totalOrdered = gross + returns;
    const returnRate = totalOrdered > 0 ? returns / totalOrdered : 0;
    const returnCoverage = Math.min(returns, gross * RETURN_COVERAGE_RATE);
    const payout =
      Math.round((gross - commission - (returns - returnCoverage)) * 100) / 100;

    transactions.sort((a, b) => b.order.createdAt - a.order.createdAt);

    return {
      gross,
      grossCount,
      returns,
      returnCount,
      commission,
      commissionRate: SELLER_COMMISSION_RATE,
      returnRate,
      returnCoverage,
      payout,
      transactions: transactions.slice(0, 20),
    };
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
