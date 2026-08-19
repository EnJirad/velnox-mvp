/**
 * Velnox — Customer Memory Core (pure logic, no Convex imports)
 *
 * docs/architecture/customer-memory.md
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

// ===========================================================================
// EVENT VOCABULARY — Complete list of recognized behavioral events
// ===========================================================================

export const ALL_EVENT_TYPES = [
  // Session
  "SESSION_START",
  "SESSION_END",
  "APP_OPEN",
  // Product
  "PRODUCT_VIEW",
  "PRODUCT_CLICK",
  "PRODUCT_IMAGE_VIEW",
  // Discovery
  "CATEGORY_VIEW",
  "STORE_VIEW",
  // Search
  "SEARCH",
  "SEARCH_RESULT_CLICK",
  // Cart
  "CART_ADD",
  "CART_REMOVE",
  "CART_VIEW",
  // Wishlist
  "WISHLIST_ADD",
  "WISHLIST_REMOVE",
  // Checkout / Purchase
  "CHECKOUT_START",
  "PURCHASE",
  "PURCHASE_CANCEL",
  "REPEAT_PURCHASE",
  // Interest
  "INTEREST",
  "REORDER",
  "VELREPEAT_START",
  "VELREPEAT_CANCEL",
  // Recommendations
  "RECOMMENDATION_VIEW",
  "RECOMMENDATION_CLICK",
  "RECOMMENDATION_IGNORE",
  // Notifications
  "NOTIFICATION_SENT",
  "NOTIFICATION_OPEN",
] as const;

export type BrainEventType = (typeof ALL_EVENT_TYPES)[number];

export const BRAIN_EVENT_SET = new Set<string>(ALL_EVENT_TYPES);

// ===========================================================================
// SCORING WEIGHTS — Centralized, configurable
// ===========================================================================

/**
 * Behavioural value of each event type when building Customer Memory.
 * Positive values increase affinity; negative values decrease it.
 * All numbers are tunable — change here, everywhere else recalculates.
 */
export const EVENT_WEIGHTS: Record<string, number> = {
  // Strongest positive signals
  PURCHASE: 12,
  REPEAT_PURCHASE: 15,
  VELREPEAT_START: 8,
  // Intent signals
  CART_ADD: 6,
  WISHLIST_ADD: 5,
  CHECKOUT_START: 4,
  INTEREST: 4,
  // Browsing signals
  PRODUCT_VIEW: 2,
  PRODUCT_CLICK: 2,
  PRODUCT_IMAGE_VIEW: 1.5,
  REORDER: 10,
  // Discovery signals
  SEARCH: 0.4,
  SEARCH_RESULT_CLICK: 1,
  STORE_VIEW: 0.3,
  CATEGORY_VIEW: 0.25,
  // Recommendation engagement
  RECOMMENDATION_CLICK: 3,
  RECOMMENDATION_VIEW: 0.5,
  // Negative signals
  CART_REMOVE: -2,
  WISHLIST_REMOVE: -2,
  PURCHASE_CANCEL: -5,
  RECOMMENDATION_IGNORE: -0.5,
};

// ===========================================================================
// TIME DECAY — Exponential half-life model
// ===========================================================================

/**
 * Recency half-life (days): strong signals fade slower than light ones.
 * After `halfLife` days, the signal strength is halved.
 */
