/* eslint-disable @typescript-eslint/no-explicit-any -- DB row mappers */
/**
 * Velnox Backend — Payments & Refunds
 *
 * recordPayment: success → order.payment_status = 'paid' (atomic).
 * refundPayment: inserts a refund + marks payment refunded (atomic).
 * On full refund, pending commissions for the order are voided.
 * The "return rate > 10% → platform pays only 10%" policy is applied at
 * settlement time (see ARCHITECTURE_V3_MIGRATION.md, Phase 4).
 */
import { withTransaction, type Db } from "./db";
import { toMs } from "./dates";
import type { Payment, PaymentMethod, PaymentRowStatus, Refund } from "./types";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentError";
  }
}

function mapPayment(r: Record<string, any>): Payment {
  return {
    id: r.id,
    orderId: r.order_id,
    amount: Number(r.amount),
    currency: r.currency,
    method: r.method,
    status: r.status,
    externalRef: r.external_ref ?? null,
    paidAt: r.paid_at != null ? toMs(r.paid_at) : null,
    createdAt: toMs(r.created_at),
  };
}

function mapRefund(r: Record<string, any>): Refund {
  return {
    id: r.id,
    orderId: r.order_id,
    paymentId: r.payment_id ?? null,
    amount: Number(r.amount),
    reason: r.reason ?? null,
    status: r.status,
    createdAt: toMs(r.created_at),
  };
}

export async function getPaymentsForOrder(db: Db, orderId: string): Promise<Payment[]> {
  const rows = await db("SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at DESC", [orderId]);
  return rows.map(mapPayment);
}

export async function getRefundsForOrder(db: Db, orderId: string): Promise<Refund[]> {
  const rows = await db("SELECT * FROM refunds WHERE order_id = $1 ORDER BY created_at DESC", [orderId]);
  return rows.map(mapRefund);
}

export interface RecordPaymentInput {
  orderId: string;
  amount: number;
  method: PaymentMethod;
  externalRef?: string | null;
  status?: PaymentRowStatus;
}

/**
 * Record a payment. When it succeeds, the order's payment_status flips to
 * 'paid' in the same transaction (commerce source of truth stays Neon).
 */
