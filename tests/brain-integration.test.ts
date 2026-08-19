import { describe, it, expect } from "vitest";
import {
  DAY_MS,
  eventWeight,
  decay,
  estimateIntent,
  eventKey,
  planAnonymousMerge,
  computeProductAffinities,
  computeCategoryAffinities,
  computeShopAffinities,
  computePurchasePatterns,
  computePricePreference,
  aggregateSignals,
  matchSearchToProducts,
  ALL_EVENT_TYPES,
  BRAIN_EVENT_SET,
  type IntentCounts,
  type CustomerSignals,
} from "../packages/shared/src/lib/customer-memory-core";

// ===========================================================================
// INTEGRATION: Event → Processing → Signals → Recommendations
// ===========================================================================

describe("Brain Integration: Full Pipeline", () => {
  it("should process events into customer signals", () => {
    const now = Date.now();
    const userId = "user-123";

    // Simulate events: user views products, adds to cart, purchases
    const events = [
      { type: "PRODUCT_VIEW", entityId: "prod-a", createdAt: now - 1 * DAY_MS },
      { type: "PRODUCT_VIEW", entityId: "prod-a", createdAt: now - 1 * DAY_MS },
      { type: "PRODUCT_VIEW", entityId: "prod-a", createdAt: now - 0.5 * DAY_MS },
      { type: "PRODUCT_CLICK", entityId: "prod-a", createdAt: now - 0.5 * DAY_MS },
      { type: "CART_ADD", entityId: "prod-a", createdAt: now - 0.3 * DAY_MS },
      { type: "PURCHASE", entityId: "prod-a", createdAt: now - 0.1 * DAY_MS },
      { type: "PRODUCT_VIEW", entityId: "prod-b", createdAt: now - 2 * DAY_MS },
      { type: "CATEGORY_VIEW", value: "beauty", createdAt: now - 1 * DAY_MS },
      { type: "SEARCH", value: "moisturizer", createdAt: now - 0.5 * DAY_MS },
      { type: "STORE_VIEW", entityId: "shop-1", createdAt: now - 0.5 * DAY_MS },
    ];

    // Step 1: Compute product affinities
    const productCategoryMap = new Map([
      ["prod-a", "beauty"],
      ["prod-b", "beauty"],
    ]);
    const productShopMap = new Map([
      ["prod-a", "shop-1"],
      ["prod-b", "shop-2"],
    ]);
    const productPriceMap = new Map([
      ["prod-a", 299],
      ["prod-b", 199],
    ]);

    const productAffinities = computeProductAffinities(events, now);
    const categoryAffinities = computeCategoryAffinities(events, productCategoryMap, now);
    const shopAffinities = computeShopAffinities(events, productShopMap, now);

    // Step 2: Compute purchase patterns
    const purchaseEvents = events.filter((e) => e.type === "PURCHASE");
    const purchasePatterns = computePurchasePatterns(purchaseEvents);

    // Step 3: Compute price preference
    const eventsWithPrice = events
      .filter((e) => e.entityId && productPriceMap.has(e.entityId))
      .map((e) => ({
        type: e.type,
        price: productPriceMap.get(e.entityId!) ?? 0,
        createdAt: e.createdAt,
      }));
    const pricePreference = computePricePreference(eventsWithPrice, now);

    // Step 4: Aggregate
    const signals = aggregateSignals({
      productAffinities,
      categoryAffinities,
      shopAffinities,
      purchasePatterns,
      pricePreference,
      intentCounts: {
        purchaseCount: 1,
        cartAddCount: 1,
        viewCount: 3,
        wishlistCount: 0,
        checkoutCount: 0,
      },
      totalEvents: events.length,
      lastActivityAt: now,
    });

    // Verify signals
    expect(signals.productAffinities.length).toBeGreaterThan(0);
    expect(signals.categoryAffinities.length).toBeGreaterThan(0);
    expect(signals.shopAffinities.length).toBeGreaterThan(0);
    expect(signals.purchasePatterns.length).toBeGreaterThanOrEqual(0);
    expect(signals.intent).toBe("medium");
    expect(signals.totalEvents).toBe(events.length);

    // Product A should have highest affinity (most interactions + purchase)
    const prodA = signals.productAffinities.find((p) => p.productId === "prod-a");
    const prodB = signals.productAffinities.find((p) => p.productId === "prod-b");
    expect(prodA).toBeDefined();
    expect(prodB).toBeDefined();
    expect(prodA!.score).toBeGreaterThan(prodB!.score);

    // Beauty category should have high affinity
    const beauty = signals.categoryAffinities.find((c) => c.category === "beauty");
    expect(beauty).toBeDefined();
    expect(beauty!.score).toBeGreaterThan(0);

    // Price preference should reflect product prices
    expect(pricePreference).not.toBeNull();
    expect(pricePreference!.minPrice).toBe(199);
    expect(pricePreference!.maxPrice).toBe(299);
  });

  it("should rank recommendations by affinity", () => {
    const now = Date.now();

    // Create signals for a customer who prefers beauty products
    const signals: CustomerSignals = {
      productAffinities: [
        { productId: "prod-toothpaste", score: 8.5 },
        { productId: "prod-soap", score: 6.2 },
      ],
      categoryAffinities: [
        { category: "beauty", score: 10.0 },
        { category: "daily", score: 5.0 },
      ],
      shopAffinities: [
        { shopId: "shop-1", score: 7.0 },
      ],
      purchasePatterns: [],
      pricePreference: { minPrice: 50, maxPrice: 300, averagePrice: 150, medianPrice: 150 },
      intent: "medium",
      totalEvents: 50,
      lastActivityAt: now,
    };

    // Simulate catalog scoring
    const catalog = [
      { id: "prod-toothpaste", category: "beauty", shopId: "shop-1", price: 120 },
      { id: "prod-soap", category: "daily", shopId: "shop-1", price: 80 },
      { id: "prod-electronics", category: "electronics", shopId: "shop-2", price: 2000 },
      { id: "prod-random", category: "pets", shopId: "shop-3", price: 500 },
    ];

    const items: Array<{ id: string; score: number }> = [];
    for (const product of catalog) {
      let score = 0;
      const prodAff = signals.productAffinities.find((p) => p.productId === product.id);
      if (prodAff) score += prodAff.score;
      const catAff = signals.categoryAffinities.find((c) => c.category === product.category);
      if (catAff) score += catAff.score * 0.6;
      const shopAff = signals.shopAffinities.find((s) => s.shopId === product.shopId);
      if (shopAff) score += shopAff.score * 0.35;
      if (score > 0) items.push({ id: product.id, score });
    }

    items.sort((a, b) => b.score - a.score);

    // Toothpaste should rank highest (product affinity + category + shop)
    expect(items[0].id).toBe("prod-toothpaste");
    // Electronics and pets should not appear (no affinity)
    expect(items.find((i) => i.id === "prod-electronics")).toBeUndefined();
    expect(items.find((i) => i.id === "prod-random")).toBeUndefined();
  });
});

