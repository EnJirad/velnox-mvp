/**
 * Velnox Backend — Customer API (velshop) — Convex node actions.
 *
 * Every write is authenticated + ownership-checked (src/backend/identity.ts)
 * and runs the Commerce Core services in src/backend/*. Neon stays the source
 * of truth; Convex records business events for the intelligence layer.
 */
"use node";

import { action } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { getDb } from "../backend/db";
import { requireIdentity } from "../backend/identity";
import {
  createAddress,
  deleteAddress,
  listAddresses,
  updateAddress,
} from "../backend/addresses";
import {
  addToCart,
  getActiveCart,
  removeCartItem,
  updateCartItemQuantity,
} from "../backend/carts";
import { checkout } from "../backend/checkout";
import { listWishlist, toggleWishlist } from "../backend/wishlists";
import { createReview, listReviewsByProduct } from "../backend/reviews";
import { listNotifications, markAllRead, markNotificationRead, unreadCount } from "../backend/notifications";
import { categoryTree, listCategories } from "../backend/categories";
import { listOrdersForCustomer, getOrder } from "../backend/orders";
import { getPaymentsForOrder } from "../backend/payments";
import { getShipment, listShipmentsForOrder } from "../backend/shipments";
import { listReturnsForCustomer, requestReturn } from "../backend/returns";
import { categoryStats, listProducts } from "../backend/products";
import { listReviewsByShop } from "../backend/reviews";
import { audit } from "../backend/audit";
import { AppError } from "../backend/errors";
import { enforceRateLimit } from "./rateLimit";
import type { Shop } from "../backend/types";

/* eslint-disable @typescript-eslint/no-explicit-any -- DB row mappers */
function mapShop(r: Record<string, any>): Shop & { productCount: number; orderCount: number; rating: number | null; reviewCount: number } {
  return {
    id: r.id,
    sellerId: r.seller_id,
    name: r.name,
    slug: r.slug ?? null,
    description: r.description ?? null,
    imageUrl: r.image_url ?? null,
    phone: r.phone ?? null,
    address: r.address ?? null,
    announcement: r.announcement ?? null,
    status: r.status,
    commissionRate: Number(r.commission_rate),
    currency: r.currency,
    latitude: r.latitude != null ? Number(r.latitude) : null,
    longitude: r.longitude != null ? Number(r.longitude) : null,
    createdAt: r.created_at,
    productCount: Number(r.product_count ?? 0),
    orderCount: Number(r.order_count ?? 0),
    rating: r.rating != null ? Number(r.rating) : null,
    reviewCount: Number(r.review_count ?? 0),
  };
}

async function recordEvent(ctx: import("./_generated/server").ActionCtx, type: string, entityId: string, payload: Record<string, unknown> = {}) {
  try {
    await ctx.runMutation(api.intelligence.recordBusinessEvent, { type, entityId, payload });
  } catch (err) {
    console.error(`[customer] event ${type} failed:`, err);
  }
}

/** CPNS: record a per-customer behavioral event bound to the Convex user id. */
async function recordCustomerEvent(
  ctx: import("./_generated/server").ActionCtx,
  convexUserId: string,
  type: string,
  entityId?: string,
  value?: string,
  context?: Record<string, unknown>,
) {
  try {
    await ctx.runMutation(api.memoryEvents.trackForUser, {
      userId: convexUserId as Id<"users">,
      type,
      entityId,
      value,
      context,
    });
  } catch (err) {
    console.error(`[customer] customer event ${type} failed:`, err);
  }
}

// ---------------------------------------------------------------------------
// shops (public storefront)
// ---------------------------------------------------------------------------
export const publicShops = action({
  args: {},
  handler: async () => {
    const rows = await getDb()(
      `SELECT s.*,
              (SELECT COUNT(*)::int FROM products p
                WHERE p.shop_id = s.id AND p.status = 'published') AS product_count,
              (SELECT COUNT(*)::int FROM order_items oi
                WHERE oi.shop_id = s.id) AS order_count,
              (SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews r
                WHERE r.shop_id = s.id AND r.status = 'published') AS rating,
              (SELECT COUNT(*)::int FROM reviews r
                WHERE r.shop_id = s.id AND r.status = 'published') AS review_count
       FROM shops s
       WHERE s.status = 'active'
       ORDER BY s.created_at DESC`,
    );
    return rows.map(mapShop);
  },
});

