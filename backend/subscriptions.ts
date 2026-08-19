/* eslint-disable @typescript-eslint/no-explicit-any -- DB row mappers */
/**
 * Velnox Backend — Subscriptions (VelRepeat)
 *
 * Commerce data lives in Neon (customer, product, shop, merchant, quantity,
 * price snapshot, frequency, next order date). The CONVEX side uses this data
 * for intelligence: purchase-cycle learning, reorder prediction, reminders.
 * Orders generated from subscriptions still go through createOrder().
 */
import { withTransaction, type Db } from "./db";
import { toMs } from "./dates";
import type { Subscription, SubscriptionFrequency, SubscriptionStatus } from "./types";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export class SubscriptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubscriptionError";
  }
}

function mapSubscription(r: Record<string, any>): Subscription {
  return {
    id: r.id,
    customerUserId: r.customer_user_id,
    productId: r.product_id,
    shopId: r.shop_id,
    sellerId: r.seller_id,
    quantity: Number(r.quantity),
    unitPriceSnapshot: Number(r.unit_price_snapshot),
    frequency: r.frequency,
    intervalDays: Number(r.interval_days),
    nextOrderDate: r.next_order_date instanceof Date
      ? r.next_order_date.toISOString().slice(0, 10)
      : String(r.next_order_date).slice(0, 10),
    status: r.status,
    createdAt: toMs(r.created_at),
    updatedAt: toMs(r.updated_at),
    productName: r.product_name ?? undefined,
    productImageUrl: r.product_image_url ?? undefined,
  };
}

export interface CreateSubscriptionInput {
  customerUserId: string;
  productId: string;
  quantity: number;
  frequency: SubscriptionFrequency;
  /** days between auto-orders (30 for monthly, 7 weekly, 1 daily) */
  intervalDays: number;
  nextOrderDate: string; // YYYY-MM-DD
  /** optional override; defaults to the product's current price (snapshot) */
  unitPriceSnapshot?: number;
}

