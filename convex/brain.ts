/**
 * Velnox Brain — Phase 1: Brain Foundation
 *
 * Central intelligence module that:
 * 1. Processes raw events into customer signals
 * 2. Computes product/category/shop affinities
 * 3. Detects purchase patterns
 * 4. Generates recommendations
 *
 * Architecture:
 *   Raw events → Validation → Normalization → Scoring → Aggregation → Signals
 *   Signals → Recommendation engine → Ranked recommendations
 *
 * This module is a node action ("use node") because it reads Neon commerce data
 * and writes to the customer_signals table in Neon.
 */
"use node";

import { v } from "convex/values";
import { serializedAction as action } from "./lib/serialize";
import type { ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import { getDb } from "../backend/db";
import {
  DAY_MS,
  computeProductAffinities,
  computeCategoryAffinities,
  computeShopAffinities,
  computePurchasePatterns,
  computePricePreference,
  aggregateSignals,
  eventWeight,
  decay,
  type IntentCounts,
  type CustomerSignals,
} from "../packages/shared/src/lib/customer-memory-core";
import { getProduct, listProducts } from "../backend/products";

// ===========================================================================
// BATCH SIGNAL COMPUTATION (called by cron)
// ===========================================================================

/**
 * Compute signals for a batch of active users. Called by the cron job every
 * 30 minutes. Processes users who have events since the last computation.
 * Uses a cursor to avoid reprocessing.
 */
export const computeSignalsBatch = action({
  args: {},
  handler: async (ctx: ActionCtx) => {
    const db = getDb();

    // Get computation cursor
    let lastComputedAt: Date;
    try {
      const cursorRows = await db("SELECT last_computed_at FROM signal_computation_cursor WHERE id = 1");
      lastComputedAt = cursorRows[0]
        ? new Date(cursorRows[0].last_computed_at)
        : new Date(0);
    } catch {
      lastComputedAt = new Date(0);
    }

    // Find users with events since last computation (limit to batch of 50)
    const since = lastComputedAt.getTime();
    const recentEvents = (await ctx.runQuery(api.memoryEvents._recentEventsSince, {
      since,
      limit: 5000,
    })) as Array<{ userId?: string; createdAt: number }>;

    // Extract unique user IDs
    const userIds = new Set<string>();
    for (const e of recentEvents) {
      if (e.userId) userIds.add(e.userId);
    }

    // Process each user (max 50 per batch to avoid timeout)
    const batch = Array.from(userIds).slice(0, 50);
    let processed = 0;

    for (const userId of batch) {
      try {
        await computeSignalsForUser(ctx, db, userId);
        processed++;
      } catch {
        // Skip failed users — they'll be retried next batch
      }
    }

    // Advance cursor
    const newCursor = batch.length > 0 ? Date.now() : lastComputedAt.getTime();
    await db(
      `INSERT INTO signal_computation_cursor (id, last_computed_at, updated_at)
       VALUES (1, $1, now())
       ON CONFLICT (id) DO UPDATE SET
         last_computed_at = GREATEST(signal_computation_cursor.last_computed_at, EXCLUDED.last_computed_at),
         updated_at = now()`,
      [new Date(newCursor).toISOString()],
    );

    return { processed, totalUsers: userIds.size };
  },
});

// ===========================================================================
// SINGLE USER SIGNAL COMPUTATION
// ===========================================================================

/**
 * Compute signals for a single user. Used by both the batch cron and
 * on-demand computation.
 */
export const computeSignals = action({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx: ActionCtx, args) => {
    const db = getDb();
    await computeSignalsForUser(ctx, db, args.userId);
    return { success: true };
  },
});