export const EVENT_HALF_LIFE: Record<string, number> = {
  PURCHASE: 120,
  REPEAT_PURCHASE: 120,
  VELREPEAT_START: 120,
  REORDER: 120,
  CART_ADD: 90,
  WISHLIST_ADD: 90,
  CHECKOUT_START: 60,
  INTEREST: 60,
  PRODUCT_VIEW: 30,
  PRODUCT_CLICK: 30,
  PRODUCT_IMAGE_VIEW: 25,
  SEARCH: 45,
  SEARCH_RESULT_CLICK: 30,
  STORE_VIEW: 60,
  CATEGORY_VIEW: 45,
  RECOMMENDATION_CLICK: 45,
  RECOMMENDATION_VIEW: 20,
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

// ===========================================================================
// PURCHASE INTENT
// ===========================================================================

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

// ===========================================================================
// EVENT DEDUPLICATION
// ===========================================================================

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

// ===========================================================================
// PRODUCT AFFINITY — Score per product for a customer
// ===========================================================================

export interface ProductAffinityInput {
  productId: string;
  category?: string;
  shopId?: string;
}

/**
 * Compute product affinity score from a list of events.
 * Returns a map of productId → score (higher = more interested).
 */
export function computeProductAffinities(
  events: Array<{ type: string; entityId?: string; createdAt: number }>,
  now: number,
): Map<string, number> {
  const scores = new Map<string, number>();
  for (const e of events) {
    if (!e.entityId) continue;
    const w = eventWeight(e.type);
    if (w <= 0) continue; // skip session/neutral events
    const d = decay(e.type, e.createdAt, now);
    const current = scores.get(e.entityId) ?? 0;
    scores.set(e.entityId, current + w * d);
  }
  return scores;
}

// ===========================================================================
// CATEGORY AFFINITY — Score per category for a customer
// ===========================================================================

/**
 * Compute category affinity from events + product→category mapping.
 * Events without a category mapping (e.g. SEARCH) contribute via `searchCategories`.
 */
export function computeCategoryAffinities(
  events: Array<{ type: string; entityId?: string; value?: string; createdAt: number }>,
  productCategoryMap: Map<string, string>, // productId → category
  now: number,
): Map<string, number> {
  const scores = new Map<string, number>();
  for (const e of events) {
    const w = eventWeight(e.type);
    if (w <= 0) continue;
    const d = decay(e.type, e.createdAt, now);
    const contribution = w * d;

    // Direct category view
    if (e.type === "CATEGORY_VIEW" && e.value) {
      const current = scores.get(e.value) ?? 0;
      scores.set(e.value, current + contribution);
      continue;
    }

    // Product-based category
    if (e.entityId) {
      const category = productCategoryMap.get(e.entityId);
      if (category) {
        const current = scores.get(category) ?? 0;
        scores.set(category, current + contribution * 0.8);
      }
    }
  }
  return scores;
}

// ===========================================================================
// SHOP AFFINITY — Score per shop for a customer
// ===========================================================================

export function computeShopAffinities(
  events: Array<{ type: string; entityId?: string; createdAt: number }>,
  productShopMap: Map<string, string>, // productId → shopId
  now: number,
): Map<string, number> {
  const scores = new Map<string, number>();
  for (const e of events) {
    const w = eventWeight(e.type);
    if (w <= 0) continue;
    const d = decay(e.type, e.createdAt, now);
    const contribution = w * d;

    // Direct shop view
    if (e.type === "STORE_VIEW" && e.entityId) {
      const current = scores.get(e.entityId) ?? 0;
      scores.set(e.entityId, current + contribution);
      continue;
    }

    // Product-based shop
    if (e.entityId) {
      const shopId = productShopMap.get(e.entityId);
      if (shopId) {
        const current = scores.get(shopId) ?? 0;
        scores.set(shopId, current + contribution * 0.6);
      }
    }
  }
  return scores;
}

// ===========================================================================
// PURCHASE PATTERNS
// ===========================================================================

export interface PurchasePattern {
  productId: string;
  purchaseCount: number;
  averageIntervalDays: number | null;
  lastPurchasedAt: number;
  firstPurchasedAt: number;
}

/**
 * Compute purchase patterns from purchase events.
 * Returns per-product purchase statistics.
 */
export function computePurchasePatterns(
  purchaseEvents: Array<{ entityId?: string; createdAt: number }>,
): Map<string, PurchasePattern> {
  const byProduct = new Map<string, number[]>();
  for (const e of purchaseEvents) {
    if (!e.entityId) continue;
    const dates = byProduct.get(e.entityId) ?? [];
    dates.push(e.createdAt);
    byProduct.set(e.entityId, dates);
  }

  const patterns = new Map<string, PurchasePattern>();
  for (const [productId, dates] of byProduct) {
    const sorted = dates.sort((a, b) => a - b);
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      intervals.push((sorted[i] - sorted[i - 1]) / DAY_MS);
    }
    const avgInterval = intervals.length > 0
      ? Math.round(intervals.reduce((s, x) => s + x, 0) / intervals.length)
      : null;

    patterns.set(productId, {
      productId,
      purchaseCount: sorted.length,
      averageIntervalDays: avgInterval,
      lastPurchasedAt: sorted[sorted.length - 1],
      firstPurchasedAt: sorted[0],
    });
  }
  return patterns;
}

