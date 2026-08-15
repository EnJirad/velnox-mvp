/**
 * Velnox Backend — Returns (spec §22–23, §29–30, §39–40).
 *
 * Request -> under_review -> approved -> return_shipping -> received ->
 * refunding -> refunded  (or rejected / cancelled).
 * Return rate + penalty math is pure and unit-tested (see rules.ts); the
 * seller's excess return cost is applied at settlement in finance.ts.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- DB row mappers */
import type { Db } from "./db";
import { AppError, invalidTransition } from "./errors";
import { returnInputSchema } from "./validation";
import { calcReturnRatePercent, round2 } from "./rules";
import type { ReturnRequest, ReturnStatus } from "./types";

export const RETURN_FLOW: Record<ReturnStatus, ReturnStatus[]> = {
  requested: ["under_review", "cancelled"],
  under_review: ["approved", "rejected"],
  approved: ["return_shipping", "cancelled"],
  return_shipping: ["received"],
  received: ["refunding"],
  refunding: ["refunded"],
  refunded: [],
  rejected: [],
  cancelled: [],
};

function mapReturn(r: Record<string, any>): ReturnRequest {
  const evidence = Array.isArray(r.evidence_urls) ? r.evidence_urls : [];
  return {
    id: r.id,
    orderId: r.order_id,
    customerUserId: r.customer_user_id,
    sellerId: r.seller_id,
    reason: r.reason ?? null,
    description: r.description ?? null,
    evidenceUrls: evidence,
    status: r.status,
    refundAmount: Number(r.refund_amount),
    returnTrackingNumber: r.return_tracking_number ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export interface RequestReturnInput {
  customerUserId: string;
  orderId: string;
  items: Array<{ orderItemId: string; quantity: number }>;
  reason: string;
  description?: string | null;
  evidenceUrls?: string[];
}

/**
 * Request a return. Validates the order belongs to the customer, the items are
 * the customer's line items, quantities are within the ordered quantity, and
 * the order is in a returnable state.
 */
export async function requestReturn(db: Db, input: RequestReturnInput): Promise<ReturnRequest> {
  const parsed = returnInputSchema.parse({
    orderId: input.orderId,
    items: input.items,
    reason: input.reason,
    description: input.description ?? null,
    evidenceUrls: input.evidenceUrls ?? [],
  });

  const order = await db(
    `SELECT o.*, oi.seller_id AS line_seller, oi.id AS order_item_id, oi.quantity AS ordered_qty, oi.product_name
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     WHERE o.id = $1 AND o.customer_user_id = $2
       AND o.status IN ('delivered','completed','return_requested')
     ORDER BY oi.created_at ASC`,
    [parsed.orderId, input.customerUserId],
  );
  if (order.length === 0) {
    throw new AppError("FORBIDDEN", "ไม่พบออเดอร์ที่คืนได้ (ต้องส่งถึงมือแล้ว)");
  }
  const sellerId = order[0].line_seller;
  const orderedByItem = new Map<string, number>();
  for (const r of order) orderedByItem.set(r.order_item_id, Number(r.ordered_qty));

  // validate requested quantities against ordered quantities
  for (const it of parsed.items) {
    const ordered = orderedByItem.get(it.orderItemId);
    if (ordered === undefined) throw new AppError("INVALID_INPUT", "สินค้าที่ขอคืนไม่อยู่ในออเดอร์นี้");
    if (it.quantity > ordered) throw new AppError("INVALID_INPUT", `จำนวนคืนเกินจำนวนที่สั่ง (${ordered})`);
  }

  const refundAmount = round2(
    parsed.items.reduce((sum, it) => {
      const row = order.find((r) => r.order_item_id === it.orderItemId);
      return sum + Number(row.unit_price) * it.quantity;
    }, 0),
  );

  const rows = await db(
    `INSERT INTO returns (order_id, customer_user_id, seller_id, reason, description, evidence_urls, status, refund_amount)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'requested', $7)
     RETURNING *`,
    [
      parsed.orderId,
      input.customerUserId,
      sellerId,
      parsed.reason,
      parsed.description ?? null,
      JSON.stringify(parsed.evidenceUrls),
      refundAmount,
    ],
  );

  for (const it of parsed.items) {
    await db(
      `INSERT INTO return_items (return_id, order_item_id, quantity, reason)
       VALUES ($1, $2, $3, $4)`,
      [rows[0].id, it.orderItemId, it.quantity, parsed.reason],
    );
  }

  await db("UPDATE orders SET status = 'return_requested' WHERE id = $1", [parsed.orderId]);
  return mapReturn(rows[0]);
}

/** Advance a return through its state machine (seller/admin only — caller checks). */
export async function updateReturnStatus(db: Db, returnId: string, next: ReturnStatus): Promise<ReturnRequest> {
  const rows = await db("SELECT * FROM returns WHERE id = $1", [returnId]);
  if (!rows[0]) throw new AppError("NOT_FOUND", "ไม่พบคำขอคืนสินค้า");
  const current = mapReturn(rows[0]);

  if (next !== current.status) {
    const allowed = RETURN_FLOW[current.status] ?? [];
    if (!allowed.includes(next)) {
      throw invalidTransition(`ไม่สามารถเปลี่ยนสถานะคืนสินค้าจาก '${current.status}' เป็น '${next}'`);
    }
  }

  const updated = await db(
    `UPDATE returns SET status = $2, updated_at = now(),
       return_tracking_number = CASE WHEN $2 = 'return_shipping' THEN COALESCE(return_tracking_number, '') ELSE return_tracking_number END
     WHERE id = $1
     RETURNING *`,
    [returnId, next],
  );
  return mapReturn(updated[0]);
}

export async function listReturnsForSeller(db: Db, sellerId: string, limit = 50): Promise<ReturnRequest[]> {
  const rows = await db(
    "SELECT * FROM returns WHERE seller_id = $1 ORDER BY created_at DESC LIMIT $2",
    [sellerId, limit],
  );
  return rows.map(mapReturn);
}

export async function listReturnsForCustomer(db: Db, customerUserId: string, limit = 50): Promise<ReturnRequest[]> {
  const rows = await db(
    "SELECT * FROM returns WHERE customer_user_id = $1 ORDER BY created_at DESC LIMIT $2",
    [customerUserId, limit],
  );
  return rows.map(mapReturn);
}

export async function getReturn(db: Db, returnId: string): Promise<ReturnRequest | null> {
  const rows = await db("SELECT * FROM returns WHERE id = $1", [returnId]);
  return rows[0] ? mapReturn(rows[0]) : null;
}

/** Seller return-rate stats (spec §23, §39). */
export async function sellerReturnStats(db: Db, sellerId: string): Promise<{ completedOrders: number; returnedOrders: number; returnRatePercent: number }> {
  const completed = await db(
    `SELECT COUNT(DISTINCT order_id)::int AS n FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE oi.seller_id = $1 AND o.status = 'completed'`,
    [sellerId],
  );
  const returned = await db(
    `SELECT COUNT(DISTINCT order_id)::int AS n FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE oi.seller_id = $1 AND o.status IN ('return_requested','returned')`,
    [sellerId],
  );
  const completedOrders = Number(completed[0].n);
  const returnedOrders = Number(returned[0].n);
  return { completedOrders, returnedOrders, returnRatePercent: calcReturnRatePercent(returnedOrders, completedOrders) };
}