async function computeSignalsForUser(
  ctx: ActionCtx,
  db: ReturnType<typeof getDb>,
  userId: string,
): Promise<void> {
  // 1. Load user's events from Convex (last 2000 events)
  const rawEvents = (await ctx.runQuery(api.memoryEvents._recentEventsForUser, {
    userId: userId as Id<"users">,
    limit: 2000,
  })) as Array<{
    _id: string;
    type: string;
    entityId?: string;
    value?: string;
    context?: Record<string, unknown>;
    createdAt: number;
  }>;

  if (rawEvents.length === 0) return;

  const now = Date.now();

  // 2. Load product metadata from Neon for all referenced products
  const productIds = new Set<string>();
  for (const e of rawEvents) {
    if (e.entityId) productIds.add(e.entityId);
  }

  const productCategoryMap = new Map<string, string>();
  const productShopMap = new Map<string, string>();
  const productPriceMap = new Map<string, number>();

  for (const pid of productIds) {
    try {
      const product = await getProduct(db, pid);
      if (product) {
        productCategoryMap.set(pid, product.category);
        productShopMap.set(pid, product.shopId);
        productPriceMap.set(pid, product.price);
      }
    } catch {
      // Product may not exist in Neon — skip
    }
  }

  // 3. Compute affinities
  const productAffinities = computeProductAffinities(rawEvents, now);
  const categoryAffinities = computeCategoryAffinities(rawEvents, productCategoryMap, now);
  const shopAffinities = computeShopAffinities(rawEvents, productShopMap, now);

  // 4. Compute purchase patterns
  const purchaseEvents = rawEvents.filter(
    (e) => e.type === "PURCHASE" || e.type === "REPEAT_PURCHASE" || e.type === "REORDER",
  );
  const purchasePatterns = computePurchasePatterns(purchaseEvents);

  // 5. Compute price preference
  const eventsWithPrice = rawEvents
    .filter((e) => e.entityId && productPriceMap.has(e.entityId))
    .map((e) => ({
      type: e.type,
      price: productPriceMap.get(e.entityId!) ?? 0,
      createdAt: e.createdAt,
    }));
  const pricePreference = computePricePreference(eventsWithPrice, now);

  // 6. Compute intent counts
  const intentCounts: IntentCounts = {
    purchaseCount: 0,
    cartAddCount: 0,
    viewCount: 0,
    wishlistCount: 0,
    checkoutCount: 0,
  };
  for (const e of rawEvents) {
    switch (e.type) {
      case "PURCHASE":
      case "REPEAT_PURCHASE":
        intentCounts.purchaseCount++;
        break;
      case "CART_ADD":
        intentCounts.cartAddCount++;
        break;
      case "PRODUCT_VIEW":
        intentCounts.viewCount++;
        break;
      case "WISHLIST_ADD":
        intentCounts.wishlistCount++;
        break;
      case "CHECKOUT_START":
        intentCounts.checkoutCount++;
        break;
    }
  }

  // 7. Compute search terms
  const searchCount = new Map<string, { count: number; lastAt: number }>();
  for (const e of rawEvents) {
    if (e.type === "SEARCH" && e.value) {
      const q = e.value.trim().slice(0, 60);
      if (!q) continue;
      const existing = searchCount.get(q) ?? { count: 0, lastAt: 0 };
      existing.count++;
      existing.lastAt = Math.max(existing.lastAt, e.createdAt);
      searchCount.set(q, existing);
    }
  }
  const searchTerms = Array.from(searchCount.entries())
    .map(([query, data]) => ({ query, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // 8. Compute purchase frequency
  const purchaseTimestamps = purchaseEvents
    .map((e) => e.createdAt)
    .sort((a, b) => a - b);
  let purchaseFrequency: number | null = null;
  if (purchaseTimestamps.length >= 2) {
    const spanDays = (purchaseTimestamps[purchaseTimestamps.length - 1] - purchaseTimestamps[0]) / DAY_MS;
    if (spanDays > 0) {
      purchaseFrequency = Math.round((purchaseTimestamps.length / spanDays) * 30 * 100) / 100;
    }
  }

  // 9. Aggregate signals
  const signals = aggregateSignals({
    productAffinities,
    categoryAffinities,
    shopAffinities,
    purchasePatterns,
    pricePreference,
    intentCounts,
    totalEvents: rawEvents.length,
    lastActivityAt: rawEvents[0]?.createdAt ?? now,
  });

  // 10. Persist to Neon customer_signals
  await persistSignals(db, userId, signals, searchTerms, purchaseFrequency, purchaseTimestamps);
}

// ===========================================================================
// NEON PERSISTENCE
// ===========================================================================

async function persistSignals(
  db: ReturnType<typeof getDb>,
  userId: string,
  signals: CustomerSignals,
  searchTerms: Array<{ query: string; count: number; lastAt: number }>,
  purchaseFrequency: number | null,
  purchaseTimestamps: number[],
): Promise<void> {
  await db(
    `INSERT INTO customer_signals (
       user_id, product_affinities, category_affinities, shop_affinities,
       purchase_patterns, price_preference, purchase_frequency,
       last_purchased_at, first_purchased_at, total_purchases,
       current_intent, search_terms, total_events, last_activity_at,
       signal_version, computed_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now())
     ON CONFLICT (user_id) DO UPDATE SET
       product_affinities = EXCLUDED.product_affinities,
       category_affinities = EXCLUDED.category_affinities,
       shop_affinities = EXCLUDED.shop_affinities,
       purchase_patterns = EXCLUDED.purchase_patterns,
       price_preference = EXCLUDED.price_preference,
       purchase_frequency = EXCLUDED.purchase_frequency,
       last_purchased_at = EXCLUDED.last_purchased_at,
       first_purchased_at = EXCLUDED.first_purchased_at,
       total_purchases = EXCLUDED.total_purchases,
       current_intent = EXCLUDED.current_intent,
       search_terms = EXCLUDED.search_terms,
       total_events = EXCLUDED.total_events,
       last_activity_at = EXCLUDED.last_activity_at,
       signal_version = customer_signals.signal_version + 1,
       computed_at = now()`,
    [
      userId,
      JSON.stringify(signals.productAffinities),
      JSON.stringify(signals.categoryAffinities),
      JSON.stringify(signals.shopAffinities),
      JSON.stringify(signals.purchasePatterns),
      signals.pricePreference ? JSON.stringify(signals.pricePreference) : null,
      purchaseFrequency,
      purchaseTimestamps.length > 0
        ? new Date(purchaseTimestamps[purchaseTimestamps.length - 1]).toISOString()
        : null,
      purchaseTimestamps.length > 0
        ? new Date(purchaseTimestamps[0]).toISOString()
        : null,
      signals.purchasePatterns.reduce((s, p) => s + p.purchaseCount, 0),
      signals.intent,
      JSON.stringify(searchTerms),
      signals.totalEvents,
      signals.lastActivityAt ? new Date(signals.lastActivityAt).toISOString() : null,
      1,
    ],
  );
}

// ===========================================================================
// RECOMMENDATION ENGINE V1
// ===========================================================================

export interface RecommendationItem {
  productId: string;
  score: number;
  reason: string;
}

/**
 * Generate personalized recommendations for a customer.
 * Uses persisted signals from customer_signals table when available,
 * falls back to raw event computation.
 *
 * Strategies:
 *   1. High product affinity
 *   2. Category affinity
 *   3. Shop affinity
 *   4. Recently viewed (not yet purchased)
 *   5. Frequently purchased (repeat)
 *   6. Warm-up: marketplace popularity (for new users)
 */
export const getRecommendations = action({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx: ActionCtx, args) => {
    const db = getDb();
    const limit = args.limit ?? 8;

    // 1. Try to load persisted signals from Neon
    let signals: CustomerSignals | null = null;
    try {
      const rows = await db(
        `SELECT product_affinities, category_affinities, shop_affinities,
                purchase_patterns, price_preference, current_intent,
                total_events, last_activity_at
         FROM customer_signals WHERE user_id = $1`,
        [args.userId],
      );
      if (rows.length > 0) {
        const row = rows[0];
        signals = {
          productAffinities: JSON.parse(row.product_affinities ?? "[]"),
          categoryAffinities: JSON.parse(row.category_affinities ?? "[]"),
          shopAffinities: JSON.parse(row.shop_affinities ?? "[]"),
          purchasePatterns: JSON.parse(row.purchase_patterns ?? "[]"),
          pricePreference: row.price_preference ? JSON.parse(row.price_preference) : null,
          intent: row.current_intent ?? "low",
          totalEvents: row.total_events ?? 0,
          lastActivityAt: row.last_activity_at
            ? new Date(row.last_activity_at).getTime()
            : 0,
        };
      }
    } catch {
      // Signal table may not exist yet — fall back to raw computation
    }

    // 2. If no signals, compute from raw events
    if (!signals || signals.productAffinities.length === 0) {
      return await computeRecommendationsFromEvents(ctx, db, args.userId, limit);
    }

    // 3. Load catalog
    const catalog = await listProducts(db, { status: "published", limit: 200 });
    const catalogMap = new Map(catalog.map((p) => [p.id, p]));

    // 4. Score every catalog product using signals
    const purchasedIds = new Set(
      signals.purchasePatterns.map((p) => p.productId),
    );

    const items: RecommendationItem[] = [];

    for (const product of catalog) {
      if (product.price <= 0) continue;
      if (purchasedIds.has(product.id)) continue;

      let score = 0;
      const reasons: string[] = [];

      // Product affinity
      const prodAff = signals.productAffinities.find((p) => p.productId === product.id);
      if (prodAff) {
        score += prodAff.score;
        reasons.push("HIGH_PRODUCT_AFFINITY");
      }

      // Category affinity
      const catAff = signals.categoryAffinities.find((c) => c.category === product.category);
      if (catAff) {
        score += catAff.score * 0.6;
        reasons.push("CATEGORY_AFFINITY");
      }

      // Shop affinity
      const shopAff = signals.shopAffinities.find((s) => s.shopId === product.shopId);
      if (shopAff) {
        score += shopAff.score * 0.35;
        reasons.push("SHOP_AFFINITY");
      }

      // Price preference match
      if (signals.pricePreference) {
        const { minPrice, maxPrice } = signals.pricePreference;
        const range = maxPrice - minPrice;
        if (range > 0) {
          const deviation = Math.abs(product.price - signals.pricePreference.averagePrice) / range;
          if (deviation < 0.5) {
            score += 1;
            reasons.push("PRICE_MATCH");
          }
        }
      }

      if (score > 0) {
        items.push({
          productId: product.id,
          score: Math.round(score * 100) / 100,
          reason: reasons[0] ?? "PERSONALIZED",
        });
      }
    }

    // 5. Sort by score descending
    items.sort((a, b) => b.score - a.score);

    // 6. Warm-up: if fewer than 4 personal picks, top up with popular
    if (items.length < 4) {
      const popular = await getPopularProducts(db, limit - items.length, new Set(items.map((i) => i.productId)));
      items.push(...popular);
    }

    return items.slice(0, limit);
  },
});

/**
 * Fallback: compute recommendations from raw events when no persisted signals.
 */
async function computeRecommendationsFromEvents(
  ctx: ActionCtx,
  db: ReturnType<typeof getDb>,
  userId: string,
  limit: number,
): Promise<RecommendationItem[]> {
  const rawEvents = (await ctx.runQuery(api.memoryEvents._recentEventsForUser, {
    userId: userId as Id<"users">,
    limit: 500,
  })) as Array<{ type: string; entityId?: string; createdAt: number }>;

  if (rawEvents.length === 0) {
    return await getPopularProducts(db, limit, new Set());
  }

  const now = Date.now();
  const catalog = await listProducts(db, { status: "published", limit: 200 });
  const catalogMap = new Map(catalog.map((p) => [p.id, p]));

  const scores = new Map<string, number>();
  const purchasedIds = new Set<string>();

  for (const e of rawEvents) {
    if (!e.entityId) continue;
    const w = eventWeight(e.type);
    const d = decay(e.type, e.createdAt, now);
    const current = scores.get(e.entityId) ?? 0;
    scores.set(e.entityId, current + w * d);
    if (e.type === "PURCHASE" || e.type === "REPEAT_PURCHASE") {
      purchasedIds.add(e.entityId);
    }
  }

  const items: RecommendationItem[] = [];
  for (const [productId, score] of scores) {
    if (score <= 0) continue;
    if (purchasedIds.has(productId)) continue;
    if (!catalogMap.has(productId)) continue;
    items.push({
      productId,
      score: Math.round(score * 100) / 100,
      reason: "EVENT_SCORING",
    });
  }

  items.sort((a, b) => b.score - a.score);

  if (items.length < 4) {
    const popular = await getPopularProducts(db, limit - items.length, new Set(items.map((i) => i.productId)));
    items.push(...popular);
  }

  return items.slice(0, limit);
}

/**
 * Get popular products from Neon (last 30 days).
 */
async function getPopularProducts(
  db: ReturnType<typeof getDb>,
  limit: number,
  excludeIds: Set<string>,
): Promise<RecommendationItem[]> {
  try {
    const rows = await db(
      `SELECT entity_id, COUNT(*)::int as view_count
       FROM behavioral_events
       WHERE event_type = 'PRODUCT_VIEW'
         AND occurred_at >= now() - interval '30 days'
         AND entity_id IS NOT NULL
       GROUP BY entity_id
       ORDER BY view_count DESC
       LIMIT $1`,
      [limit + excludeIds.size],
    );

    const items: RecommendationItem[] = [];
    for (const row of rows) {
      if (items.length >= limit) break;
      if (excludeIds.has(row.entity_id)) continue;
      items.push({
        productId: row.entity_id,
        score: 1 + row.view_count * 0.1,
        reason: "MARKETPLACE_POPULAR",
      });
    }
    return items;
  } catch {
    return [];
  }
}

// ===========================================================================
// READ SIGNALS
// ===========================================================================

/**
 * Read pre-computed customer signals from Neon.
 * Returns null if no signals exist (user is new).
 */
export const getSignals = action({
  args: {
    userId: v.id("users"),
  },
  handler: async (_ctx: ActionCtx, args) => {
    const db = getDb();
    try {
      const rows = await db(
        `SELECT * FROM customer_signals WHERE user_id = $1`,
        [args.userId],
      );
      if (rows.length === 0) return null;
      const row = rows[0];
      return {
        productAffinities: JSON.parse(row.product_affinities ?? "[]"),
        categoryAffinities: JSON.parse(row.category_affinities ?? "[]"),
        shopAffinities: JSON.parse(row.shop_affinities ?? "[]"),
        purchasePatterns: JSON.parse(row.purchase_patterns ?? "[]"),
        pricePreference: row.price_preference ? JSON.parse(row.price_preference) : null,
        purchaseFrequency: row.purchase_frequency,
        avgOrderValue: row.avg_order_value,
        lastPurchasedAt: row.last_purchased_at,
        totalPurchases: row.total_purchases,
        intent: row.current_intent,
        searchTerms: JSON.parse(row.search_terms ?? "[]"),
        totalEvents: row.total_events,
        lastActivityAt: row.last_activity_at,
        computedAt: row.computed_at,
        signalVersion: row.signal_version,
      };
    } catch {
      return null;
    }
  },
});
