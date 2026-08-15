/* eslint-disable @typescript-eslint/no-explicit-any -- DB row mappers */
/**
 * Velnox Backend — Orders (Commerce Core heart)
 *
 * createOrder runs in ONE database transaction:
 *   1. idempotency check (retry-safe)
 *   2. lock product rows + validate published + read shop/merchant/rate
 *   3. reserve inventory (atomic, fails if insufficient)
 *   4. insert order (address snapshot frozen) + order_items (price snapshot)
 *   5. insert commission rows (3% default, snapshot of shop rate)
 *   6. optional pending payment row
 *
 * Business rules live HERE (server-side) — never in the frontend.
 */
import { withTransaction, type Db } from "./db";
import { resolveRules } from "./rules";
import type {
  AddressSnapshot,
  Order,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ShippingStatus,
} from "./types";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export class OrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderError";
  }
}

export interface CreateOrderItemInput {
  productId: string;
  quantity: number;
}

export interface CreateOrderInput {
  customerUserId: string;
  items: CreateOrderItemInput[];
  addressSnapshot: AddressSnapshot;
  /** unique per customer+cart — prevents duplicate orders when an action retries */
  idempotencyKey: string;
  shippingFee?: number;
  discount?: number;
  note?: string;
  shippingMethod?: string;
  paymentMethod?: PaymentMethod;
}

