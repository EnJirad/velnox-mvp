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
import { listPayouts, platformRevenueReport, processPayout, recomputeSellerBalance } from "../backend/finance";
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
    if (!["pending", "approved", "rejected", "suspended"].includes(status)) throw new Error("Invalid seller status");

    const need: Permission = status === "approved" || status === "rejected" ? "APPROVE_SELLERS" : "SUSPEND_SELLERS";
    if (identity.user.role === "staff") await requirePermission(ctx, need);

    const rows = await db("SELECT * FROM sellers WHERE id = $1", [args.sellerId]);
    if (!rows[0]) throw new Error("Seller not found");
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
    if (!rows[0]) throw new Error("Product not found");
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
    if (identity.user.role !== "owner") throw new Error("เจ้าของบริษัทเท่านั้นที่ตั้งสิทธิ์พนักงานได้");
    const db = getDb();
    const user = await db("SELECT id, role FROM users WHERE id = $1", [args.userId]);
    if (!user[0]) throw new Error("User not found");

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
// misc: recompute seller balances from the ledger (owner only)
// ---------------------------------------------------------------------------
export const recomputeBalances = action({
  args: { sellerId: v.string() },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    if (identity.user.role !== "owner") throw new Error("Owner only");
    await recomputeSellerBalance(getDb(), args.sellerId);
    return { ok: true };
  },
});
