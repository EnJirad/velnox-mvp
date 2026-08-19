/* eslint-disable @typescript-eslint/no-explicit-any -- DB row mappers */
/**
 * Velnox Backend — Smart Reorder intelligence (spec §14, §25–26).
 *
 * Everything is computed from REAL Neon data — the seller's own catalog +
 * inventory, and customer order history from orders/order_items. No legacy
 * Convex tables, no invented numbers:
 *
 *   purchaseCount        — how many customer orders contain this product
 *   unitsSold            — total quantity sold
 *   lastPurchaseAt       — most recent order date
 *   avgCycleDays         — mean gap between consecutive customer orders
 *                          (null until there are ≥ 2 orders)
 *   estimatedNextPurchase — last purchase + avg cycle (null when unknown)
 *   confidence           — high (≥4 orders) / medium (≥2) / low (1) /
 *                          not_enough_data (0)
 *
 * When there is not enough data the suggestion says so — we never invent a
 * prediction (spec §26).
 */
import type { Db } from "./db";
import { listProducts } from "./products";
import type { Product } from "./types";

export type ReorderConfidence = "high" | "medium" | "low" | "not_enough_data";

export interface ReorderSuggestion {
  product: Product;
  available: number;
  reorderLevel: number;
  lowStock: boolean;
  outOfStock: boolean;
  purchaseCount: number;
  unitsSold: number;
  lastPurchaseAt: string | null;
  avgCycleDays: number | null;
  estimatedNextPurchase: string | null;
  confidence: ReorderConfidence;
  /** needs attention now: out of stock / low stock / next purchase due ≤ 3 days */
  due: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function iso(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString();
}

function confidenceFor(orderCount: number): ReorderConfidence {
  if (orderCount >= 4) return "high";
  if (orderCount >= 2) return "medium";
  if (orderCount === 1) return "low";
  return "not_enough_data";
}

interface OrderStats {
  orderCount: number;
  unitsSold: number;
  lastOrderAt: string | null;
  /** ISO date strings, ascending — one per customer order containing the product */
  orderDates: string[];
}

/** Per-product customer order history for one seller (Neon orders/order_items). */
async function orderStatsByProduct(db: Db, sellerId: string): Promise<Map<string, OrderStats>> {
  const rows = await db(
    `SELECT oi.product_id,
            COUNT(DISTINCT o.id)::int AS order_count,
            COALESCE(SUM(oi.quantity), 0)::int AS units_sold,
            MAX(o.created_at) AS last_order_at
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE oi.seller_id = $1 AND o.status <> 'cancelled'
     GROUP BY oi.product_id`,
    [sellerId],
  );
  const stats = new Map<string, OrderStats>();
  for (const r of rows) {
    stats.set(r.product_id, {
      orderCount: Number(r.order_count),
      unitsSold: Number(r.units_sold),
      lastOrderAt: r.last_order_at ? iso(r.last_order_at) : null,
      orderDates: [],
    });
  }
  // Order timestamps (ascending) for the cycle calculation — only for
  // products that actually have order history.
  const ids = [...stats.keys()];
  if (ids.length === 0) return stats;
  const dateRows = await db(
    `SELECT oi.product_id, o.created_at
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE oi.seller_id = $1 AND o.status <> 'cancelled'
     ORDER BY o.created_at ASC`,
    [sellerId],
  );
  for (const r of dateRows) {
    const s = stats.get(r.product_id);
    if (s) s.orderDates.push(iso(r.created_at));
  }
  return stats;
}

/** Mean gap (days) between consecutive orders; null with < 2 orders. */
export function avgCycleDays(orderDates: string[]): number | null {
  if (orderDates.length < 2) return null;
  let total = 0;
  for (let i = 1; i < orderDates.length; i++) {
    total += (new Date(orderDates[i]).getTime() - new Date(orderDates[i - 1]).getTime()) / DAY_MS;
  }
  return Math.round(total / (orderDates.length - 1));
}

export async function sellerReorderSuggestions(db: Db, sellerId: string): Promise<ReorderSuggestion[]> {
  const products = await listProducts(db, { sellerId, limit: 500 });
  const stats = await orderStatsByProduct(db, sellerId);

  const suggestions: ReorderSuggestion[] = [];
  for (const product of products) {
    const available = product.inventory?.available ?? product.inventory?.quantity ?? 0;
    const reorderLevel = product.inventory?.reorderLevel ?? 0;
    const lowStock = available <= reorderLevel;
    const outOfStock = available <= 0;
    const st = stats.get(product.id) ?? {
      orderCount: 0,
      unitsSold: 0,
      lastOrderAt: null,
      orderDates: [],
    };
    const cycle = avgCycleDays(st.orderDates);
    let estimatedNextPurchase: string | null = null;
    if (cycle !== null && st.lastOrderAt) {
      const next = new Date(new Date(st.lastOrderAt).getTime() + cycle * DAY_MS);
      estimatedNextPurchase = next.toISOString();
    }
    const due =
      outOfStock ||
      lowStock ||
      (estimatedNextPurchase !== null &&
        new Date(estimatedNextPurchase).getTime() - Date.now() <= 3 * DAY_MS);

    suggestions.push({
      product,
      available,
      reorderLevel,
      lowStock,
      outOfStock,
      purchaseCount: st.orderCount,
      unitsSold: st.unitsSold,
      lastPurchaseAt: st.lastOrderAt,
      avgCycleDays: cycle,
      estimatedNextPurchase,
      confidence: confidenceFor(st.orderCount),
      due,
    });
  }

  // Urgency: due first, then soonest estimated next purchase, then low stock.
  suggestions.sort((a, b) => {
    if (a.due !== b.due) return a.due ? -1 : 1;
    const aNext = a.estimatedNextPurchase ? new Date(a.estimatedNextPurchase).getTime() : Number.MAX_SAFE_INTEGER;
    const bNext = b.estimatedNextPurchase ? new Date(b.estimatedNextPurchase).getTime() : Number.MAX_SAFE_INTEGER;
    if (aNext !== bNext) return aNext - bNext;
    if (a.lowStock !== b.lowStock) return a.lowStock ? -1 : 1;
    return b.unitsSold - a.unitsSold;
  });

  return suggestions;
}