/** Shop profile page: shop + published products + rating summary. */
export const shopDetail = action({
  args: { shopId: v.string() },
  handler: async (_ctx, args) => {
    const db = getDb();
    const rows = await db(
      `SELECT s.*,
              (SELECT COUNT(*)::int FROM products p
                WHERE p.shop_id = s.id AND p.status = 'published') AS product_count,
              (SELECT COUNT(*)::int FROM order_items oi
                WHERE oi.shop_id = s.id) AS order_count,
              (SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews r
                WHERE r.shop_id = s.id AND r.status = 'published') AS rating,
              (SELECT COUNT(*)::int FROM reviews r
                WHERE r.shop_id = s.id AND r.status = 'published') AS review_count
       FROM shops s
       WHERE s.id = $1 AND s.status = 'active'
       LIMIT 1`,
      [args.shopId],
    );
    if (!rows[0]) throw new AppError("SHOP_NOT_FOUND", "ร้านค้าไม่พบ");
    const products = await listProducts(db, { shopId: args.shopId, status: "published", limit: 100 });
    return { shop: mapShop(rows[0]), products };
  },
});

// ---------------------------------------------------------------------------
// categories (public)
// ---------------------------------------------------------------------------
export const categories = action({
  args: {},
  handler: async () => listCategories(getDb()),
});

export const categoryTreeAction = action({
  args: {},
  handler: async () => categoryTree(getDb()),
});

/** Category tree + real product counts (products linked via category_id). */
export const categoryStatsAction = action({
  args: {},
  handler: async () => categoryStats(getDb()),
});

// ---------------------------------------------------------------------------
// addresses (+GPS)
// ---------------------------------------------------------------------------
export const myAddresses = action({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireIdentity(ctx);
    return listAddresses(getDb(), user.id);
  },
});

export const saveAddress = action({
  args: {
    addressId: v.optional(v.string()),
    label: v.optional(v.string()),
    recipientName: v.string(),
    phone: v.string(),
    line1: v.string(),
    line2: v.optional(v.string()),
    subdistrict: v.optional(v.string()),
    district: v.optional(v.string()),
    province: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    country: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    placeId: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireIdentity(ctx);
    const db = getDb();
    const input = {
      label: args.label ?? "บ้าน",
      recipientName: args.recipientName,
      phone: args.phone,
      line1: args.line1,
      line2: args.line2 ?? null,
      subdistrict: args.subdistrict ?? null,
      district: args.district ?? null,
      province: args.province ?? null,
      postalCode: args.postalCode ?? null,
      country: args.country ?? "TH",
      latitude: args.latitude ?? null,
      longitude: args.longitude ?? null,
      placeId: args.placeId ?? null,
      isDefault: args.isDefault ?? false,
    };
    if (args.addressId) {
      return updateAddress(db, user.id, args.addressId, input);
    }
    return createAddress(db, user.id, input);
  },
});