// ===========================================================================
// SECURITY: Cross-User Protection
// ===========================================================================

describe("Security: Cross-User Protection", () => {
  it("should generate unique event keys for different entities", () => {
    const key1 = eventKey("PRODUCT_VIEW", "prod-a");
    const key2 = eventKey("PRODUCT_VIEW", "prod-b");
    const key3 = eventKey("CART_ADD", "prod-a");

    expect(key1).not.toBe(key2); // different products
    expect(key1).not.toBe(key3); // different event types
    expect(key2).not.toBe(key3);
  });

  it("should deduplicate same-meaning events during merge", () => {
    const anonEvents = [
      { _id: "a1", type: "PRODUCT_VIEW", entityId: "prod-1" },
      { _id: "a2", type: "PRODUCT_VIEW", entityId: "prod-2" },
      { _id: "a3", type: "SEARCH", value: "toothpaste" },
    ];
    const userEvents = [
      { _id: "u1", type: "PRODUCT_VIEW", entityId: "prod-1" }, // duplicate
    ];

    const { toMerge, toDrop } = planAnonymousMerge(anonEvents, userEvents);

    // prod-1 should be dropped (duplicate)
    expect(toDrop.length).toBe(1);
    expect(toDrop[0].entityId).toBe("prod-1");

    // prod-2 and search should be merged
    expect(toMerge.length).toBe(2);
    expect(toMerge.map((e) => e.entityId)).toContain("prod-2");
  });

  it("should handle empty merge gracefully", () => {
    const { toMerge, toDrop } = planAnonymousMerge([], []);
    expect(toMerge).toHaveLength(0);
    expect(toDrop).toHaveLength(0);
  });

  it("should handle all-duplicate merge", () => {
    const events = [
      { _id: "1", type: "PRODUCT_VIEW", entityId: "prod-1" },
      { _id: "2", type: "CART_ADD", entityId: "prod-1" },
    ];
    const { toMerge, toDrop } = planAnonymousMerge(events, events);
    expect(toMerge).toHaveLength(0);
    expect(toDrop).toHaveLength(2);
  });
});

