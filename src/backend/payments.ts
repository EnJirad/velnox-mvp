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
    paidAt: r.paid_at ?? null,
    createdAt: r.created_at,
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
    createdAt: r.created_at,
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