export const deleteAddressAction = action({
  args: { addressId: v.string() },
  handler: async (ctx, args) => {
    const { user } = await requireIdentity(ctx);
    await deleteAddress(getDb(), user.id, args.addressId);
    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// cart
// ---------------------------------------------------------------------------
export const myCart = action({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireIdentity(ctx);
    return getActiveCart(getDb(), user.id);
  },
});

export const addToCartAction = action({
  args: { productId: v.string(), quantity: v.number(), variantId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { user } = await requireIdentity(ctx);
    return addToCart(getDb(), user.id, { productId: args.productId, quantity: args.quantity, variantId: args.variantId ?? null });
  },
});

export const updateCartItemAction = action({
  args: { cartItemId: v.string(), quantity: v.number() },
  handler: async (ctx, args) => {
    const { user } = await requireIdentity(ctx);
    return updateCartItemQuantity(getDb(), user.id, args.cartItemId, args.quantity);
  },
});

export const removeCartItemAction = action({
  args: { cartItemId: v.string() },
  handler: async (ctx, args) => {
    const { user } = await requireIdentity(ctx);
    return removeCartItem(getDb(), user.id, args.cartItemId);
  },
});

// ---------------------------------------------------------------------------
// checkout (multi-shop, atomic — spec §39–42)
// ---------------------------------------------------------------------------
export const checkoutAction = action({
  args: {
    addressId: v.string(),
    paymentMethod: v.optional(v.string()),
    shippingMethod: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user, subject } = await requireIdentity(ctx);
    await enforceRateLimit(ctx, { name: "checkout", key: user.id, max: 10, windowMs: 60_000 });
    // Only the shipping METHOD is accepted from the client — the fee itself is
    // quoted server-side by the checkout service (never trust client money).
    const result = await checkout({
      userId: user.id,
      addressId: args.addressId,
      paymentMethod: (args.paymentMethod ?? "cod") as "cod" | "transfer" | "card" | "promptpay" | "wallet",
      shippingMethod: args.shippingMethod ?? "standard",
      note: args.note ?? null,
    });
    await audit(getDb(), {
      actorId: user.id,
      actorRole: user.role,
      action: "CUSTOMER_CREATED_ORDER",
      entityType: "order",
      entityId: result.parentOrderId,
      after: { orderNumber: result.parentOrderNumber, total: result.total, orderCount: result.orders.length },
    });
    await recordEvent(ctx, "OrderCreated", result.parentOrderId, {
      orderNumber: result.parentOrderNumber,
      total: result.total,
      orderCount: result.orders.length,
    });
    for (const o of result.orders) {
      await recordEvent(ctx, "OrderCreated", o.orderId, { orderNumber: o.orderNumber, total: o.total, sellerId: o.sellerId });
    }
    // CPNS: PURCHASE events per product — the strongest Customer Memory signal.
    try {
      const db = getDb();
      for (const o of result.orders) {
        const items = await db(
          "SELECT product_id, quantity, product_name FROM order_items WHERE order_id = $1",
          [o.orderId],
        );
        for (const item of items) {
          await recordCustomerEvent(ctx, subject, "PURCHASE", item.product_id, item.product_name, {
            quantity: item.quantity,
            orderId: o.orderId,
          });
        }
      }
    } catch (err) {
      console.error("[customer] PURCHASE events failed:", err);
    }
    return result;
  },
});

// ---------------------------------------------------------------------------
// orders + tracking + returns (customer-owned only)
// ---------------------------------------------------------------------------
export const myOrders = action({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const { user } = await requireIdentity(ctx);
    return listOrdersForCustomer(getDb(), user.id, args.limit ?? 50);
  },
});

export const orderDetail = action({
  args: { orderId: v.string() },
  handler: async (ctx, args) => {
    const { user } = await requireIdentity(ctx);
    const db = getDb();
    const order = await getOrder(db, args.orderId);
    if (!order || order.customerUserId !== user.id) throw new AppError("ORDER_NOT_FOUND", "ออเดอร์นี้ไม่ใช่ของคุณ");
    const shipmentRows = await listShipmentsForOrder(db, order.id);
    const shipments = [];
    for (const s of shipmentRows) {
      const full = await getShipment(db, s.id);
      if (full) shipments.push(full);
    }
    // Payment rows (method/status) + parent order id so the UI can show an
    // "Pay online" action for pending Stripe payments (Phase 14).
    const orderRow = await db("SELECT parent_order_id FROM orders WHERE id = $1", [args.orderId]);
    const paymentRows = await getPaymentsForOrder(db, args.orderId);
    return {
      ...order,
      parentOrderId: orderRow[0]?.parent_order_id ?? order.id,
      payments: paymentRows.map((p) => ({ id: p.id, method: p.method, status: p.status, amount: p.amount })),
      shipments,
    };
  },
});

export const requestReturnAction = action({
  args: {
    orderId: v.string(),
    items: v.array(v.object({ orderItemId: v.string(), quantity: v.number() })),
    reason: v.string(),
    description: v.optional(v.string()),
    evidenceUrls: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { user } = await requireIdentity(ctx);
    await enforceRateLimit(ctx, { name: "return", key: user.id, max: 10, windowMs: 3_600_000 });
    const ret = await requestReturn(getDb(), {
      customerUserId: user.id,
      orderId: args.orderId,
      items: args.items,
      reason: args.reason,
      description: args.description ?? null,
      evidenceUrls: args.evidenceUrls ?? [],
    });
    await audit(getDb(), {
      actorId: user.id,
      actorRole: user.role,
      action: "CUSTOMER_REQUESTED_RETURN",
      entityType: "return",
      entityId: ret.id,
      after: { orderId: args.orderId, reason: args.reason },
    });
    await recordEvent(ctx, "ReturnRequested", ret.id, { orderId: ret.orderId });
    return ret;
  },
});

export const myReturns = action({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireIdentity(ctx);
    return listReturnsForCustomer(getDb(), user.id);
  },
});

