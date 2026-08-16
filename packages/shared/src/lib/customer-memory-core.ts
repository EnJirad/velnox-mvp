/**
 * Velnox — Customer Memory Core (pure logic, no Convex imports)
 *
 * docs/Velnox-CPNS.md · docs/CUSTOMER_MEMORY.md
 *
 * The deterministic heart of the Customer Memory engine. Everything here is
 * pure TypeScript so it can be unit-tested without a Convex runtime and reused
 * by both the node action (`src/convex/memory.ts`) and the event store
 * (`src/convex/memoryEvents.ts`).
 *
 * Pipeline (CPNS §6):
 *   RAW EVENTS → normalization → CUSTOMER MEMORY → INTEREST SCORING
 *   → PURCHASE INTENT → personalization → recommendation → smart assistance
 *
 * Two deliberately separate concepts (CPNS §10):
 *   - interestScore        — how much this customer likes something
 *   - purchaseIntent       — how likely they are to buy right now
 * A view is interest. A wishlist/cart/checkout/purchase is intent.
 */
export const DAY_MS = 24 * 60 * 60 * 1000;

/** Behavioural value of each event type when building Customer Memory (CPNS §10). */
export const EVENT_WEIGHTS: Record<string, number> = {
  PURCHASE: 12,
  VELREPEAT_START: 8,
  CART_ADD: 6,
  WISHLIST_ADD: 5,
  INTEREST: 4,
  PRODUCT_VIEW: 2,
  PRODUCT_CLICK: 1.5,
  SEARCH: 0.4, // applied via keyword match against product names
  SHOP_VIEW: 0.3, // applied via shop affinity
  CATEGORY_VIEW: 0.25, // applied via category affinity
};

/** Recency half-life (days): strong signals fade slower than light ones. */
export const EVENT_HALF_LIFE: Record<string, number> = {
  PURCHASE: 120,
  VELREPEAT_START: 120,
  CART_ADD: 90,
  WISHLIST_ADD: 90,
  INTEREST: 60,
  PRODUCT_VIEW: 30,
  PRODUCT_CLICK: 30,
  SEARCH: 45,
  SHOP_VIEW: 60,
  CATEGORY_VIEW: 45,
};

export const DEFAULT_HALF_LIFE_DAYS = 45;

/** Weight of an event type (0 when the type carries no interest signal). */
export function eventWeight(type: string): number {
  return EVENT_WEIGHTS[type] ?? 0;
}

/**
 * Time decay (CPNS §11) — exponential half-life model:
 *   RECENT INTEREST > OLD INTEREST.
 * At `createdAt` the weight is 1; after one half-life it is 0.5, etc.
 */
export function decay(type: string, createdAt: number, now: number): number {
  const ageDays = Math.max(0, (now - createdAt) / DAY_MS);
  return Math.pow(0.5, ageDays / (EVENT_HALF_LIFE[type] ?? DEFAULT_HALF_LIFE_DAYS));
}

/** Weighted + decayed contribution of one event to interest scoring. */
export function interestContribution(type: string, createdAt: number, now: number): number {
  return eventWeight(type) * decay(type, createdAt, now);
}

export interface IntentCounts {
  purchaseCount: number;
  cartAddCount: number;
  viewCount: number;
  wishlistCount: number;
  checkoutCount: number;
}

/**
 * Purchase intent (CPNS §10) — estimated from accumulated strong signals, never
 * from a single view. Weak browsing alone must never be read as buying intent.
 */
export function estimateIntent(counts: IntentCounts): "low" | "medium" | "high" {
  const { purchaseCount, cartAddCount, viewCount, wishlistCount, checkoutCount } = counts;
  if (
    purchaseCount >= 3 ||
    (cartAddCount >= 5 && viewCount >= 10) ||
    wishlistCount >= 3 ||
    checkoutCount >= 2
  ) {
    return "high";
  }
  if (purchaseCount > 0 || cartAddCount > 0 || wishlistCount > 0 || checkoutCount > 0) {
    return "medium";
  }
  return "low";
}

/** Stable identity key for deduplicating events of the same meaning. */
export function eventKey(type: string, entityId?: string, value?: string): string {
  return `${type}|${entityId ?? ""}|${value ?? ""}`;
}

export interface MergeCandidate {
  _id: string;
  type: string;
  entityId?: string;
  value?: string;
}

/**
 * Guest → account merge plan (CPNS §5 / §8). When a guest signs in, their
 * anonymous behavioural history is claimed by the account:
 *   - events the account already has (same type + entity + value) are DROPPED,
 *     so memory is never double-counted — the merge is idempotent and deduped;
 *   - everything else is merged into the account.
 * Pure + deterministic → unit-tested; the Convex mutation applies the plan.
 */
export function planAnonymousMerge(
  anonEvents: MergeCandidate[],
  userEvents: MergeCandidate[],
): { toMerge: MergeCandidate[]; toDrop: MergeCandidate[] } {
  const userKeys = new Set(userEvents.map((e) => eventKey(e.type, e.entityId, e.value)));
  const toMerge: MergeCandidate[] = [];
  const toDrop: MergeCandidate[] = [];
  for (const event of anonEvents) {
    const key = eventKey(event.type, event.entityId, event.value);
    if (userKeys.has(key)) {
      toDrop.push(event); // duplicate — never keep two copies of the same memory
      continue;
    }
    userKeys.add(key);
    toMerge.push(event);
  }
  return { toMerge, toDrop };
}
