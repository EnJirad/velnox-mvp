/**
 * Velnox Backend — Customer API (velshop) — Convex node actions.
 *
 * Every write is authenticated + ownership-checked (src/backend/identity.ts)
 * and runs the Commerce Core services in src/backend/*. Neon stays the source
 * of truth; Convex records business events for the intelligence layer.
 */
"use node";

import { action } from "./_generated/server";
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
import { listShipmentsForOrder } from "../backend/shipments";
import { listReturnsForCustomer, requestReturn } from "../backend/returns";

async function recordEvent(ctx: import("./_generated/server").ActionCtx, type: string, entityId: string, payload: Record<string, unknown> = {}) {
  try {
    await ctx.runMutation(api.intelligence.recordBusinessEvent, { type, entityId, payload });
  } catch (err) {
    console.error(`[customer] event ${type} failed:`, err);
  }
}

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
    shippingFee: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireIdentity(ctx);
    const result = await checkout({
      userId: user.id,
      addressId: args.addressId,
      paymentMethod: (args.paymentMethod ?? "cod") as "cod" | "transfer" | "card" | "promptpay" | "wallet",
      shippingFee: args.shippingFee ?? 0,
      note: args.note ?? null,
    });
    await recordEvent(ctx, "OrderCreated", result.parentOrderId, {
      orderNumber: result.parentOrderNumber,
      total: result.total,
      orderCount: result.orders.length,
    });
    for (const o of result.orders) {
      await recordEvent(ctx, "OrderCreated", o.orderId, { orderNumber: o.orderNumber, total: o.total, sellerId: o.sellerId });
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
    const order = await getOrder(getDb(), args.orderId);
    if (!order || order.customerUserId !== user.id) throw new Error("ออเดอร์นี้ไม่ใช่ของคุณ");
    const shipments = await listShipmentsForOrder(getDb(), order.id);
    return { ...order, shipments };
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
    const ret = await requestReturn(getDb(), {
      customerUserId: user.id,
      orderId: args.orderId,
      items: args.items,
      reason: args.reason,
      description: args.description ?? null,
      evidenceUrls: args.evidenceUrls ?? [],
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
    const { user } = await requireIdentity(ctx);
    return toggleWishlist(getDb(), user.id, args.productId);
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
