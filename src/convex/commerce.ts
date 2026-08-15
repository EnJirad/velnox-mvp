/**
 * Velnox Backend — Convex node actions bridging the 3 frontends to Neon.
 *
 * Rule of Architecture v3: frontends never touch Neon directly and never
 * decide business numbers. They call these actions ("use node") which run the
 * Commerce Core services in src/backend/* (Neon = source of truth for
 * commerce). Convex stays the Intelligence layer: interests/views,
 * recommendations, realtime business events, notifications.
 *
 * Every write is ownership-checked server-side:
 *   User -> Seller -> Shop -> Product -> ProductImage
 *
 * Required env vars (Convex deployment env — project Keys/API keys UI):
 *   DATABASE_URL                  (Neon)
 *   CLOUDINARY_CLOUD_NAME / _API_KEY / _API_SECRET   (product image storage)
 */
"use node";

import { action } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { getDb } from "../backend/db";
import {
  findOrCreateUser,
  getSellerByOwner,
  createSeller,
  getShopById,
  createShop,
  listShopsBySeller,
  updateShop,
  updateShopLocation,
} from "../backend/sellers";
import {
  catalogProducts,
  createProduct,
  deleteProduct,
  getProduct,
  listProducts as listNeonProducts,
  addProductImage,
  deleteProductImage,
  setPrimaryProductImage,
  reorderProductImages,
  updateProduct,
} from "../backend/products";
import { setReorderLevel, setStock } from "../backend/inventory";
import {
  cancelOrder,
  createOrder,
  listOrdersForCustomer,
  listOrdersForSeller,
  sellerIncome,
  updateOrderStatus,
} from "../backend/orders";
import { recordPayment, refundPayment } from "../backend/payments";
import { audit } from "../backend/audit";
import { AppError } from "../backend/errors";
import { gpsSchema } from "../backend/validation";
import { enforceRateLimit } from "./rateLimit";
import {
  advanceSubscription,
  computeNextOrderDate,
  createSubscription,
  getDueSubscriptions,
  getSubscription,
  listSubscriptions,
  listSubscriptionsBySeller,
  updateSubscriptionSettings,
  updateSubscriptionStatus,
} from "../backend/subscriptions";
import {
  ALLOWED_IMAGE_FORMATS,
  getStorage,
  isStorageConfigured,
  MAX_IMAGE_BYTES,
} from "../backend/storage";
import type { Product, Seller } from "../backend/types";

// ---------------------------------------------------------------------------
// identity + ownership helpers
// ---------------------------------------------------------------------------
async function requireIdentity(ctx: ActionCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new AppError("AUTH_REQUIRED", "Unauthorized — please sign in first");
  const user = await findOrCreateUser(getDb(), {
    convexId: identity.subject,
    email: identity.email ?? null,
    name: identity.name ?? null,
  });
  return { identity, user };
}

async function requireSeller(ctx: ActionCtx) {
  const { identity, user } = await requireIdentity(ctx);
  const seller = await getSellerByOwner(getDb(), user.id);
  if (!seller) throw new AppError("FORBIDDEN", "ไม่พบร้านค้าของคุณ — กรุณาเปิดร้านก่อน");
  return { identity, user, seller };
}

/** Verify the seller owns the product (Product -> Shop -> Seller chain). */
async function requireSellerProduct(
  ctx: ActionCtx,
  productId: string,
): Promise<{ seller: Seller; product: Product; user: { id: string; role: string } }> {
  const { seller, user } = await requireSeller(ctx);
  const db = getDb();
  const product = await getProduct(db, productId);
  if (!product) throw new AppError("PRODUCT_NOT_FOUND", "Product not found");
  const shop = await getShopById(db, product.shopId);
  if (!shop || shop.sellerId !== seller.id) {
    throw new AppError("FORBIDDEN", "สินค้านี้ไม่ใช่ของคุณ");
  }
  return { seller, product, user };
}

/** Verify the seller owns at least one line of the order (marketplace split orders). */
async function sellerOwnsOrder(ctx: ActionCtx, orderId: string): Promise<Seller> {
  const { seller } = await requireSeller(ctx);
  const rows = await getDb()(
    "SELECT 1 FROM order_items WHERE order_id = $1 AND seller_id = $2 LIMIT 1",
    [orderId, seller.id],
  );
  if (!rows[0]) throw new AppError("ORDER_NOT_FOUND", "ออเดอร์นี้ไม่ใช่ของคุณ");
  return seller;
}