// ---------------------------------------------------------------------------
// wishlist
// ---------------------------------------------------------------------------
export const myWishlist = action({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireIdentity(ctx);
    return listWishlist(getDb(), user.id);
  },
});

export const toggleWishlistAction = action({
  args: { productId: v.string() },
  handler: async (ctx, args) => {
    const { user, subject } = await requireIdentity(ctx);
    const result = await toggleWishlist(getDb(), user.id, args.productId);
    await recordCustomerEvent(
      ctx,
      subject,
      result.added ? "WISHLIST_ADD" : "WISHLIST_REMOVE",
      args.productId,
    );
    return result;
  },
});

// ---------------------------------------------------------------------------
// reviews (verified purchase enforced server-side)
// ---------------------------------------------------------------------------
export const reviewProduct = action({
  args: {
    productId: v.string(),
    orderId: v.string(),
    rating: v.number(),
    title: v.optional(v.string()),
    comment: v.optional(v.string()),
    images: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { user } = await requireIdentity(ctx);
    await enforceRateLimit(ctx, { name: "review", key: user.id, max: 20, windowMs: 3_600_000 });
    return createReview(getDb(), {
      userId: user.id,
      productId: args.productId,
      orderId: args.orderId,
      rating: args.rating,
      title: args.title ?? null,
      comment: args.comment ?? null,
      images: args.images ?? [],
    });
  },
});

export const productReviews = action({
  args: { productId: v.string() },
  handler: async (ctx, args) => listReviewsByProduct(getDb(), args.productId),
});

/** Public shop reviews — aggregate of verified reviews on the shop's products. */
export const shopReviews = action({
  args: { shopId: v.string() },
  handler: async (_ctx, args) => listReviewsByShop(getDb(), args.shopId),
});

/**
 * Buy Again (spec §28): re-add every line of a past order to the cart.
 * Each item is re-validated server-side (product still published + stock),
 * so a price/supply change never silently adds an invalid line.
 */
export const reorderAction = action({
  args: { orderId: v.string() },
  handler: async (ctx, args) => {
    const { user, subject } = await requireIdentity(ctx);
    const db = getDb();
    const order = await db("SELECT id, customer_user_id, status FROM orders WHERE id = $1", [args.orderId]);
    if (!order[0] || order[0].customer_user_id !== user.id) throw new AppError("ORDER_NOT_FOUND", "ออเดอร์นี้ไม่ใช่ของคุณ");
    if (order[0].status === "cancelled") throw new AppError("INVALID_STATUS_TRANSITION", "ไม่สามารถสั่งซื้อซ้ำจากออเดอร์ที่ยกเลิกได้");

    const items = await db(
      "SELECT oi.product_id, oi.quantity, oi.product_name FROM order_items oi WHERE oi.order_id = $1",
      [args.orderId],
    );
    const added: { productId: string; productName: string; quantity: number }[] = [];
    const skipped: { productId: string; productName: string; reason: string }[] = [];
    for (const item of items) {
      try {
        await addToCart(db, user.id, { productId: item.product_id, quantity: item.quantity });
        added.push({ productId: item.product_id, productName: item.product_name, quantity: item.quantity });
        await recordCustomerEvent(ctx, subject, "REORDER", item.product_id, item.product_name, {
          quantity: item.quantity,
          fromOrderId: args.orderId,
        });
      } catch (err) {
        skipped.push({
          productId: item.product_id,
          productName: item.product_name,
          reason: err instanceof Error ? err.message : "สินค้าไม่สามารถสั่งซื้อซ้ำได้",
        });
      }
    }
    return { added, skipped };
  },
});

// ---------------------------------------------------------------------------
// notifications
// ---------------------------------------------------------------------------
export const myNotifications = action({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireIdentity(ctx);
    const db = getDb();
    const [items, unread] = await Promise.all([listNotifications(db, user.id), unreadCount(db, user.id)]);
    return { items, unread };
  },
});

export const markNotificationReadAction = action({
  args: { notificationId: v.string() },
  handler: async (ctx, args) => {
    const { user } = await requireIdentity(ctx);
    await markNotificationRead(getDb(), user.id, args.notificationId);
    return { ok: true };
  },
});

export const markAllNotificationsRead = action({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireIdentity(ctx);
    await markAllRead(getDb(), user.id);
    return { ok: true };
  },
});