// ---------------------------------------------------------------------------
// mappers
// ---------------------------------------------------------------------------
function mapOrder(r: Record<string, any>): Order {
  return {
    id: r.id,
    orderNumber: r.order_number,
    customerUserId: r.customer_user_id,
    status: r.status,
    paymentStatus: r.payment_status,
    shippingStatus: r.shipping_status,
    shippingMethod: r.shipping_method ?? null,
    trackingNumber: r.tracking_number ?? null,
    subtotal: Number(r.subtotal),
    discount: Number(r.discount),
    shippingFee: Number(r.shipping_fee),
    total: Number(r.total),
    currency: r.currency,
    addressSnapshot:
      typeof r.address_snapshot === "string" ? JSON.parse(r.address_snapshot) : (r.address_snapshot ?? {}),
    note: r.note ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapOrderItem(r: Record<string, any>): OrderItem {
  return {
    id: r.id,
    orderId: r.order_id,
    productId: r.product_id,
    shopId: r.shop_id,
    sellerId: r.seller_id,
    productName: r.product_name,
    unit: r.unit,
    unitPrice: Number(r.unit_price),
    quantity: Number(r.quantity),
    subtotal: Number(r.subtotal),
    commissionRate: Number(r.commission_rate),
  };
}

// ---------------------------------------------------------------------------
// create order
// ---------------------------------------------------------------------------
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  if (input.items.length === 0) throw new OrderError("Order must contain at least one item");

  return withTransaction(async (tx) => {
    // 1. idempotency — same key = same order, never duplicate
    const dup = await tx.query("SELECT id FROM orders WHERE idempotency_key = $1", [input.idempotencyKey]);
    if (dup.rows[0]) {
      const existing = await tx.query("SELECT * FROM orders WHERE id = $1", [dup.rows[0].id]);
      const items = await tx.query("SELECT * FROM order_items WHERE order_id = $1", [dup.rows[0].id]);
      return attachItems(mapOrder(existing.rows[0]), items.rows.map(mapOrderItem));
    }

    // 2+3. validate product + reserve inventory per line
    const lines: Array<{
      productId: string;
      quantity: number;
      shopId: string;
      sellerId: string;
      name: string;
      unit: string;
      unitPrice: number;
      commissionRate: number;
      subtotal: number;
    }> = [];

    for (const item of input.items) {
      const product = await tx.query(
        `SELECT p.id, p.shop_id, p.name, p.unit, p.price, p.status,
                s.seller_id, s.commission_rate
         FROM products p
         JOIN shops s ON s.id = p.shop_id
         WHERE p.id = $1
         FOR UPDATE`,
        [item.productId],
      );
      if (!product.rows[0]) throw new OrderError(`Product ${item.productId} not found`);
      const p = product.rows[0];
      if (p.status !== "published") throw new OrderError(`Product ${p.name} is not for sale`);

      const reserved = await tx.query(
        `UPDATE inventory
         SET reserved_quantity = reserved_quantity + $2
         WHERE product_id = $1 AND quantity - reserved_quantity >= $2
         RETURNING quantity, reserved_quantity`,
        [item.productId, item.quantity],
      );
      if (!reserved.rows[0]) throw new OrderError(`สินค้า ${p.name} มีสต็อกไม่พอ (เหลือ ${0})`);

      const unitPrice = Number(p.price);
      lines.push({
        productId: item.productId,
        quantity: item.quantity,
        shopId: p.shop_id,
        sellerId: p.seller_id,
        name: p.name,
        unit: p.unit,
        unitPrice,
        commissionRate: Number(p.commission_rate),
        subtotal: round2(unitPrice * item.quantity),
      });
    }

    // 4. order totals + insert
    const subtotal = round2(lines.reduce((sum, l) => sum + l.subtotal, 0));
    const discount = round2(input.discount ?? 0);
    const shippingFee = round2(input.shippingFee ?? 0);
    const total = round2(subtotal - discount + shippingFee);
    if (total < 0) throw new OrderError("Order total cannot be negative");

    const order = await tx.query(
      `INSERT INTO orders
         (customer_user_id, status, payment_status, subtotal, discount, shipping_fee,
          total, address_snapshot, note, shipping_method, idempotency_key)
       VALUES ($1, 'pending', 'unpaid', $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        input.customerUserId,
        subtotal,
        discount,
        shippingFee,
        total,
        JSON.stringify(input.addressSnapshot),
        input.note ?? null,
        input.shippingMethod ?? null,
        input.idempotencyKey,
      ],
    );

    // 5. line items + commissions (snapshot everything)
    for (const l of lines) {
      const item = await tx.query(
        `INSERT INTO order_items
           (order_id, product_id, shop_id, seller_id, product_name, unit,
            unit_price, quantity, subtotal, commission_rate)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [order.rows[0].id, l.productId, l.shopId, l.sellerId, l.name, l.unit, l.unitPrice, l.quantity, l.subtotal, l.commissionRate],
      );
      await tx.query(
        `INSERT INTO commissions
           (order_item_id, order_id, seller_id, shop_id, order_amount, commission_rate, commission_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          item.rows[0].id,
          order.rows[0].id,
          l.sellerId,
          l.shopId,
          l.subtotal,
          l.commissionRate,
          round2(l.subtotal * l.commissionRate),
        ],
      );
    }

    // 6. optional payment record (COD / transfer → pending until confirmed)
    if (input.paymentMethod) {
      await tx.query(
        `INSERT INTO payments (order_id, amount, method, status)
         VALUES ($1, $2, $3, 'pending')`,
        [order.rows[0].id, total, input.paymentMethod],
      );
    }

    const items = await tx.query("SELECT * FROM order_items WHERE order_id = $1", [order.rows[0].id]);
    return attachItems(mapOrder(order.rows[0]), items.rows.map(mapOrderItem));
  });
}

function attachItems(order: Order, items: OrderItem[]): Order {
  order.items = items;
  return order;
}

// ---------------------------------------------------------------------------
// reads
// ---------------------------------------------------------------------------
export async function getOrder(db: Db, orderId: string): Promise<Order | null> {
  const rows = await db("SELECT * FROM orders WHERE id = $1 LIMIT 1", [orderId]);
  if (!rows[0]) return null;
  const items = await db("SELECT * FROM order_items WHERE order_id = $1", [orderId]);
  return attachItems(mapOrder(rows[0]), items.map(mapOrderItem));
}

export async function getOrderByNumber(db: Db, orderNumber: string): Promise<Order | null> {
  const rows = await db("SELECT * FROM orders WHERE order_number = $1 LIMIT 1", [orderNumber]);
  if (!rows[0]) return null;
  const items = await db("SELECT * FROM order_items WHERE order_id = $1", [rows[0].id]);
  return attachItems(mapOrder(rows[0]), items.map(mapOrderItem));
}

export async function listOrdersForCustomer(db: Db, customerUserId: string, limit = 50): Promise<Order[]> {
  const rows = await db(
    "SELECT * FROM orders WHERE customer_user_id = $1 ORDER BY created_at DESC LIMIT $2",
    [customerUserId, limit],
  );
  return rows.map(mapOrder);
}

export async function listOrdersForMerchant(db: Db, sellerId: string, limit = 50): Promise<Order[]> {
  return listOrdersForSeller(db, sellerId, limit);
}

/**
 * Orders for a seller: only orders containing the seller's products, with the
 * seller's own line items + customer contact details (from the frozen address
 * snapshot) so the seller can fulfill them.
 */
export async function listOrdersForSeller(db: Db, sellerId: string, limit = 50): Promise<Order[]> {
  const rows = await db(
    `SELECT DISTINCT o.*
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     WHERE oi.seller_id = $1
     ORDER BY o.created_at DESC
     LIMIT $2`,
    [sellerId, limit],
  );
  const orders = rows.map(mapOrder);
  for (const order of orders) {
    const items = await db(
      `SELECT * FROM order_items WHERE order_id = $1 AND seller_id = $2 ORDER BY created_at ASC`,
      [order.id, sellerId],
    );
    order.items = items.map(mapOrderItem);
    order.itemCount = order.items.reduce((s, i) => s + i.quantity, 0);
    const snap = order.addressSnapshot;
    order.customerName = snap.recipientName ?? "ลูกค้า";
    order.customerPhone = snap.phone ?? "";
  }
  return orders;
}

// ---------------------------------------------------------------------------
// status transitions
// ---------------------------------------------------------------------------
const ORDER_STATUSES: OrderStatus[] = ["pending", "confirmed", "shipped", "delivered", "completed", "cancelled"];
const PAYMENT_STATUSES: PaymentStatus[] = ["unpaid", "pending", "paid", "partially_refunded", "refunded", "failed"];
const SHIPPING_STATUSES: ShippingStatus[] = ["not_shipped", "processing", "shipped", "delivered", "returned"];

/**
 * Order state machine (spec §18):
 *   pending -> confirmed -> shipped -> delivered -> completed
 *   pending -> cancelled, confirmed -> cancelled
 *   shipped/delivered/completed -> cancelled is NOT allowed (use refund flow)
 * Pure helper — unit-tested in tests/. The DB-write path uses it too.
 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: ["completed"],
  completed: [],
  cancelled: [],
};

/** Whether `from -> to` is a legal transition (same status is a no-op). */
export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus): boolean {
  return from === to || ORDER_STATUS_TRANSITIONS[from]?.includes(to) === true;
}

export interface UpdateOrderInput {
  orderId: string;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  shippingStatus?: ShippingStatus;
  trackingNumber?: string;
}

/**
 * Update an order's status.
 * Moving to shipped/delivered/completed deducts reserved inventory (stock leaves).
 */
export async function updateOrderStatus(input: UpdateOrderInput): Promise<Order> {
  return withTransaction(async (tx) => {
    const current = await tx.query("SELECT * FROM orders WHERE id = $1 FOR UPDATE", [input.orderId]);
    if (!current.rows[0]) throw new OrderError(`Order ${input.orderId} not found`);
    const before = mapOrder(current.rows[0]);

    const status = input.status ?? before.status;
    const paymentStatus = input.paymentStatus ?? before.paymentStatus;
    const shippingStatus = input.shippingStatus ?? before.shippingStatus;
    if (!ORDER_STATUSES.includes(status)) throw new OrderError(`Invalid order status: ${status}`);
    if (!PAYMENT_STATUSES.includes(paymentStatus)) throw new OrderError(`Invalid payment status: ${paymentStatus}`);
    if (!SHIPPING_STATUSES.includes(shippingStatus)) throw new OrderError(`Invalid shipping status: ${shippingStatus}`);
    if (before.status === "cancelled") throw new OrderError("Order is already cancelled");

    // --- order state machine (spec §18) ---
    if (status !== before.status && !canTransitionOrderStatus(before.status, status)) {
      throw new OrderError(
        `Cannot move order from '${before.status}' to '${status}' — status transition not allowed`,
      );
    }

    const updated = await tx.query(
      `UPDATE orders
       SET status = $2, payment_status = $3, shipping_status = $4,
           tracking_number = COALESCE($5, tracking_number)
       WHERE id = $1
       RETURNING *`,
      [input.orderId, status, paymentStatus, shippingStatus, input.trackingNumber ?? null],
    );

    // stock leaves the warehouse when the order starts shipping
    const shipsNow = ["shipped", "delivered", "completed"].includes(status);
    const wasShipping = ["shipped", "delivered", "completed"].includes(before.status);
    if (shipsNow && !wasShipping) {
      const items = await tx.query(
        `SELECT product_id, quantity FROM order_items WHERE order_id = $1`,
        [input.orderId],
      );
      for (const it of items.rows) {
        await tx.query(
          `UPDATE inventory
           SET quantity = quantity - $2,
               reserved_quantity = GREATEST(reserved_quantity - $2, 0)
           WHERE product_id = $1`,
          [it.product_id, Number(it.quantity)],
        );
      }
    }

    return mapOrder(updated.rows[0]);
  });
}

/** Cancel an order: release reserved stock + void pending commissions. */
export async function cancelOrder(orderId: string): Promise<Order> {
  return withTransaction(async (tx) => {
    const current = await tx.query("SELECT * FROM orders WHERE id = $1 FOR UPDATE", [orderId]);
    if (!current.rows[0]) throw new OrderError(`Order ${orderId} not found`);
    const order = mapOrder(current.rows[0]);
    if (order.paymentStatus === "paid") {
      throw new OrderError("Cannot cancel a paid order — use the refund flow instead");
    }

    const items = await tx.query("SELECT product_id, quantity FROM order_items WHERE order_id = $1", [orderId]);
    for (const it of items.rows) {
      await tx.query(
        `UPDATE inventory
         SET reserved_quantity = GREATEST(reserved_quantity - $2, 0)
         WHERE product_id = $1`,
        [it.product_id, Number(it.quantity)],
      );
    }

    await tx.query(`UPDATE commissions SET status = 'voided' WHERE order_id = $1 AND status = 'pending'`, [orderId]);

    const updated = await tx.query(
      `UPDATE orders
       SET status = 'cancelled',
           payment_status = CASE WHEN payment_status = 'unpaid' OR payment_status = 'pending'
                                 THEN 'failed' ELSE payment_status END,
           shipping_status = 'not_shipped'
       WHERE id = $1
       RETURNING *`,
      [orderId],
    );
    return mapOrder(updated.rows[0]);
  });
}

// ---------------------------------------------------------------------------
// seller income report (velseller "รายได้")
// ---------------------------------------------------------------------------
// Commission % and the return coverage threshold are read from
// platform_settings (rules.ts) — NEVER hard-coded (spec §23/§34). This keeps
// velSeller's numbers identical to velCenter's finance report.

export interface SellerIncomeReport {
  gross: number;
  grossCount: number;
  returns: number;
  returnCount: number;
  commission: number;
  commissionRate: number;
  returnRate: number;
  returnCoverage: number;
  payout: number;
  transactions: Array<{
    order: Order;
    items: OrderItem[];
    subtotal: number;
    pending: boolean;
  }>;
}

/**
 * Seller income: gross completed sales, returned value, the platform
 * commission (from platform_settings) and the payout estimate under Velnox's
 * return policy (returns beyond the configured threshold are the seller's
 * responsibility). Only REAL returns count (status return_requested/returned)
 * — a cancelled order is not a return. All math is server-side, rounded to
 * 2 decimals — never trust frontend numbers.
 */
export async function sellerIncome(db: Db, sellerId: string, limit = 200): Promise<SellerIncomeReport> {
  const rules = await resolveRules(db);
  const commissionPercent = rules.platformCommissionPercent;
  const thresholdPercent = rules.returnRateThreshold;

  const rows = await db(
    `SELECT DISTINCT o.*
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     WHERE oi.seller_id = $1
     ORDER BY o.created_at DESC
     LIMIT $2`,
    [sellerId, limit],
  );

  let gross = 0;
  let grossCount = 0;
  let returns = 0;
  let returnCount = 0;
  const transactions: SellerIncomeReport["transactions"] = [];

  for (const r of rows) {
    const order = mapOrder(r);
    const items = await db(
      `SELECT * FROM order_items WHERE order_id = $1 AND seller_id = $2 ORDER BY created_at ASC`,
      [order.id, sellerId],
    );
    const mine = items.map(mapOrderItem);
    if (mine.length === 0) continue;
    const subtotal = round2(mine.reduce((s, i) => s + i.subtotal, 0));
    const qty = mine.reduce((s, i) => s + i.quantity, 0);

    // compare against the raw row: the typed OrderStatus union is narrower
    // than the DB enum which also allows return_requested/returned
    if (r.status === "return_requested" || r.status === "returned") {
      returns += subtotal;
      returnCount += qty;
    } else if (order.status === "completed") {
      gross += subtotal;
      grossCount += qty;
      transactions.push({ order, items: mine, subtotal, pending: false });
    } else {
      transactions.push({ order, items: mine, subtotal, pending: true });
    }
  }

  gross = round2(gross);
  returns = round2(returns);
  const commission = round2((gross * commissionPercent) / 100);
  const totalOrdered = gross + returns;
  const returnRate = totalOrdered > 0 ? round2(returns / totalOrdered) : 0;
  const returnCoverage = round2(Math.min(returns, (gross * thresholdPercent) / 100));
  const payout = round2(gross - commission - (returns - returnCoverage));

  transactions.sort((a, b) => (a.order.createdAt < b.order.createdAt ? 1 : -1));

  return {
    gross,
    grossCount,
    returns,
    returnCount,
    commission,
    commissionRate: round2(commissionPercent / 100),
    returnRate,
    returnCoverage,
    payout,
    transactions: transactions.slice(0, 20),
  };
}