// ---------------------------------------------------------------------------
// Neon -> Convex business events (realtime / intelligence foundation)
// ---------------------------------------------------------------------------
async function recordEvent(
  ctx: ActionCtx,
  type: string,
  entityId: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  try {
    await ctx.runMutation(api.intelligence.recordBusinessEvent, { type, entityId, payload });
  } catch (err) {
    // events must never break the commerce write that triggered them
    console.error(`[commerce] failed to record event ${type}:`, err);
  }
}

// ---------------------------------------------------------------------------
// users / sellers / shops
// ---------------------------------------------------------------------------
/** Keep Neon's users table in sync with Convex auth (call after sign-in). */
export const syncUser = action({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireIdentity(ctx);
    return user;
  },
});

/** velseller: open a shop (creates seller + shop if not yet open). */
export const openShop = action({
  args: {
    shopName: v.string(),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    taxId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireIdentity(ctx);
    const db = getDb();
    const seller = await createSeller(db, {
      ownerUserId: user.id,
      name: args.shopName,
      taxId: args.taxId ?? null,
    });
    const existing = await listShopsBySeller(db, seller.id);
    const shop = existing[0] ?? (await createShop(db, {
      sellerId: seller.id,
      name: args.shopName,
      slug: args.slug ?? null,
      description: args.description ?? null,
    }));
    return { user, seller, shop };
  },
});

/** velseller: my seller profile + shops (null when the user has no shop yet). */
export const mySellerProfile = action({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireIdentity(ctx);
    const db = getDb();
    const seller = await getSellerByOwner(db, user.id);
    if (!seller) return null;
    const shops = await listShopsBySeller(db, seller.id);
    return { seller, shops };
  },
});

export const updateShopInfo = action({
  args: {
    shopId: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    announcement: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { seller, user } = await requireSeller(ctx);
    const db = getDb();
    const shops = await listShopsBySeller(db, seller.id);
    if (!shops.some((s) => s.id === args.shopId)) throw new AppError("FORBIDDEN", "ร้านนี้ไม่ใช่ของคุณ");
    const updated = await updateShop(db, args.shopId, {
      name: args.name,
      description: args.description,
      announcement: args.announcement,
    });
    await audit(db, {
      actorId: user.id,
      actorRole: "seller",
      action: "SELLER_UPDATED_SHOP",
      entityType: "shop",
      entityId: args.shopId,
      after: { name: args.name, description: args.description, announcement: args.announcement },
    });
    return updated;
  },
});

/**
 * velseller: set the shop's storefront GPS (pickup / return / delivery area).
 * GPS must be a valid pair — validated server-side, never trusted from client.
 */
export const updateShopLocationAction = action({
  args: { shopId: v.string(), latitude: v.number(), longitude: v.number() },
  handler: async (ctx, args) => {
    const { seller, user } = await requireSeller(ctx);
    const db = getDb();
    const shops = await listShopsBySeller(db, seller.id);
    if (!shops.some((s) => s.id === args.shopId)) throw new AppError("FORBIDDEN", "ร้านนี้ไม่ใช่ของคุณ");
    const gps = gpsSchema.parse({ latitude: args.latitude, longitude: args.longitude });
    const updated = await updateShopLocation(db, args.shopId, {
      latitude: gps.latitude ?? null,
      longitude: gps.longitude ?? null,
    });
    await audit(db, {
      actorId: user.id,
      actorRole: "seller",
      action: "SELLER_UPDATED_SHOP_LOCATION",
      entityType: "shop",
      entityId: args.shopId,
      after: { latitude: args.latitude, longitude: args.longitude },
    });
    return updated;
  },
});

// ---------------------------------------------------------------------------
// products (writes are seller-only; reads are public)
// ---------------------------------------------------------------------------
/**
 * Storefront/seller product list.
 * - mine=true (seller): every product in the seller's shop (any status).
 * - public: published products with primary image + shop/seller names.
 */