// ===========================================================================
// PRICE PREFERENCE — Analyze price ranges from viewed/purchased products
// ===========================================================================

export interface PricePreference {
  minPrice: number;
  maxPrice: number;
  averagePrice: number;
  medianPrice: number;
}

/**
 * Compute price preference from product events with price context.
 */
export function computePricePreference(
  eventsWithPrice: Array<{ type: string; price?: number; createdAt: number }>,
  now: number,
): PricePreference | null {
  const weightedPrices: Array<{ price: number; weight: number }> = [];
  for (const e of eventsWithPrice) {
    if (!e.price || e.price <= 0) continue;
    const w = eventWeight(e.type);
    if (w <= 0) continue;
    const d = decay(e.type, e.createdAt, now);
    weightedPrices.push({ price: e.price, weight: w * d });
  }

  if (weightedPrices.length === 0) return null;

  const prices = weightedPrices.map((x) => x.price).sort((a, b) => a - b);
  const totalWeight = weightedPrices.reduce((s, x) => s + x.weight, 0);
  const weightedSum = weightedPrices.reduce((s, x) => s + x.price * x.weight, 0);

  return {
    minPrice: prices[0],
    maxPrice: prices[prices.length - 1],
    averagePrice: Math.round(weightedSum / totalWeight),
    medianPrice: prices[Math.floor(prices.length / 2)],
  };
}

// ===========================================================================
// SIGNAL AGGREGATION — Combine all affinity types into a single memory
// ===========================================================================

export interface CustomerSignals {
  productAffinities: Array<{ productId: string; score: number }>;
  categoryAffinities: Array<{ category: string; score: number }>;
  shopAffinities: Array<{ shopId: string; score: number }>;
  purchasePatterns: Array<PurchasePattern>;
  pricePreference: PricePreference | null;
  intent: "low" | "medium" | "high";
  totalEvents: number;
  lastActivityAt: number;
}

/**
 * Aggregate all computed affinities into a single CustomerSignals object.
 * This is what gets persisted to the customer_signals table.
 */
export function aggregateSignals(params: {
  productAffinities: Map<string, number>;
  categoryAffinities: Map<string, number>;
  shopAffinities: Map<string, number>;
  purchasePatterns: Map<string, PurchasePattern>;
  pricePreference: PricePreference | null;
  intentCounts: IntentCounts;
  totalEvents: number;
  lastActivityAt: number;
}): CustomerSignals {
  const topProducts = Array.from(params.productAffinities.entries())
    .map(([productId, score]) => ({ productId, score: Math.round(score * 100) / 100 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 100); // cap at 100

  const topCategories = Array.from(params.categoryAffinities.entries())
    .map(([category, score]) => ({ category, score: Math.round(score * 100) / 100 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  const topShops = Array.from(params.shopAffinities.entries())
    .map(([shopId, score]) => ({ shopId, score: Math.round(score * 100) / 100 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  const patterns = Array.from(params.purchasePatterns.values())
    .sort((a, b) => b.purchaseCount - a.purchaseCount)
    .slice(0, 50);

  return {
    productAffinities: topProducts,
    categoryAffinities: topCategories,
    shopAffinities: topShops,
    purchasePatterns: patterns,
    pricePreference: params.pricePreference,
    intent: estimateIntent(params.intentCounts),
    totalEvents: params.totalEvents,
    lastActivityAt: params.lastActivityAt,
  };
}

// ===========================================================================
// SEARCH TERM MATCHING — Match search queries to products
// ===========================================================================

/**
 * Match a search query against product names (case-insensitive substring).
 * Returns product IDs that match, sorted by relevance.
 */
export function matchSearchToProducts(
  query: string,
  products: Array<{ id: string; name: string; category?: string }>,
): string[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return products
    .filter((p) => p.name.toLowerCase().includes(q))
    .map((p) => p.id);
}