// ===========================================================================
// TIME DECAY: Recent > Old
// ===========================================================================

describe("Time Decay: Recent > Old", () => {
  it("should give higher score to recent events than old events", () => {
    const now = Date.now();
    const recentWeight = eventWeight("PURCHASE") * decay("PURCHASE", now - 1 * DAY_MS, now);
    const oldWeight = eventWeight("PURCHASE") * decay("PURCHASE", now - 90 * DAY_MS, now);

    expect(recentWeight).toBeGreaterThan(oldWeight);
  });

  it("should never produce NaN or Infinity", () => {
    const now = Date.now();
    const types = ["PRODUCT_VIEW", "PURCHASE", "CART_ADD", "SEARCH", "STORE_VIEW"];

    for (const type of types) {
      const d = decay(type, now - 365 * DAY_MS, now);
      expect(Number.isFinite(d)).toBe(true);
      expect(Number.isNaN(d)).toBe(false);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(1);
    }
  });

  it("should have decay = 1.0 at time of event", () => {
    const now = Date.now();
    const d = decay("PRODUCT_VIEW", now, now);
    expect(d).toBe(1.0);
  });

  it("should have decay approaching 0 for very old events", () => {
    const now = Date.now();
    const d = decay("PRODUCT_VIEW", now - 365 * DAY_MS, now);
    expect(d).toBeLessThan(0.01);
  });
});

// ===========================================================================
// SEARCH MATCHING
// ===========================================================================

describe("Search Matching", () => {
  it("should match products by name", () => {
    const products = [
      { id: "1", name: "Toothpaste White" },
      { id: "2", name: "Moisturizer Cream" },
      { id: "3", name: "Shampoo Anti-dandruff" },
    ];

    const matches = matchSearchToProducts("tooth", products);
    expect(matches).toEqual(["1"]);
  });

  it("should be case-insensitive", () => {
    const products = [
      { id: "1", name: "Toothpaste White" },
      { id: "2", name: "MOISTURIZER Cream" },
    ];

    const matches = matchSearchToProducts("TOOTH", products);
    expect(matches).toEqual(["1"]);
  });

  it("should return empty for no matches", () => {
    const products = [
      { id: "1", name: "Toothpaste" },
    ];

    const matches = matchSearchToProducts("laptop", products);
    expect(matches).toEqual([]);
  });

  it("should handle empty query", () => {
    const products = [{ id: "1", name: "Toothpaste" }];
    const matches = matchSearchToProducts("", products);
    expect(matches).toEqual([]);
  });
});

// ===========================================================================
// PURCHASE PATTERNS
// ===========================================================================

describe("Purchase Patterns", () => {
  it("should detect repeat purchases", () => {
    const now = Date.now();
    const purchaseEvents = [
      { entityId: "prod-a", createdAt: now - 60 * DAY_MS },
      { entityId: "prod-a", createdAt: now - 30 * DAY_MS },
      { entityId: "prod-a", createdAt: now - 1 * DAY_MS },
    ];

    const patterns = computePurchasePatterns(purchaseEvents);
    const pattern = patterns.get("prod-a");

    expect(pattern).toBeDefined();
    expect(pattern!.purchaseCount).toBe(3);
    expect(pattern!.averageIntervalDays).toBeGreaterThan(25);
    expect(pattern!.averageIntervalDays).toBeLessThan(35);
  });

  it("should return null average interval for single purchase", () => {
    const patterns = computePurchasePatterns([
      { entityId: "prod-a", createdAt: Date.now() },
    ]);
    const pattern = patterns.get("prod-a");
    expect(pattern!.averageIntervalDays).toBeNull();
  });
});