export async function recordPayment(input: RecordPaymentInput): Promise<Payment> {
  return withTransaction(async (tx) => {
    const order = await tx.query("SELECT id, total, payment_status FROM orders WHERE id = $1 FOR UPDATE", [
      input.orderId,
    ]);
    if (!order.rows[0]) throw new PaymentError(`Order ${input.orderId} not found`);
    if (order.rows[0].payment_status === "paid") {
      throw new PaymentError("Order is already paid");
    }
    // The recorded amount must match the order total exactly — a caller can
    // never book a payment for a different amount (spec: ห้ามเชื่อตัวเลขจาก
    // frontend — เงินคำนวณจาก server เท่านั้น).
    if (round2(input.amount) !== round2(Number(order.rows[0].total))) {
      throw new PaymentError("Payment amount does not match the order total");
    }

    const status = input.status ?? "pending";
    const paidAt = status === "succeeded" ? new Date().toISOString() : null;
    const payment = await tx.query(
      `INSERT INTO payments (order_id, amount, method, status, external_ref, paid_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [input.orderId, round2(input.amount), input.method, status, input.externalRef ?? null, paidAt],
    );

    if (status === "succeeded") {
      await tx.query(`UPDATE orders SET payment_status = 'paid' WHERE id = $1`, [input.orderId]);
    }
    return mapPayment(payment.rows[0]);
  });
}

export interface ConfirmParentPaymentsInput {
  parentOrderId: string;
  /** Gateway reference (Stripe session id / payment intent id). */
  externalRef: string;
  /** Total paid at the gateway, in THB (must equal the pending payments). */
  totalAmount: number;
  method: PaymentMethod;
}

/**
 * Stripe webhook / status check → confirm EVERY pending payment of a
 * multi-shop parent order in ONE transaction (the customer pays once for the
 * whole basket). Rules:
 *   - Idempotent: an already-paid parent has no pending rows → no-op, so
 *     webhook retries can never double-confirm or error.
 *   - Amount-checked: the gateway total must exactly match the sum of the
 *     pending payment rows, or the transaction aborts (never trust a number
 *     that did not come from our own server-side order math).
 *   - Each shop order flips to payment_status='paid' in the same tx.
 */
export async function confirmPaymentsForParentOrder(
  input: ConfirmParentPaymentsInput,
): Promise<Payment[]> {
  return withTransaction(async (tx) => {
    const rows = await tx.query(
      `SELECT p.id, p.order_id, p.amount, p.method, p.user_id, p.created_at, p.currency
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       WHERE o.parent_order_id = $1 AND p.status = 'pending'
       ORDER BY p.created_at ASC
       FOR UPDATE`,
      [input.parentOrderId],
    );
    if (rows.rows.length === 0) return []; // already confirmed / no pending rows

    const pendingTotal = round2(rows.rows.reduce((s, r) => s + Number(r.amount), 0));
    if (pendingTotal !== round2(input.totalAmount)) {
      throw new PaymentError(
        `Gateway amount ${input.totalAmount} does not match pending payments ${pendingTotal} for order ${input.parentOrderId}`,
      );
    }

    const confirmed: Payment[] = [];
    const paidAt = new Date().toISOString();
    for (const r of rows.rows) {
      await tx.query(
        `UPDATE payments SET status = 'succeeded', external_ref = $2, paid_at = $3 WHERE id = $1`,
        [r.id, input.externalRef, paidAt],
      );
      await tx.query(
        `UPDATE orders SET payment_status = 'paid' WHERE id = $1 AND payment_status <> 'paid'`,
        [r.order_id],
      );
      confirmed.push(
        mapPayment({
          id: r.id,
          order_id: r.order_id,
          amount: r.amount,
          currency: r.currency ?? "THB",
          method: input.method,
          status: "succeeded",
          external_ref: input.externalRef,
          paid_at: paidAt,
          created_at: r.created_at,
        }),
      );
    }
    return confirmed;
  });
}

/** Mark every pending payment of a parent order 'failed' (async payment failed). */
export async function failPaymentsForParentOrder(input: {
  parentOrderId: string;
  reason?: string | null;
}): Promise<void> {
  return withTransaction(async (tx) => {
    await tx.query(
      `UPDATE payments SET status = 'failed'
       WHERE id IN (
         SELECT p.id FROM payments p
         JOIN orders o ON o.id = p.order_id
         WHERE o.parent_order_id = $1 AND p.status = 'pending'
       )`,
      [input.parentOrderId],
    );
    await tx.query(
      `UPDATE orders SET payment_status = 'failed'
       WHERE parent_order_id = $1 AND payment_status IN ('pending','unpaid')`,
      [input.parentOrderId],
    );
  });
}

export interface RefundInput {
  orderId: string;
  amount: number;
  reason?: string | null;
}

/**
 * Refund a paid order. Marks the payment refunded; if the refund covers the
 * full order amount, pending commissions are voided (platform earns nothing
 * on returned goods).
 */
export async function refundPayment(input: RefundInput): Promise<Refund> {
  return withTransaction(async (tx) => {
    const order = await tx.query("SELECT id, total, payment_status FROM orders WHERE id = $1 FOR UPDATE", [
      input.orderId,
    ]);
    if (!order.rows[0]) throw new PaymentError(`Order ${input.orderId} not found`);
    if (order.rows[0].payment_status !== "paid") {
      throw new PaymentError("Only paid orders can be refunded");
    }

    const amount = round2(input.amount);
    const total = Number(order.rows[0].total);
    if (amount > total) throw new PaymentError("Refund amount exceeds order total");

    const payment = await tx.query(
      "SELECT id FROM payments WHERE order_id = $1 AND status = 'succeeded' ORDER BY created_at DESC LIMIT 1",
      [input.orderId],
    );
    const refund = await tx.query(
      `INSERT INTO refunds (order_id, payment_id, amount, reason, status)
       VALUES ($1, $2, $3, $4, 'processed')
       RETURNING *`,
      [input.orderId, payment.rows[0]?.id ?? null, amount, input.reason ?? null],
    );

    const refundedRows = await tx.query(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM refunds WHERE order_id = $1",
      [input.orderId],
    );
    const refundedTotal = Number(refundedRows.rows[0].total);

    if (refundedTotal >= total) {
      // full refund — no commission on returned goods
      await tx.query(`UPDATE commissions SET status = 'voided' WHERE order_id = $1 AND status = 'pending'`, [
        input.orderId,
      ]);
      await tx.query(`UPDATE orders SET payment_status = 'refunded', status = 'cancelled' WHERE id = $1`, [
        input.orderId,
      ]);
      await tx.query(`UPDATE payments SET status = 'refunded' WHERE order_id = $1`, [input.orderId]);
    } else {
      await tx.query(`UPDATE orders SET payment_status = 'partially_refunded' WHERE id = $1`, [input.orderId]);
    }

    return mapRefund(refund.rows[0]);
  });
}