/** Compute the next order date from a frequency + an anchor date. */
export function computeNextOrderDate(
  frequency: SubscriptionFrequency,
  from: Date,
  intervalDays?: number,
): string {
  // a custom interval must always be a positive number of days
  const custom = Math.max(1, Math.round(intervalDays ?? 30));
  const days = frequency === "daily" ? 1 : frequency === "weekly" ? 7 : frequency === "monthly" ? 30 : custom;
  const next = new Date(from);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

export async function createSubscription(db: Db, input: CreateSubscriptionInput): Promise<Subscription> {
  const product = await db(
    "SELECT p.id, p.shop_id, p.status, p.price, s.seller_id FROM products p JOIN shops s ON s.id = p.shop_id WHERE p.id = $1",
    [input.productId],
  );
  if (!product[0]) throw new SubscriptionError(`Product ${input.productId} not found`);
  if (product[0].status !== "published") throw new SubscriptionError("Product is not for sale");

  const unitPriceSnapshot = round2(input.unitPriceSnapshot ?? Number(product[0].price));
  const rows = await db(
    `INSERT INTO subscriptions
       (customer_user_id, product_id, shop_id, seller_id, quantity,
        unit_price_snapshot, frequency, interval_days, next_order_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      input.customerUserId,
      input.productId,
      product[0].shop_id,
      product[0].seller_id,
      input.quantity,
      unitPriceSnapshot,
      input.frequency,
      input.intervalDays,
      input.nextOrderDate,
    ],
  );
  return mapSubscription(rows[0]);
}

export async function listSubscriptions(db: Db, customerUserId?: string): Promise<Subscription[]> {
  if (customerUserId) {
    const rows = await db(
      `SELECT s.*, p.name AS product_name, pi.url AS product_image_url
       FROM subscriptions s
       JOIN products p ON p.id = s.product_id
       LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = true
       WHERE s.customer_user_id = $1
       ORDER BY s.created_at DESC`,
      [customerUserId],
    );
    return rows.map(mapSubscription);
  }
  const rows = await db(
    `SELECT s.*, p.name AS product_name, pi.url AS product_image_url
     FROM subscriptions s
     JOIN products p ON p.id = s.product_id
     LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = true
     ORDER BY s.created_at DESC`,
  );
  return rows.map(mapSubscription);
}

/** All subscriptions for one seller's products (velseller VelRepeat panel). */
export async function listSubscriptionsBySeller(db: Db, sellerId: string): Promise<Subscription[]> {
  const rows = await db(
    `SELECT s.*, p.name AS product_name, pi.url AS product_image_url,
            u.name AS customer_name, u.email AS customer_email
     FROM subscriptions s
     JOIN products p ON p.id = s.product_id
     LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = true
     LEFT JOIN users u ON u.id = s.customer_user_id
     WHERE s.seller_id = $1
     ORDER BY s.created_at DESC`,
    [sellerId],
  );
  return rows.map((r) => ({ ...mapSubscription(r), customerName: r.customer_name, customerEmail: r.customer_email }));
}

export async function getSubscription(db: Db, subscriptionId: string): Promise<Subscription | null> {
  const rows = await db(
    `SELECT s.*, p.name AS product_name, pi.url AS product_image_url
     FROM subscriptions s
     JOIN products p ON p.id = s.product_id
     LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = true
     WHERE s.id = $1 LIMIT 1`,
    [subscriptionId],
  );
  return rows[0] ? mapSubscription(rows[0]) : null;
}

export async function updateSubscriptionStatus(
  db: Db,
  subscriptionId: string,
  status: SubscriptionStatus,
): Promise<Subscription | null> {
  const rows = await db(
    `UPDATE subscriptions SET status = $2 WHERE id = $1 RETURNING *`,
    [subscriptionId, status],
  );
  return rows[0] ? mapSubscription(rows[0]) : null;
}

/**
 * Update a customer's VelRepeat settings (quantity / frequency / interval).
 * next_order_date is recomputed from today so a frequency change always
 * schedules the next auto-order in the future. Returns the updated row or
 * null when the subscription doesn't exist.
 */
export async function updateSubscriptionSettings(
  db: Db,
  subscriptionId: string,
  patch: { quantity?: number; frequency?: SubscriptionFrequency; intervalDays?: number },
): Promise<Subscription | null> {
  const existing = await db("SELECT * FROM subscriptions WHERE id = $1", [subscriptionId]);
  if (!existing[0]) return null;
  const sub = mapSubscription(existing[0]);

  const quantity = patch.quantity != null ? Math.max(1, Math.round(patch.quantity)) : sub.quantity;
  const frequency = patch.frequency ?? sub.frequency;
  const intervalDays = patch.intervalDays != null ? Math.max(1, Math.round(patch.intervalDays)) : sub.intervalDays;
  const nextOrderDate = computeNextOrderDate(frequency, new Date(), intervalDays);

  const rows = await db(
    `UPDATE subscriptions
     SET quantity = $2, frequency = $3, interval_days = $4, next_order_date = $5
     WHERE id = $1 RETURNING *`,
    [subscriptionId, quantity, frequency, intervalDays, nextOrderDate],
  );
  return rows[0] ? mapSubscription(rows[0]) : null;
}

export async function rescheduleSubscription(
  db: Db,
  subscriptionId: string,
  nextOrderDate: string,
): Promise<Subscription | null> {
  const rows = await db(
    `UPDATE subscriptions SET next_order_date = $2 WHERE id = $1 RETURNING *`,
    [subscriptionId, nextOrderDate],
  );
  return rows[0] ? mapSubscription(rows[0]) : null;
}

/**
 * Active subscriptions whose next order date has arrived — the VelRepeat
 * scheduler (Convex cron) polls this, then creates orders via createOrder().
 * When `sellerId` is given the query is scoped to that seller's subscriptions
 * so a seller-triggered run can never create orders for another seller's
 * products (authorization rule — "ของใคร ของมัน").
 */
export async function getDueSubscriptions(db: Db, onDate: string, sellerId?: string): Promise<Subscription[]> {
  const rows = await db(
    `SELECT s.*, p.name AS product_name, pi.url AS product_image_url
     FROM subscriptions s
     JOIN products p ON p.id = s.product_id
     LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = true
     WHERE s.status = 'active' AND s.next_order_date <= $1::date
       ${sellerId ? "AND s.seller_id = $2" : ""}
     ORDER BY s.next_order_date ASC`,
    sellerId ? [onDate, sellerId] : [onDate],
  );
  return rows.map(mapSubscription);
}

/** Advance next_order_date after an auto-order is created. */
export async function advanceSubscription(db: Db, subscriptionId: string): Promise<Subscription | null> {
  return withTransaction(async (tx) => {
    const row = await tx.query("SELECT * FROM subscriptions WHERE id = $1 FOR UPDATE", [subscriptionId]);
    if (!row.rows[0]) throw new SubscriptionError(`Subscription ${subscriptionId} not found`);
    const sub = mapSubscription(row.rows[0]);
    const next = computeNextOrderDate(sub.frequency, new Date(`${sub.nextOrderDate}T00:00:00`), sub.intervalDays);
    const updated = await tx.query(
      "UPDATE subscriptions SET next_order_date = $2 WHERE id = $1 RETURNING *",
      [subscriptionId, next],
    );
    return mapSubscription(updated.rows[0]);
  });
}
