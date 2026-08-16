/**
 * Velnox Backend — VelCenter Admin API — Convex node actions.
 *
 * Company-side actions with role + granular permission checks (owner/admin
 * pass; staff only with the right permission). Every sensitive change is
 * audit-logged. Money is computed server-side from Neon (never hard-coded).
 */
"use node";

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { getDb } from "../backend/db";
import { clientMeta, requireCenter, requireIdentity, requirePermission } from "../backend/identity";
import { listSettings, updateSetting, PLATFORM_SETTING_KEYS } from "../backend/platformSettings";
import { listAuditLogs, audit } from "../backend/audit";
import { AppError } from "../backend/errors";
import { listPayouts, platformRevenueReport, processPayout, recomputeSellerBalance } from "../backend/finance";
import { updateOrderStatus } from "../backend/orders";
import { PERMISSION_CATALOG, upsertStaffProfile } from "../backend/permissions";
import { resolveRules } from "../backend/rules";
import { createNotification } from "../backend/notifications";
import type { Department, Permission, SellerStatus } from "../backend/types";

async function recordEvent(ctx: import("./_generated/server").ActionCtx, type: string, entityId: string, payload: Record<string, unknown> = {}) {
  try {
    await ctx.runMutation(api.intelligence.recordBusinessEvent, { type, entityId, payload });
  } catch (err) {
    console.error(`[center] event ${type} failed:`, err);
  }
}

// ---------------------------------------------------------------------------
// platform settings (MANAGE_PLATFORM_SETTINGS)
// ---------------------------------------------------------------------------
export const getPlatformSettings = action({
  args: {},
  handler: async (ctx) => {
    const identity = await requireCenter(ctx);
    if (identity.user.role === "staff") {
      await requirePermission(ctx, "VIEW_FINANCE");
    }
    return { settings: await listSettings(getDb()), keys: PLATFORM_SETTING_KEYS };
  },
});

export const updatePlatformSettingAction = action({
  args: { key: v.string(), value: v.any() },
  handler: async (ctx, args) => {
    const identity = await requirePermission(ctx, "MANAGE_PLATFORM_SETTINGS");
    const db = getDb();
    const before = await listSettings(db);
    const updated = await updateSetting(db, args.key, args.value, identity.user.id);
    await audit(db, {
      actorId: identity.user.id,
      actorRole: identity.user.role,
      action: "ADMIN_CHANGED_PLATFORM_SETTING",
      entityType: "platform_settings",
      entityId: args.key,
      before: { value: before.find((s) => s.key === args.key)?.value },
      after: { value: updated.value },
      ...clientMeta(ctx),
    });
    await recordEvent(ctx, "PlatformSettingChanged", args.key, { value: updated.value });
    return updated;
  },
});

export const getBusinessRules = action({
  args: {},
  handler: async (ctx) => {
    await requireCenter(ctx);
    return resolveRules(getDb());
  },
});

// ---------------------------------------------------------------------------
// audit log (VIEW_USERS / owner only for full log)
// ---------------------------------------------------------------------------
export const auditLogs = action({
  args: { limit: v.optional(v.number()), actorId: v.optional(v.string()), entityType: v.optional(v.string()), entityId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await requireCenter(ctx);
    if (identity.user.role === "staff") {
      await requirePermission(ctx, "VIEW_FINANCE");
    }
    return listAuditLogs(getDb(), {
      actorId: args.actorId,
      entityType: args.entityType,
      entityId: args.entityId,
      limit: args.limit ?? 100,
    });
  },
});

// ---------------------------------------------------------------------------
// revenue + finance (VIEW_FINANCE)
// ---------------------------------------------------------------------------
export const platformRevenue = action({
  args: {},
  handler: async (ctx) => {
    const identity = await requireCenter(ctx);
    if (identity.user.role === "staff") await requirePermission(ctx, "VIEW_FINANCE");
    return platformRevenueReport(getDb());
  },
});

export const payoutList = action({
  args: {},
  handler: async (ctx) => {
    const identity = await requireCenter(ctx);
    if (identity.user.role === "staff") await requirePermission(ctx, "VIEW_FINANCE");
    return listPayouts(getDb());
  },
});

