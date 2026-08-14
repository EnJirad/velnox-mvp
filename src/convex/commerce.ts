/**
 * Velnox Backend — Convex node actions bridging the 3 frontends to Neon.
 *
 * Rule of Architecture v3: frontends never touch Neon directly and never
 * decide business numbers. They call these actions ("use node") which run the
 * Commerce Core services in src/backend/*. Convex remains the Intelligence
 * layer (productViews, recommendations, realtime) alongside this bridge.
 *
 * Requires DATABASE_URL in the project Keys/API keys UI.
 * Until then these actions throw a clear error; the app keeps working on the
 * legacy Convex storefront (fallback).
 */
"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { getDb } from "../backend/db";
import {
  findOrCreateUser,
  getMerchantByOwner,
  createMerchant,
  createShop,
  listShopsByMerchant,
} from "../backend/merchants";
import { createProduct, listProducts as listNeonProducts } from "../backend/products";
import { createOrder, cancelOrder, listOrdersForCustomer, listOrdersForMerchant, updateOrderStatus } from "../backend/orders";
import { recordPayment, refundPayment } from "../backend/payments";
import { createSubscription, listSubscriptions, getSubscription, updateSubscriptionStatus } from "../backend/subscriptions";
import type { ActionCtx } from "./_generated/server";

async function requireIdentity(ctx: ActionCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized — please sign in first");
  return identity;
}

async function requireMerchant(ctx: ActionCtx) {
  const identity = await requireIdentity(ctx);
  const db = getDb();
  const user = await findOrCreateUser(db, {
    convexId: identity.subject,
    email: identity.email ?? null,
    name: identity.name ?? null,
  });
  const merchant = await getMerchantByOwner(db, user.id);
  if (!merchant) throw new Error("ไม่พบร้านค้าของคุณ — กรุณาเปิดร้านก่อน");
  return { identity, user, merchant };
}

// ---------------------------------------------------------------------------
// users / merchants / shops
// ---------------------------------------------------------------------------
/** Keep Neon's users table in sync with Convex auth (call after sign-in). */
export const syncUser = action({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const db = getDb();
    const user = await findOrCreateUser(db, {
      convexId: identity.subject,
      email: identity.email ?? null,
      name: identity.name ?? null,
    });
    return user;
  },
});

/** velseller: open a shop (creates merchant + shop if not yet open). */
export const openShop = action({
  args: {
    shopName: v.string(),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    taxId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const db = getDb();
    const user = await findOrCreateUser(db, {
      convexId: identity.subject,
      email: identity.email ?? null,
      name: identity.name ?? null,
      role: "seller",
    });
    const merchant = await createMerchant(db, {
      ownerUserId: user.id,
      name: args.shopName,
      taxId: args.taxId ?? null,
    });
    const existing = await listShopsByMerchant(db, merchant.id);
    const shop = existing[0] ?? (await createShop(db, {
      merchantId: merchant.id,
      name: args.shopName,
      slug: args.slug ?? null,
      description: args.description ?? null,
    }));
    return { user, merchant, shop };
  },
});

export const myShops = action({
  args: {},
  handler: async (ctx) => {
    const { merchant } = await requireMerchant(ctx);
    return listShopsByMerchant(getDb(), merchant.id);
  },
});

// ---------------------------------------------------------------------------
// products (storefront reads are public; writes are merchant-only)
// ---------------------------------------------------------------------------
export const listProducts = action({
  args: {
    shopId: v.optional(v.string()),
    status: v.optional(v.string()),
    q: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    return listNeonProducts(getDb(), {
      shopId: args.shopId,
      status: (args.status as "draft" | "published" | "archived" | undefined) ?? "published",
      q: args.q,
      limit: args.limit ?? 50,
    });
  },
});

export const addProduct = action({
  args: {
    shopId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    unit: v.optional(v.string()),
    price: v.number(),
    images: v.optional(v.array(v.string())),
    initialStock: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { merchant } = await requireMerchant(ctx);
    const db = getDb();
    const shops = await listShopsByMerchant(db, merchant.id);
    if (!shops.some((s) => s.id === args.shopId)) {
      throw new Error("ร้านนี้ไม่ใช่ของคุณ");
    }
    return createProduct(db, {
      shopId: args.shopId,
      name: args.name,
      description: args.description ?? null,
      category: args.category as "general" | "food" | "daily" | "beauty" | "packaging" | "other" | undefined,
      unit: args.unit ?? "piece",
      price: args.price,
      status: "published",
      images: args.images ?? [],
      initialStock: args.initialStock ?? 0,
    });
  },
});

