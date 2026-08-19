// ---------------------------------------------------------------------------
// Velnox platform constants and helpers
// ---------------------------------------------------------------------------

/** Platform commission rate (10%) */
export const COMMISSION_RATE = 0.1;

/** Flat shipping fee in minor units (฿45) */
export const FLAT_SHIPPING_FEE = 4500;

/** Free-shipping threshold in minor units (฿1,000) */
export const FREE_SHIPPING_THRESHOLD = 100_000;

/** Currency code used throughout the platform */
export const CURRENCY = "THB";

/**
 * Compute the shipping fee for an order subtotal.
 * Free above the threshold, otherwise flat fee.
 */
export function computeShipping(subtotal: number): number {
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_FEE;
}

/**
 * Compute the platform commission for a given amount.
 */
export function computeCommission(amount: number): number {
  return Math.round(amount * COMMISSION_RATE);
}

/**
 * Allowed order-item status transitions (from → to[]).
 */
export const ORDER_ITEM_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
  REFUNDED: [],
};

/**
 * Derive an order-level status from its items.
 * The worst item status wins.
 */
export function deriveOrderStatus(
  itemStatuses: string[],
): string {
  const priority = [
    "CANCELLED",
    "REFUNDED",
    "PENDING",
    "CONFIRMED",
    "PROCESSING",
    "SHIPPED",
    "DELIVERED",
  ];
  let worst = "DELIVERED";
  for (const s of itemStatuses) {
    if (priority.indexOf(s) < priority.indexOf(worst)) {
      worst = s;
    }
  }
  return worst;
}

/**
 * Generate a simple order number: VL-YYYYMMDD-XXXX
 */
export function generateOrderNumber(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `VL-${date}-${rand}`;
}

/**
 * Generate an idempotency key from userId + timestamp.
 */
export function idempotencyKey(userId: string): string {
  return `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