export const processPayoutAction = action({
  args: { payoutId: v.string(), status: v.string() },
  handler: async (ctx, args) => {
    const identity = await requirePermission(ctx, "MANAGE_PAYOUTS");
    const db = getDb();
    const status = args.status as "completed" | "failed" | "cancelled";
    const payout = await processPayout(db, args.payoutId, status);
    await audit(db, {
      actorId: identity.user.id,
      actorRole: identity.user.role,
      action: "ADMIN_PROCESSED_PAYOUT",
      entityType: "seller_payout",
      entityId: payout.id,
      after: { status },
    });
    await recordEvent(ctx, "PayoutProcessed", payout.id, { status });
    return payout;
  },
});

// ---------------------------------------------------------------------------
// seller management (VIEW_SELLERS / APPROVE_SELLERS / SUSPEND_SELLERS)
// ---------------------------------------------------------------------------
export const sellerList = action({
  args: {},
  handler: async (ctx) => {
    const identity = await requireCenter(ctx);
    if (identity.user.role === "staff") await requirePermission(ctx, "VIEW_SELLERS");
    const db = getDb();
    const rows = await db(
      `SELECT sel.id, sel.name, sel.tax_id, sel.status, sel.business_type, sel.approved_at,
              sel.created_at, u.name AS owner_name, u.email AS owner_email,
              (SELECT COUNT(*)::int FROM shops s WHERE s.seller_id = sel.id) AS shop_count,
              (SELECT COUNT(*)::int FROM products p JOIN shops s ON s.id = p.shop_id WHERE s.seller_id = sel.id) AS product_count
       FROM sellers sel
       LEFT JOIN users u ON u.id = sel.owner_user_id
       ORDER BY sel.created_at DESC`,
    );
    return rows;
  },
});