// ---------------------------------------------------------------------------
// orders
// ---------------------------------------------------------------------------
export const placeOrder = action({
  args: {
    items: v.array(v.object({ productId: v.string(), quantity: v.number() })),
    address: v.any(),
    idempotencyKey: v.string(),
    shippingFee: v.optional(v.number()),
    note: v.optional(v.string()),
    paymentMethod: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const db = getDb();
    const user = await findOrCreateUser(db, {
      convexId: identity.subject,
      email: identity.email ?? null,
      name: identity.name ?? null,
    });
    return createOrder({
      customerUserId: user.id,
      items: args.items,
      addressSnapshot: args.address,
      idempotencyKey: args.idempotencyKey,
      shippingFee: args.shippingFee ?? 0,
      note: args.note,
      paymentMethod: args.paymentMethod as "cod" | "transfer" | "card" | "promptpay" | "wallet" | undefined,
    });
  },
});

export const myOrders = action({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const db = getDb();
    const user = await findOrCreateUser(db, {
      convexId: identity.subject,
      email: identity.email ?? null,
      name: identity.name ?? null,
    });
    return listOrdersForCustomer(db, user.id, args.limit ?? 50);
  },
});

export const merchantOrders = action({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const { merchant } = await requireMerchant(ctx);
    return listOrdersForMerchant(getDb(), merchant.id, args.limit ?? 50);
  },
});

export const setOrderStatus = action({
  args: {
    orderId: v.string(),
    status: v.optional(v.string()),
    paymentStatus: v.optional(v.string()),
    shippingStatus: v.optional(v.string()),
    trackingNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireMerchant(ctx);
    return updateOrderStatus({
      orderId: args.orderId,
      status: args.status as "pending" | "confirmed" | "shipped" | "delivered" | "completed" | "cancelled" | undefined,
      paymentStatus: args.paymentStatus as "unpaid" | "pending" | "paid" | "partially_refunded" | "refunded" | "failed" | undefined,
      shippingStatus: args.shippingStatus as "not_shipped" | "processing" | "shipped" | "delivered" | "returned" | undefined,
      trackingNumber: args.trackingNumber,
    });
  },
});

export const cancelOrderAction = action({
  args: { orderId: v.string() },
  handler: async (ctx, args) => {
    await requireIdentity(ctx);
    return cancelOrder(args.orderId);
  },
});

// ---------------------------------------------------------------------------
// payments
// ---------------------------------------------------------------------------
export const confirmPayment = action({
  args: {
    orderId: v.string(),
    amount: v.number(),
    method: v.string(),
    externalRef: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { merchant } = await requireMerchant(ctx);
    return recordPayment({
      orderId: args.orderId,
      amount: args.amount,
      method: args.method as "cod" | "transfer" | "card" | "promptpay" | "wallet",
      externalRef: args.externalRef ?? null,
      status: "succeeded",
    });
  },
});

export const refundAction = action({
  args: { orderId: v.string(), amount: v.number(), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireMerchant(ctx);
    return refundPayment({ orderId: args.orderId, amount: args.amount, reason: args.reason ?? null });
  },
});

// ---------------------------------------------------------------------------
// VelRepeat subscriptions
// ---------------------------------------------------------------------------
export const createVelRepeat = action({
  args: {
    productId: v.string(),
    quantity: v.number(),
    frequency: v.string(),
    intervalDays: v.number(),
    nextOrderDate: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const db = getDb();
    const user = await findOrCreateUser(db, {
      convexId: identity.subject,
      email: identity.email ?? null,
      name: identity.name ?? null,
    });
    return createSubscription(db, {
      customerUserId: user.id,
      productId: args.productId,
      quantity: args.quantity,
      frequency: args.frequency as "daily" | "weekly" | "monthly" | "custom",
      intervalDays: args.intervalDays,
      nextOrderDate: args.nextOrderDate,
    });
  },
});

export const mySubscriptions = action({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const db = getDb();
    const user = await findOrCreateUser(db, {
      convexId: identity.subject,
      email: identity.email ?? null,
      name: identity.name ?? null,
    });
    return listSubscriptions(db, user.id);
  },
});

export const pauseSubscription = action({
  args: { subscriptionId: v.string(), status: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const db = getDb();
    const user = await findOrCreateUser(db, {
      convexId: identity.subject,
      email: identity.email ?? null,
      name: identity.name ?? null,
    });
    const sub = await getSubscription(db, args.subscriptionId);
    if (!sub || sub.customerUserId !== user.id) throw new Error("Subscription not found");
    return updateSubscriptionStatus(db, args.subscriptionId, args.status as "active" | "paused" | "cancelled");
  },
});
