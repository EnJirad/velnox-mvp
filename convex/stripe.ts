/**
 * Velnox Backend — Stripe checkout actions (Phase 14 / spec §24, §58).
 *
 * The "online" payment method (card + PromptPay, THB) is a hosted Stripe
 * Checkout Session created SERVER-side. Every money number comes from our own
 * order rows — the client only supplies the parent order id and a return
 * path. Success is confirmed by the /stripe/webhook (idempotent + amount
 * checked); stripePaymentStatusAction is the client-side fallback for the
 * moment between returning from Stripe and the webhook landing.
 *
 * Required env (Convex deployment env — project Keys/API keys UI):
 *   STRIPE_SECRET_KEY · STRIPE_WEBHOOK_SECRET · SITE_URL (for return URLs)
 */
"use node";

import { serializedAction as action } from "./lib/serialize";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { getDb } from "../backend/db";
import { requireIdentity } from "../backend/identity";
import { AppError } from "../backend/errors";
import {
  createCheckoutSession,
  retrieveCheckoutSession,
  sessionPaid,
  stripeIsConfigured,
  stripeToThb,
} from "../backend/stripe";
import {
  confirmPaymentsForParentOrder,
  failPaymentsForParentOrder,
} from "../backend/payments";
import { createNotification } from "../backend/notifications";

/** Cheap probe so the storefront can hide the "online" option when Stripe is off. */
export const stripeConfiguredAction = action({
  args: {},
  handler: async () => stripeIsConfigured(),
});

/**
 * Create a Stripe Checkout Session for an order the caller owns. Accepts the
 * parent order id or any of its shop order ids (resolved to the parent — the
 * customer pays ONCE for the whole basket). Validates ownership + payment
 * state, sums the pending payment rows server-side (the session amount),
 * stores the session id on every pending payment row, and returns the hosted
 * checkout URL to redirect to.
 */
export const createStripeCheckoutAction = action({
  args: {
    orderId: v.string(),
    returnPath: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireIdentity(ctx);
    if (!stripeIsConfigured()) {
      throw new AppError(
        "INTERNAL_ERROR",
        "ชำระเงินออนไลน์ยังไม่พร้อมใช้งาน — กรุณาแจ้งผู้ดูแลระบบ (STRIPE_SECRET_KEY ยังไม่ตั้งค่า)",
      );
    }
    const db = getDb();
    const row = await db(
      "SELECT id, parent_order_id, customer_user_id FROM orders WHERE id = $1",
      [args.orderId],
    );
    if (!row[0] || row[0].customer_user_id !== user.id) {
      throw new AppError("ORDER_NOT_FOUND", "ออเดอร์นี้ไม่ใช่ของคุณ");
    }
    // Resolve to the parent order (a shop order carries its parent id).
    const parentOrderId = row[0].parent_order_id ?? row[0].id;
    const parent = await db(
      "SELECT id, order_number, total, payment_status FROM orders WHERE id = $1",
      [parentOrderId],
    );
    if (!parent[0]) throw new AppError("ORDER_NOT_FOUND", "ออเดอร์นี้ไม่ใช่ของคุณ");
    if (parent[0].payment_status === "paid") {
      throw new AppError("INVALID_STATUS_TRANSITION", "ออเดอร์นี้ชำระเงินแล้ว");
    }

    const pending = await db(
      `SELECT p.id, p.amount FROM payments p
       JOIN orders o ON o.id = p.order_id
       WHERE o.parent_order_id = $1 AND p.status = 'pending'`,
      [parentOrderId],
    );
    if (pending.length === 0) {
      throw new AppError("INVALID_STATUS_TRANSITION", "ไม่พบรายการชำระเงินที่รออยู่");
    }
    const total = pending.reduce((s, r) => s + Number(r.amount), 0);

    const base = (process.env.SITE_URL ?? "").replace(/\/$/, "");
    if (!base) {
      throw new AppError("INTERNAL_ERROR", "SITE_URL ยังไม่ได้ตั้งค่าใน Convex deployment env");
    }
    const returnPath = args.returnPath ?? `/orders?order=${parentOrderId}`;
    const sep = returnPath.includes("?") ? "&" : "?";

    const { sessionId, url } = await createCheckoutSession({
      parentOrderId,
      orderNumber: parent[0].order_number,
      total,
      customerEmail: user.email ?? null,
      successUrl: `${base}${returnPath}${sep}payment=success`,
      cancelUrl: `${base}${returnPath}${sep}payment=cancelled`,
    });

    // Attach the session reference to every pending payment of the parent
    // order — the webhook confirms them all together.
    await db(
      `UPDATE payments SET external_ref = $1
       WHERE id IN (
         SELECT p.id FROM payments p
         JOIN orders o ON o.id = p.order_id
         WHERE o.parent_order_id = $2 AND p.status = 'pending'
       )`,
      [sessionId, parentOrderId],
    );

    return { url, sessionId, parentOrderId };
  },
});

/**
 * Verify whether an order was actually paid at Stripe (client-side fallback
 * after returning from the hosted session, before the webhook lands).
 * Server-side source of truth: re-reads the session from Stripe and, when
 * paid, confirms the pending payments with the same idempotent + amount-
 * checked transaction the webhook uses.
 */