export const listProducts = action({
  args: {
    mine: v.optional(v.boolean()),
    status: v.optional(v.string()),
    q: v.optional(v.string()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const db = getDb();
    if (args.mine) {
      const { seller } = await requireSeller(ctx);
      const shops = await listShopsBySeller(db, seller.id);
      return listNeonProducts(db, {
        sellerId: seller.id,
        shopId: shops[0]?.id,
        status: args.status as "draft" | "published" | "archived" | undefined,
        q: args.q,
        limit: args.limit ?? 100,
        offset: args.offset,
      });
    }
    return listNeonProducts(db, {
      status: (args.status as "published" | undefined) ?? "published",
      q: args.q,
      limit: args.limit ?? 50,
      offset: args.offset,
    });
  },
});

/** Public product detail: images + inventory + shop/seller. */
export const getProductDetail = action({
  args: { productId: v.string() },
  handler: async (_ctx, args) => {
    return getProduct(getDb(), args.productId);
  },
});

/**
 * Storefront catalog (public): keyword + category + shop + price + stock
 * filters, sort, pagination. Backend counts and filters — the frontend only
 * renders what the backend returns (spec §31: backend-driven search).
 */
export const catalogProductsAction = action({
  args: {
    q: v.optional(v.string()),
    category: v.optional(v.string()),
    shopId: v.optional(v.string()),
    minPrice: v.optional(v.number()),
    maxPrice: v.optional(v.number()),
    inStock: v.optional(v.boolean()),
    sortBy: v.optional(v.string()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const result = await catalogProducts(getDb(), {
      q: args.q ?? undefined,
      category: args.category ?? undefined,
      shopId: args.shopId ?? undefined,
      minPrice: args.minPrice ?? undefined,
      maxPrice: args.maxPrice ?? undefined,
      inStock: args.inStock ?? undefined,
      sortBy: (args.sortBy ?? "newest") as "newest" | "price_asc" | "price_desc" | "popular" | "rating",
      limit: args.limit ?? 24,
      offset: args.offset ?? 0,
    });
    return result;
  },
});

export const createProductAction = action({
  args: {
    shopId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    unit: v.optional(v.string()),
    price: v.number(),
    supplier: v.optional(v.string()),
    status: v.optional(v.string()),
    initialStock: v.optional(v.number()),
    reorderLevel: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { seller, user } = await requireSeller(ctx);
    await enforceRateLimit(ctx, { name: "product_create", key: user.id, max: 30, windowMs: 3_600_000 });
    const db = getDb();
    const shops = await listShopsBySeller(db, seller.id);
    if (!shops.some((s) => s.id === args.shopId)) throw new AppError("FORBIDDEN", "ร้านนี้ไม่ใช่ของคุณ");
    const product = await createProduct(db, {
      shopId: args.shopId,
      name: args.name,
      description: args.description ?? null,
      category: args.category as "general" | "food" | "daily" | "beauty" | "packaging" | "other" | undefined,
      unit: args.unit ?? "piece",
      price: args.price,
      status: (args.status as "draft" | "published" | "archived" | undefined) ?? "draft",
      supplier: args.supplier ?? null,
      initialStock: args.initialStock ?? 0,
    });
    if (args.reorderLevel) {
      await setReorderLevel(db, product.id, args.reorderLevel);
    }
    await audit(db, {
      actorId: user.id,
      actorRole: "seller",
      action: "SELLER_CREATED_PRODUCT",
      entityType: "product",
      entityId: product.id,
      after: { name: product.name, price: product.price, status: product.status, shopId: product.shopId },
    });
    return getProduct(db, product.id);
  },
});

export const updateProductAction = action({
  args: {
    productId: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    unit: v.optional(v.string()),
    price: v.optional(v.number()),
    supplier: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { product, user } = await requireSellerProduct(ctx, args.productId);
    const updated = await updateProduct(getDb(), product.id, {
      name: args.name,
      description: args.description,
      category: args.category as "general" | "food" | "daily" | "beauty" | "packaging" | "other" | undefined,
      unit: args.unit,
      price: args.price,
      supplier: args.supplier,
      status: args.status as "draft" | "published" | "archived" | undefined,
    });
    await audit(getDb(), {
      actorId: user.id,
      actorRole: "seller",
      action: "SELLER_UPDATED_PRODUCT",
      entityType: "product",
      entityId: product.id,
      before: { name: product.name, price: product.price, status: product.status },
      after: {
        name: updated?.name,
        price: updated?.price,
        status: updated?.status,
      },
    });
    return updated;
  },
});

export const setProductStatusAction = action({
  args: { productId: v.string(), status: v.string() },
  handler: async (ctx, args) => {
    const { product, user } = await requireSellerProduct(ctx, args.productId);
    const status = args.status as "draft" | "published" | "archived";
    if (!["draft", "published", "archived"].includes(status)) throw new AppError("INVALID_INPUT", "Invalid product status");
    if (status === "published") {
      const full = await getProduct(getDb(), product.id);
      if (!full?.inventory) throw new AppError("INVALID_INPUT", "ต้องตั้งสต็อกก่อนจึงจะประกาศขายได้");
      if (full.price <= 0) throw new AppError("INVALID_INPUT", "ต้องตั้งราคาก่อนจึงจะประกาศขายได้");
    }
    await updateProduct(getDb(), product.id, { status });
    await audit(getDb(), {
      actorId: user.id,
      actorRole: "seller",
      action: "SELLER_UPDATED_PRODUCT_STATUS",
      entityType: "product",
      entityId: product.id,
      before: { status: product.status },
      after: { status },
    });
    await recordEvent(ctx, "ProductUpdated", product.id, { status });
    return getProduct(getDb(), product.id);
  },
});

export const deleteProductAction = action({
  args: { productId: v.string() },
  handler: async (ctx, args) => {
    const { product, user } = await requireSellerProduct(ctx, args.productId);
    await audit(getDb(), {
      actorId: user.id,
      actorRole: "seller",
      action: "SELLER_ARCHIVED_PRODUCT",
      entityType: "product",
      entityId: product.id,
      before: { name: product.name, status: product.status },
    });
    await deleteProduct(getDb(), product.id);
    await recordEvent(ctx, "ProductDeleted", product.id, {});
    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// inventory
// ---------------------------------------------------------------------------
export const setStockAction = action({
  args: { productId: v.string(), quantity: v.number() },
  handler: async (ctx, args) => {
    const { product } = await requireSellerProduct(ctx, args.productId);
    const inv = await setStock(getDb(), product.id, Math.max(0, Math.round(args.quantity)));
    await recordEvent(ctx, "InventoryChanged", product.id, { quantity: inv.quantity });
    return inv;
  },
});

export const setReorderLevelAction = action({
  args: { productId: v.string(), reorderLevel: v.number() },
  handler: async (ctx, args) => {
    const { product } = await requireSellerProduct(ctx, args.productId);
    return setReorderLevel(getDb(), product.id, Math.max(0, Math.round(args.reorderLevel)));
  },
});

// ---------------------------------------------------------------------------
// product images — storage (Cloudinary) + metadata (Neon)
// ---------------------------------------------------------------------------
/**
 * Step 1 of upload: seller asks the backend for a signed upload permit.
 * The browser then POSTs the file straight to Cloudinary with these params
 * (no binary bytes through our server). file type + max size are enforced by
 * Cloudinary via the signed params AND re-validated in saveProductImage.
 */
export const getProductImageUploadSignature = action({
  args: { productId: v.string() },
  handler: async (ctx, args) => {
    if (!isStorageConfigured()) {
      throw new Error(
        "Image storage is not configured — set CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / " +
          "CLOUDINARY_API_SECRET in the project Keys/API keys UI.",
      );
    }
    const { product, user } = await requireSellerProduct(ctx, args.productId);
    await enforceRateLimit(ctx, { name: "image_upload", key: user.id, max: 60, windowMs: 3_600_000 });
    const storage = getStorage();
    const folder = `velnox/products/${product.shopId}`;
    const publicId = `${product.id.slice(0, 8)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return { productId: product.id, ...storage.getSignedUploadParams(folder, publicId) };
  },
});

/**
 * Step 2 of upload: persist the metadata of a successfully uploaded image.
 * Re-validates file type/size server-side (never trust the frontend), builds
 * the canonical URL from the storage public id, and only then inserts the
 * row into Neon product_images.
 */
export const saveProductImage = action({
  args: {
    productId: v.string(),
    publicId: v.string(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    format: v.optional(v.string()),
    bytes: v.optional(v.number()),
    alt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { product } = await requireSellerProduct(ctx, args.productId);
    const format = (args.format ?? "").toLowerCase();
    const allowed = ALLOWED_IMAGE_FORMATS.split(",");
    if (!allowed.includes(format)) {
      throw new AppError("INVALID_INPUT", `ไฟล์รูปประเภท .${format || "?"} ไม่ได้รับอนุญาต (รองรับ: ${ALLOWED_IMAGE_FORMATS})`);
    }
    if ((args.bytes ?? MAX_IMAGE_BYTES + 1) > MAX_IMAGE_BYTES) {
      throw new AppError("INVALID_INPUT", "ไฟล์รูปใหญ่เกิน 5 MB");
    }

    const storage = getStorage();
    const url = storage.originalUrl(args.publicId);
    await addProductImage(getDb(), product.id, {
      url,
      storageProvider: "cloudinary",
      storageKey: args.publicId,
      alt: args.alt ?? null,
      width: args.width ?? null,
      height: args.height ?? null,
    });
    return getProduct(getDb(), product.id);
  },
});

export const deleteProductImageAction = action({
  args: { imageId: v.string() },
  handler: async (ctx, args) => {
    const db = getDb();
    // load the row to verify ownership before deleting anything
    const images = await db("SELECT * FROM product_images WHERE id = $1", [args.imageId]);
    if (!images[0]) throw new AppError("NOT_FOUND", "Image not found");
    const product = await getProduct(db, images[0].product_id);
    if (!product) throw new AppError("PRODUCT_NOT_FOUND", "Product not found");
    const shop = await getShopById(db, product.shopId);
    if (!shop) throw new AppError("SHOP_NOT_FOUND", "Shop not found");
    const { seller } = await requireSeller(ctx);
    if (shop.sellerId !== seller.id) throw new AppError("FORBIDDEN", "รูปนี้ไม่ใช่ของคุณ");

    const removed = await deleteProductImage(db, args.imageId);
    if (!removed) throw new AppError("NOT_FOUND", "Image not found");

    // best-effort binary cleanup in object storage
    if (removed.image.storageKey && isStorageConfigured()) {
      try {
        await getStorage().deleteFile(removed.image.storageKey);
      } catch (err) {
        console.error("[commerce] storage delete failed (row removed anyway):", err);
      }
    }
    return getProduct(db, product.id);
  },
});

export const setPrimaryProductImageAction = action({
  args: { productId: v.string(), imageId: v.string() },
  handler: async (ctx, args) => {
    const { product } = await requireSellerProduct(ctx, args.productId);
    await setPrimaryProductImage(getDb(), product.id, args.imageId);
    return getProduct(getDb(), product.id);
  },
});

export const reorderProductImagesAction = action({
  args: { productId: v.string(), orderedIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const { product } = await requireSellerProduct(ctx, args.productId);
    const db = getDb();
    const images = await db("SELECT id FROM product_images WHERE product_id = $1", [product.id]);
    const current = new Set(images.map((r) => r.id));
    if (args.orderedIds.length !== current.size || args.orderedIds.some((id) => !current.has(id))) {
      throw new AppError("INVALID_INPUT", "Invalid image ordering");
    }
    await reorderProductImages(db, product.id, args.orderedIds);
    return getProduct(db, product.id);
  },
});

// ---------------------------------------------------------------------------
// orders
// ---------------------------------------------------------------------------
// NOTE: order creation lives in the Commerce Core only (customer.ts
// checkoutAction → src/backend/checkout.ts). The legacy placeOrder action
// (client-supplied shippingFee/address) was removed in Phase 11.

export const myOrders = action({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const { user } = await requireIdentity(ctx);
    return listOrdersForCustomer(getDb(), user.id, args.limit ?? 50);
  },
});

/** velseller: orders containing this seller's products (with own line items). */
export const sellerOrders = action({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const { seller } = await requireSeller(ctx);
    return listOrdersForSeller(getDb(), seller.id, args.limit ?? 50);
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
    const seller = await sellerOwnsOrder(ctx, args.orderId);
    const order = await updateOrderStatus({
      orderId: args.orderId,
      status: args.status as "pending" | "confirmed" | "shipped" | "delivered" | "completed" | "cancelled" | undefined,
      paymentStatus: args.paymentStatus as "unpaid" | "pending" | "paid" | "partially_refunded" | "refunded" | "failed" | undefined,
      shippingStatus: args.shippingStatus as "not_shipped" | "processing" | "shipped" | "delivered" | "returned" | undefined,
      trackingNumber: args.trackingNumber,
    });
    await audit(getDb(), {
      actorId: seller.ownerUserId,
      actorRole: "seller",
      action: "SELLER_UPDATED_ORDER_STATUS",
      entityType: "order",
      entityId: order.id,
      after: { status: order.status, paymentStatus: order.paymentStatus, shippingStatus: order.shippingStatus },
    });
    await recordEvent(ctx, "OrderStatusChanged", order.id, {
      status: order.status,
      sellerId: seller.id,
    });
    return order;
  },
});

export const cancelOrderAction = action({
  args: { orderId: v.string() },
  handler: async (ctx, args) => {
    const { user } = await requireIdentity(ctx);
    await enforceRateLimit(ctx, { name: "cancel_order", key: user.id, max: 20, windowMs: 60_000 });
    const db = getDb();
    const order = await db("SELECT id, customer_user_id, payment_status FROM orders WHERE id = $1", [args.orderId]);
    if (!order[0] || order[0].customer_user_id !== user.id) {
      throw new Error("ออเดอร์นี้ไม่ใช่ของคุณ");
    }
    const cancelled = await cancelOrder(args.orderId);
    await audit(db, {
      actorId: user.id,
      actorRole: user.role,
      action: "CUSTOMER_CANCELLED_ORDER",
      entityType: "order",
      entityId: args.orderId,
      after: { status: cancelled.status },
    });
    await recordEvent(ctx, "OrderCancelled", args.orderId, {});
    return cancelled;
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
    await sellerOwnsOrder(ctx, args.orderId);
    const payment = await recordPayment({
      orderId: args.orderId,
      amount: args.amount,
      method: args.method as "cod" | "transfer" | "card" | "promptpay" | "wallet",
      externalRef: args.externalRef ?? null,
      status: "succeeded",
    });
    await recordEvent(ctx, "PaymentConfirmed", args.orderId, { amount: payment.amount });
    return payment;
  },
});

export const refundAction = action({
  args: { orderId: v.string(), amount: v.number(), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await sellerOwnsOrder(ctx, args.orderId);
    const refund = await refundPayment({ orderId: args.orderId, amount: args.amount, reason: args.reason ?? null });
    await recordEvent(ctx, "RefundProcessed", args.orderId, { amount: refund.amount });
    return refund;
  },
});

/** velseller "รายได้": gross, returns, 3% commission + payout under the return policy. */
export const sellerIncomeReport = action({
  args: {},
  handler: async (ctx) => {
    const { seller } = await requireSeller(ctx);
    return sellerIncome(getDb(), seller.id);
  },
});

// ---------------------------------------------------------------------------
// VelRepeat subscriptions (commerce in Neon; intelligence in Convex)
// ---------------------------------------------------------------------------
export const createVelRepeat = action({
  args: {
    productId: v.string(),
    quantity: v.number(),
    frequency: v.optional(v.string()),
    intervalDays: v.number(),
  },
  handler: async (ctx, args) => {
    const { identity, user } = await requireIdentity(ctx);
    await enforceRateLimit(ctx, { name: "subscribe", key: user.id, max: 20, windowMs: 3_600_000 });
    const frequency = (args.frequency ?? "monthly") as "daily" | "weekly" | "monthly" | "custom";
    const nextOrderDate = computeNextOrderDate(frequency, new Date(), args.intervalDays);
    const sub = await createSubscription(getDb(), {
      customerUserId: user.id,
      productId: args.productId,
      quantity: args.quantity,
      frequency,
      intervalDays: args.intervalDays,
      nextOrderDate,
    });
    await recordEvent(ctx, "SubscriptionUpdated", sub.id, { status: sub.status });
    // CPNS: starting a VelRepeat subscription is a strong recurring-intent signal.
    try {
      const product = await getProduct(getDb(), args.productId);
      await ctx.runMutation(api.memoryEvents.trackForUser, {
        userId: identity.subject as Id<"users">,
        type: "VELREPEAT_START",
        entityId: args.productId,
        value: product?.name ?? undefined,
        context: { quantity: args.quantity, frequency, intervalDays: args.intervalDays, subscriptionId: sub.id },
      });
    } catch (err) {
      console.error("[commerce] VELREPEAT_START event failed:", err);
    }
    return sub;
  },
});

export const mySubscriptions = action({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireIdentity(ctx);
    return listSubscriptions(getDb(), user.id);
  },
});

/** velseller: VelRepeat subscriptions on this seller's products. */
export const sellerSubscriptions = action({
  args: {},
  handler: async (ctx) => {
    const { seller } = await requireSeller(ctx);
    return listSubscriptionsBySeller(getDb(), seller.id);
  },
});

export const pauseSubscription = action({
  args: { subscriptionId: v.string(), status: v.string() },
  handler: async (ctx, args) => {
    const { user } = await requireIdentity(ctx);
    const db = getDb();
    const sub = await getSubscription(db, args.subscriptionId);
    if (!sub || sub.customerUserId !== user.id) throw new AppError("NOT_FOUND", "Subscription not found");
    const status = args.status as "active" | "paused" | "cancelled";
    const updated = await updateSubscriptionStatus(db, args.subscriptionId, status);
    await recordEvent(ctx, "SubscriptionUpdated", args.subscriptionId, { status });
    return updated;
  },
});

/**
 * velshop: change quantity / frequency / interval of a subscription.
 * Only the owning customer can change it; the backend recomputes the next
 * order date from today (never accepts a date from the frontend).
 */
export const updateSubscriptionAction = action({
  args: {
    subscriptionId: v.string(),
    quantity: v.optional(v.number()),
    frequency: v.optional(v.string()),
    intervalDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireIdentity(ctx);
    const db = getDb();
    const sub = await getSubscription(db, args.subscriptionId);
    if (!sub || sub.customerUserId !== user.id) throw new AppError("NOT_FOUND", "Subscription not found");
    const updated = await updateSubscriptionSettings(db, args.subscriptionId, {
      quantity: args.quantity ?? undefined,
      frequency: args.frequency as "daily" | "weekly" | "monthly" | "custom" | undefined,
      intervalDays: args.intervalDays ?? undefined,
    });
    await recordEvent(ctx, "SubscriptionUpdated", args.subscriptionId, {
      quantity: updated?.quantity,
      frequency: updated?.frequency,
      nextOrderDate: updated?.nextOrderDate,
    });
    return updated;
  },
});

/**
 * VelRepeat scheduler trigger (velseller "สร้างออเดอร์รอบครบกำหนด"): every
 * active subscription whose next order date has arrived creates a real order
 * through the commerce core (inventory reserve + snapshots + commission) and
 * advances to the next cycle. Subscriptions with insufficient stock are
 * skipped (the customer is notified via a business event).
 */
export const processDueSubscriptions = action({
  args: {},
  handler: async (ctx) => {
    const { seller } = await requireSeller(ctx);
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const due = await getDueSubscriptions(db, today);

    let created = 0;
    let skipped = 0;
    for (const sub of due) {
      try {
        const order = await createOrder({
          customerUserId: sub.customerUserId,
          items: [{ productId: sub.productId, quantity: sub.quantity }],
          addressSnapshot: { recipientName: "", phone: "", line1: "VelRepeat auto-order" },
          idempotencyKey: `velrepeat-${sub.id}-${sub.nextOrderDate}`,
          shippingFee: 0,
          note: "VelRepeat automatic order",
        });
        await advanceSubscription(db, sub.id);
        await recordEvent(ctx, "VelRepeatOrderCreated", order.id, {
          subscriptionId: sub.id,
          orderNumber: order.orderNumber,
        });
        created++;
      } catch (err) {
        skipped++;
        await recordEvent(ctx, "VelRepeatOrderSkipped", sub.id, {
          reason: err instanceof Error ? err.message : "insufficient stock",
        });
      }
    }
    return { created, skipped, sellerId: seller.id };
  },
});

// ---------------------------------------------------------------------------
// Intelligence (Convex) — VelRepeat: learn, predict, recommend
// ---------------------------------------------------------------------------
/** Record that a shopper is interested in a Neon product ("❤️ สนใจ"). */
export const recordInterest = action({
  args: { productId: v.string() },
  handler: async (ctx, args) => {
    await ctx.runMutation(api.intelligence.recordInterest, { productId: args.productId });
  },
});

const DAY_MS = 24 * 60 * 60 * 1000;

type InterestRow = { productId: string; viewedAt: number };

async function interestRows(ctx: ActionCtx, userId?: string): Promise<InterestRow[]> {
  const rows = await ctx.runQuery(api.intelligence.recentInterests, { userId });
  return rows as unknown as InterestRow[];
}

/** Most-interested products across all shoppers (last 30 days). */
export const popularProducts = action({
  args: {},
  handler: async (ctx) => {
    const since = Date.now() - 30 * DAY_MS;
    const views = await interestRows(ctx);

    const counts = new Map<string, { views: number; lastViewedAt: number }>();
    for (const view of views) {
      if (view.viewedAt < since) continue;
      const agg = counts.get(view.productId) ?? { views: 0, lastViewedAt: 0 };
      agg.views += 1;
      agg.lastViewedAt = Math.max(agg.lastViewedAt, view.viewedAt);
      counts.set(view.productId, agg);
    }
    const rows: { product: Product; views: number; lastViewedAt: number }[] = [];
    for (const [productId, agg] of counts) {
      const product = await getProduct(getDb(), productId);
      if (!product || product.status !== "published" || product.price <= 0) continue;
      rows.push({ product, ...agg });
    }
    rows.sort((a, b) => b.views - a.views || b.lastViewedAt - a.lastViewedAt);
    return rows.slice(0, 8);
  },
});

/** VelRepeat personalization: what THIS customer clicks most (top 8). */
export const customerInterests = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const views = await interestRows(ctx, identity.subject);

    const counts = new Map<string, { views: number; lastViewedAt: number }>();
    for (const view of views) {
      const agg = counts.get(view.productId) ?? { views: 0, lastViewedAt: 0 };
      agg.views += 1;
      agg.lastViewedAt = Math.max(agg.lastViewedAt, view.viewedAt);
      counts.set(view.productId, agg);
    }
    const rows: { product: Product; views: number; lastViewedAt: number }[] = [];
    for (const [productId, agg] of counts) {
      const product = await getProduct(getDb(), productId);
      if (!product || product.status !== "published" || product.price <= 0) continue;
      rows.push({ product, ...agg });
    }
    rows.sort((a, b) => b.views - a.views || b.lastViewedAt - a.lastViewedAt);
    return rows.slice(0, 8);
  },
});

/**
 * Customer Memory (velshop "Velnox จำคุณได้"): the products this customer
 * orders regularly, learned from their own Neon order history.
 */
export const customerRegulars = action({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireIdentity(ctx);
    const db = getDb();
    const orders = await listOrdersForCustomer(db, user.id, 100);
    const byProduct = new Map<string, { times: number; qty: number; lastOrderedAt: number }>();
    for (const order of orders) {
      if (order.status === "cancelled") continue;
      const items = order.items ?? [];
      for (const item of items) {
        const agg = byProduct.get(item.productId) ?? { times: 0, qty: 0, lastOrderedAt: 0 };
        agg.times += 1;
        agg.qty += item.quantity;
        agg.lastOrderedAt = Math.max(agg.lastOrderedAt, new Date(order.createdAt).getTime());
        byProduct.set(item.productId, agg);
      }
    }
    const rows: { product: Product; times: number; qty: number; lastOrderedAt: number }[] = [];
    for (const [productId, agg] of byProduct) {
      const product = await getProduct(db, productId);
      if (!product || product.status !== "published" || product.price <= 0) continue;
      rows.push({ product, ...agg });
    }
    rows.sort((a, b) => b.times - a.times || b.lastOrderedAt - a.lastOrderedAt);
    return rows.slice(0, 8);
  },
});
