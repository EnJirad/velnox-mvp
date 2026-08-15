/**
 * Velnox Backend — Seller API (velseller) — Convex node actions.
 *
 * Seller-scoped actions: shipments, return handling, financial report and
 * payout requests. Ownership (seller owns the order line / shop) is enforced
 * server-side before any write.
 */
"use node";

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { getDb } from "../backend/db";
import { requireSeller, requireSellerForShop } from "../backend/identity";
import {
  addTrackingEvent,
  createShipment,
  listShipmentsForSeller,
} from "../backend/shipments";
import {
  listReturnsForSeller,
  sellerReturnStats,
  updateReturnStatus,
} from "../backend/returns";
import {
  listPayouts,
  requestPayout,
  sellerFinancialReport,
} from "../backend/finance";
import { audit } from "../backend/audit";
import type { ReturnStatus } from "../backend/types";

async function recordEvent(ctx: import("./_generated/server").ActionCtx, type: string, entityId: string, payload: Record<string, unknown> = {}) {
  try {
    await ctx.runMutation(api.intelligence.recordBusinessEvent, { type, entityId, payload });
  } catch (err) {
    console.error(`[seller] event ${type} failed:`, err);
  }
}

/** Verify the seller owns the order (at least one line) — shared guard. */
async function sellerOwnsOrder(ctx: import("./_generated/server").ActionCtx, orderId: string) {
  const { seller } = await requireSeller(ctx);
  const rows = await getDb()(
    "SELECT 1 FROM order_items WHERE order_id = $1 AND seller_id = $2 LIMIT 1",
    [orderId, seller.id],
  );
  if (!rows[0]) throw new Error("ออเดอร์นี้ไม่ใช่ของคุณ");
  return seller;
}

// ---------------------------------------------------------------------------
// shipments + tracking
// ---------------------------------------------------------------------------
export const myShipments = action({
  args: {},
  handler: async (ctx) => {
    const { seller } = await requireSeller(ctx);
    return listShipmentsForSeller(getDb(), seller.id);
  },
});

export const createShipmentAction = action({
  args: {
    orderId: v.string(),
    carrier: v.string(),
    trackingNumber: v.optional(v.string()),
    estimatedDeliveryDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const seller = await sellerOwnsOrder(ctx, args.orderId);
    const shipment = await createShipment(getDb(), {
      orderId: args.orderId,
      sellerId: seller.id,
      carrier: args.carrier,
      trackingNumber: args.trackingNumber ?? null,
      estimatedDeliveryDate: args.estimatedDeliveryDate ?? null,
    });
    await audit(getDb(), {
      actorId: seller.ownerUserId,
      actorRole: "seller",
      action: "SELLER_CREATED_SHIPMENT",
      entityType: "shipment",
      entityId: shipment.id,
      after: { orderId: args.orderId, carrier: args.carrier },
    });
    await recordEvent(ctx, "OrderShipped", args.orderId, { shipmentId: shipment.id, trackingNumber: shipment.trackingNumber });
    return shipment;
  },
});

export const addTrackingEventAction = action({
  args: { shipmentId: v.string(), status: v.string(), description: v.optional(v.string()), location: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { seller } = await requireSeller(ctx);
    const db = getDb();
    const rows = await db("SELECT id, seller_id FROM shipments WHERE id = $1", [args.shipmentId]);
    if (!rows[0] || rows[0].seller_id !== seller.id) throw new Error("shipment นี้ไม่ใช่ของคุณ");
    const event = await addTrackingEvent(db, args.shipmentId, {
      status: args.status,
      description: args.description ?? null,
      location: args.location ?? null,
    });
    await recordEvent(ctx, "ShipmentTrackingUpdated", args.shipmentId, { status: args.status });
    return event;
  },
});

// ---------------------------------------------------------------------------
// returns (seller side)
// ---------------------------------------------------------------------------
export const sellerReturns = action({
  args: {},
  handler: async (ctx) => {
    const { seller } = await requireSeller(ctx);
    return listReturnsForSeller(getDb(), seller.id);
  },
});

export const sellerReturnStatsAction = action({
  args: {},
  handler: async (ctx) => {
    const { seller } = await requireSeller(ctx);
    return sellerReturnStats(getDb(), seller.id);
  },
});

export const updateReturnStatusAction = action({
  args: { returnId: v.string(), status: v.string() },
  handler: async (ctx, args) => {
    const { seller } = await requireSeller(ctx);
    const db = getDb();
    const rows = await db("SELECT id, seller_id FROM returns WHERE id = $1", [args.returnId]);
    if (!rows[0] || rows[0].seller_id !== seller.id) throw new Error("คำขอคืนนี้ไม่ใช่ของคุณ");
    const updated = await updateReturnStatus(db, args.returnId, args.status as ReturnStatus);
    await audit(db, {
      actorId: seller.ownerUserId,
      actorRole: "seller",
      action: "SELLER_UPDATED_RETURN",
      entityType: "return",
      entityId: updated.id,
      after: { status: updated.status },
    });
    await recordEvent(ctx, "ReturnStatusChanged", updated.id, { status: updated.status });
    return updated;
  },
});

// ---------------------------------------------------------------------------
// finance (seller): report + payouts
// ---------------------------------------------------------------------------
export const sellerFinancialReportAction = action({
  args: {},
  handler: async (ctx) => {
    const { seller } = await requireSeller(ctx);
    return sellerFinancialReport(getDb(), seller.id);
  },
});

export const myPayouts = action({
  args: {},
  handler: async (ctx) => {
    const { seller } = await requireSeller(ctx);
    return listPayouts(getDb(), seller.id);
  },
});

export const requestPayoutAction = action({
  args: { amount: v.number(), method: v.optional(v.string()), destination: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { seller } = await requireSeller(ctx);
    const payout = await requestPayout(getDb(), {
      sellerId: seller.id,
      amount: args.amount,
      method: args.method ?? null,
      destination: args.destination ?? null,
    });
    await recordEvent(ctx, "PayoutRequested", payout.id, { amount: payout.amount });
    return payout;
  },
});

// ---------------------------------------------------------------------------
// shop helpers
// ---------------------------------------------------------------------------
export const updateShopLocation = action({
  args: {
    shopId: v.string(),
    latitude: v.number(),
    longitude: v.number(),
    placeId: v.optional(v.string()),
    address: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireSellerForShop(ctx, args.shopId);
    const db = getDb();
    await db(
      `UPDATE shops SET latitude = $2, longitude = $3, place_id = COALESCE($4, place_id),
         address = COALESCE($5, address)
       WHERE id = $1`,
      [args.shopId, args.latitude, args.longitude, args.placeId ?? null, args.address ?? null],
    );
    return { ok: true };
  },
});