export const stripePaymentStatusAction = action({
  args: { parentOrderId: v.string() },
  handler: async (ctx, args) => {
    const { user } = await requireIdentity(ctx);
    const db = getDb();
    const order = await db(
      "SELECT id, customer_user_id, payment_status FROM orders WHERE id = $1",
      [args.parentOrderId],
    );
    if (!order[0] || order[0].customer_user_id !== user.id) {
      throw new AppError("ORDER_NOT_FOUND", "ออเดอร์นี้ไม่ใช่ของคุณ");
    }
    if (order[0].payment_status === "paid") return { paid: true, provider: "stripe" };
    if (!stripeIsConfigured()) return { paid: false, provider: "stripe" };

    const pending = await db(
      `SELECT p.external_ref FROM payments p
       JOIN orders o ON o.id = p.order_id
       WHERE o.parent_order_id = $1 AND p.status = 'pending'
       LIMIT 1`,
      [args.parentOrderId],
    );
    const sessionId = pending[0]?.external_ref;
    if (!sessionId) return { paid: false, provider: "stripe" };

    const session = await retrieveCheckoutSession(sessionId);
    if (sessionPaid(session)) {
      const confirmed = await confirmPaymentsForParentOrder({
        parentOrderId: args.parentOrderId,
        externalRef: session.id,
        totalAmount: stripeToThb(session.amount_total ?? 0),
        method: "online",
      });
      await notifyPaid(ctx, args.parentOrderId, confirmed.length);
      return { paid: true, provider: "stripe", confirmed: confirmed.length };
    }
    return { paid: false, provider: "stripe", status: session.status ?? "open" };
  },
});

/**
 * Applies a signature-VERIFIED Stripe webhook event (called from the edge
 * http route after verification — never trust an unverified caller).
 *   - checkout.session.completed (card) / async_payment_succeeded (PromptPay)
 *     → confirm the parent order's pending payments (idempotent + amount
 *     checked) and notify.
 *   - checkout.session.async_payment_failed → mark pending payments failed.
 * Events without Velnox metadata (foreign sessions) are ignored.
 */
export const handleStripeEvent = action({
  args: {
    type: v.string(),
    object: v.any(), // Stripe event data.object — shape validated per type below
  },
  handler: async (ctx, args) => {
    const type = args.type as string;
    const session = args.object as Record<string, unknown>;

    if (type === "checkout.session.completed" || type === "checkout.session.async_payment_succeeded") {
      const parentOrderId = (session.metadata as Record<string, unknown> | undefined)?.parentOrderId;
      if (typeof parentOrderId !== "string" || !parentOrderId) {
        // Foreign / test session without our metadata — acknowledge, never apply.
        return { applied: false, reason: "no parentOrderId metadata" };
      }
      const amountMinor = Number(session.amount_total ?? 0);
      const paid =
        type === "checkout.session.async_payment_succeeded" ||
        (session.status === "complete" && session.payment_status === "paid");
      if (!paid) {
        // Session completed but money not settled yet (async method) — Stripe
        // delivers async_payment_succeeded when PromptPay lands.
        return { applied: false, reason: "session not paid yet" };
      }
      const confirmed = await confirmPaymentsForParentOrder({
        parentOrderId,
        externalRef: String(session.id ?? ""),
        totalAmount: stripeToThb(amountMinor),
        method: "online",
      });
      if (confirmed.length > 0) {
        await notifyPaid(ctx, parentOrderId, confirmed.length);
      }
      return { applied: true, confirmed: confirmed.length };
    }

    if (type === "checkout.session.async_payment_failed") {
      const parentOrderId = (session.metadata as Record<string, unknown> | undefined)?.parentOrderId;
      if (typeof parentOrderId === "string" && parentOrderId) {
        await failPaymentsForParentOrder({ parentOrderId, reason: "async payment failed" });
        return { applied: true, failed: true };
      }
      return { applied: false, reason: "no parentOrderId metadata" };
    }

    return { applied: false, reason: `unhandled event ${type}` };
  },
});

/** Best-effort in-app notification + business event once an order is paid. */
export async function notifyPaid(
  ctx: import("./_generated/server").ActionCtx,
  parentOrderId: string,
  confirmedCount: number,
): Promise<void> {
  try {
    const db = getDb();
    const rows = await db(
      "SELECT customer_user_id FROM orders WHERE id = $1",
      [parentOrderId],
    );
    if (rows[0]?.customer_user_id) {
      await createNotification(db, {
        userId: rows[0].customer_user_id,
        type: "payment",
        title: "ชำระเงินสำเร็จ",
        message: `ออเดอร์ของคุณชำระเงินเรียบร้อยแล้ว (ชำระออนไลน์)`,
        data: { orderId: parentOrderId },
      });
    }
  } catch (err) {
    console.error("[stripe] notification failed:", err);
  }
  try {
    await ctx.runMutation(api.intelligence.recordBusinessEvent, {
      type: "PaymentConfirmed",
      entityId: parentOrderId,
      payload: { provider: "stripe", orders: confirmedCount },
    });
  } catch (err) {
    console.error("[stripe] business event failed:", err);
  }
}