export const setSellerStatusAction = action({
  args: { sellerId: v.string(), status: v.string(), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await requireCenter(ctx);
    const db = getDb();
    const status = args.status as SellerStatus;
    if (!["pending", "approved", "rejected", "suspended"].includes(status)) throw new AppError("INVALID_INPUT", "Invalid seller status");

    const need: Permission = status === "approved" || status === "rejected" ? "APPROVE_SELLERS" : "SUSPEND_SELLERS";
    if (identity.user.role === "staff") await requirePermission(ctx, need);

    const rows = await db("SELECT * FROM sellers WHERE id = $1", [args.sellerId]);
    if (!rows[0]) throw new AppError("NOT_FOUND", "Seller not found");
    const before = { status: rows[0].status };

    await db(
      `UPDATE sellers SET status = $2,
         approved_at = CASE WHEN $2 = 'approved' THEN now() ELSE approved_at END,
         approved_by = CASE WHEN $2 IN ('approved','rejected') THEN $3 ELSE approved_by END
       WHERE id = $1`,
      [args.sellerId, status, identity.user.id],
    );
    await audit(db, {
      actorId: identity.user.id,
      actorRole: identity.user.role,
      action: status === "approved" ? "ADMIN_APPROVED_SELLER" : status === "rejected" ? "ADMIN_REJECTED_SELLER" : "ADMIN_UPDATED_SELLER_STATUS",
      entityType: "seller",
      entityId: args.sellerId,
      before,
      after: { status, reason: args.reason ?? null },
      ...clientMeta(ctx),
    });
    await recordEvent(ctx, "SellerStatusChanged", args.sellerId, { status });

    // notify the seller's owner
    try {
      await createNotification(db, {
        userId: rows[0].owner_user_id,
        type: "seller",
        title: status === "approved" ? "ร้านค้าของคุณได้รับการอนุมัติ 🎉" : status === "rejected" ? "ร้านค้าของคุณถูกปฏิเสธ" : `สถานะร้านค้า: ${status}`,
        message: args.reason ?? null,
      });
    } catch (err) {
      console.error("[center] seller notification failed:", err);
    }
    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// product moderation (VIEW_PRODUCTS / APPROVE_PRODUCTS / SUSPEND_PRODUCTS)
// ---------------------------------------------------------------------------
export const productModerationList = action({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await requireCenter(ctx);
    if (identity.user.role === "staff") await requirePermission(ctx, "VIEW_PRODUCTS");
    const db = getDb();
    const statusFilter = args.status ? `WHERE p.status = $1` : "";
    const params: unknown[] = args.status ? [args.status] : [];
    return db(
      `SELECT p.id, p.name, p.price, p.status, p.created_at,
              s.name AS shop_name, sel.name AS seller_name
       FROM products p
       JOIN shops s ON s.id = p.shop_id
       JOIN sellers sel ON sel.id = s.seller_id
       ${statusFilter}
       ORDER BY p.created_at DESC
       LIMIT 200`,
      params,
    );
  },
});

export const setProductModerationStatus = action({
  args: { productId: v.string(), status: v.string(), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await requireCenter(ctx);
    const db = getDb();
    const status = args.status as "pending_review" | "published" | "rejected" | "suspended";
    const need: Permission = status === "published" || status === "rejected" ? "APPROVE_PRODUCTS" : "SUSPEND_PRODUCTS";
    if (identity.user.role === "staff") await requirePermission(ctx, need);

    const rows = await db("SELECT id, status, shop_id FROM products WHERE id = $1", [args.productId]);
    if (!rows[0]) throw new AppError("PRODUCT_NOT_FOUND", "Product not found");
    const before = { status: rows[0].status };
    await db("UPDATE products SET status = $2 WHERE id = $1", [args.productId, status]);
    await audit(db, {
      actorId: identity.user.id,
      actorRole: identity.user.role,
      action: "ADMIN_CHANGED_PRODUCT_STATUS",
      entityType: "product",
      entityId: args.productId,
      before,
      after: { status, reason: args.reason ?? null },
      ...clientMeta(ctx),
    });
    await recordEvent(ctx, "ProductStatusChanged", args.productId, { status });
    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// staff permissions (owner only — MANAGE_PLATFORM_SETTINGS gate)
// ---------------------------------------------------------------------------
export const permissionCatalog = action({
  args: {},
  handler: async (ctx) => {
    await requireCenter(ctx);
    return PERMISSION_CATALOG;
  },
});

export const setStaffProfileAction = action({
  args: {
    userId: v.string(),
    department: v.optional(v.string()),
    permissions: v.optional(v.array(v.string())),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await requirePermission(ctx, "MANAGE_PLATFORM_SETTINGS");
    if (identity.user.role !== "owner") throw new AppError("FORBIDDEN", "เจ้าของบริษัทเท่านั้นที่ตั้งสิทธิ์พนักงานได้");
    const db = getDb();
    const user = await db("SELECT id, role FROM users WHERE id = $1", [args.userId]);
    if (!user[0]) throw new AppError("NOT_FOUND", "User not found");

    await upsertStaffProfile(db, {
      userId: args.userId,
      department: (args.department ?? null) as Department | null,
      permissions: (args.permissions ?? []) as Permission[],
    });
    if (args.active === false) {
      await db("UPDATE staff_profiles SET status = 'inactive' WHERE user_id = $1", [args.userId]);
    }
    await audit(db, {
      actorId: identity.user.id,
      actorRole: "owner",
      action: "OWNER_SET_STAFF_PROFILE",
      entityType: "staff_profile",
      entityId: args.userId,
      after: { department: args.department ?? null, permissions: args.permissions ?? [], active: args.active ?? true },
      ...clientMeta(ctx),
    });
    return { ok: true };
  },
});

// ---------------------------------------------------------------------------
// orders (center) — real Neon commerce data (VIEW_ORDERS / MANAGE_ORDERS)
// ---------------------------------------------------------------------------
/**
 * Company-wide order list from the Neon commerce core (sub-orders = the
 * fulfillment units, one per shop, each with its own items). Previously the
 * center dashboard read the legacy Convex orders table which checkout never
 * writes — that made the order tab show stale/empty data. Staff need
 * VIEW_ORDERS; owner/admin pass implicitly.
 */
export const ordersListAction = action({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await requireCenter(ctx);
    if (identity.user.role === "staff") await requirePermission(ctx, "VIEW_ORDERS");
    const db = getDb();
    const rows = await db(
      `SELECT o.*, s.name AS shop_name, u.name AS customer_name
       FROM orders o
       LEFT JOIN shops s ON s.id = o.shop_id
       LEFT JOIN users u ON u.id = o.customer_user_id
       WHERE o.parent_order_id IS NOT NULL
       ORDER BY o.created_at DESC
       LIMIT $1`,
      [args.limit ?? 100],
    );
    const orders: any[] = [];
    for (const r of rows) {
      const items = await db(
        `SELECT id, product_name, unit, quantity, subtotal FROM order_items WHERE order_id = $1 ORDER BY created_at ASC`,
        [r.id],
      );
      const snap = typeof r.address_snapshot === "string" ? JSON.parse(r.address_snapshot) : (r.address_snapshot ?? {});
      orders.push({
        id: r.id,
        orderNumber: r.order_number,
        status: r.status,
        createdAt: new Date(r.created_at).getTime(),
        total: Number(r.total),
        customerName: snap.recipientName ?? r.customer_name ?? "ลูกค้า",
        customerPhone: snap.phone ?? "",
        itemCount: items.reduce((s, i) => s + Number(i.quantity), 0),
        shopName: r.shop_name ?? null,
        items: items.map((i: any) => ({
          id: i.id,
          productName: i.product_name,
          unit: i.unit,
          quantity: Number(i.quantity),
          subtotal: Number(i.subtotal),
        })),
      });
    }
    return orders;
  },
});

/**
 * Center order-status update against the Neon state machine (spec §18).
 * Staff need MANAGE_ORDERS; owner/admin pass implicitly. Audit-logged +
 * business event recorded. The legacy Convex updateStatus mutation (no state
 * machine, no audit) is no longer used by velcenter.
 */
export const updateOrderStatusAction = action({
  args: { orderId: v.string(), status: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireCenter(ctx);
    if (identity.user.role === "staff") await requirePermission(ctx, "MANAGE_ORDERS");
    const status = args.status as
      | "pending"
      | "confirmed"
      | "shipped"
      | "delivered"
      | "completed"
      | "cancelled";
    if (!["pending", "confirmed", "shipped", "delivered", "completed", "cancelled"].includes(status)) {
      throw new AppError("INVALID_INPUT", "Invalid order status");
    }
    const db = getDb();
    const order = await updateOrderStatus({ orderId: args.orderId, status });
    await audit(db, {
      actorId: identity.user.id,
      actorRole: identity.user.role,
      action: "ADMIN_UPDATED_ORDER_STATUS",
      entityType: "order",
      entityId: args.orderId,
      after: { status: order.status },
      ...clientMeta(ctx),
    });
    await recordEvent(ctx, "OrderStatusChanged", args.orderId, { status: order.status, actor: identity.user.role });
    return order;
  },
});

/**
 * Marketplace KPIs from the Neon commerce core (GMV, orders, products,
 * customers, sellers). Replaces the legacy api.center.overview numbers which
 * read Convex tables that checkout never writes (revenue showed 0 / wrong).
 * Goals + reorder intelligence stay in Convex (their real home).
 */
export const marketOverviewAction = action({
  args: {},
  handler: async (ctx) => {
    const identity = await requireCenter(ctx);
    if (identity.user.role === "staff") await requirePermission(ctx, "VIEW_ORDERS");
    const db = getDb();
    const agg = await db(
      `SELECT
         COALESCE(SUM(total) FILTER (WHERE status = 'completed'), 0) AS revenue,
         COUNT(*) FILTER (WHERE status <> 'cancelled')::int AS order_count,
         COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_orders,
         COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_orders
       FROM orders WHERE parent_order_id IS NULL`,
    );
    const products = await db(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status = 'published')::int AS published
       FROM products`,
    );
    const customers = await db(`SELECT COUNT(*)::int AS n FROM users WHERE role = 'customer'`);
    const sellers = await db(`SELECT COUNT(*)::int AS n FROM sellers WHERE status = 'approved'`);
    return {
      revenue: Number(agg[0].revenue),
      orderCount: Number(agg[0].order_count),
      pendingOrders: Number(agg[0].pending_orders),
      completedOrders: Number(agg[0].completed_orders),
      productCount: Number(products[0].total),
      publishedCount: Number(products[0].published),
      customerCount: Number(customers[0].n),
      sellerCount: Number(sellers[0].n),
    };
  },
});

// ---------------------------------------------------------------------------
// misc: recompute seller balances from the ledger (owner only)
// ---------------------------------------------------------------------------
export const recomputeBalances = action({
  args: { sellerId: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    if (identity.user.role !== "owner") throw new AppError("FORBIDDEN", "Owner only");
    await recomputeSellerBalance(getDb(), args.sellerId);
    return { ok: true };
  },
});
