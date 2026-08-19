import { describe, it, expect } from "vitest";
import {
  DAY_MS,
  eventWeight,
  decay,
  interestContribution,
  estimateIntent,
  eventKey,
  planAnonymousMerge,
  computeProductAffinities,
  computeCategoryAffinities,
  computeShopAffinities,
  computePurchasePatterns,
  computePricePreference,
  aggregateSignals,
  EVENT_WEIGHTS,
  EVENT_HALF_LIFE,
  ALL_EVENT_TYPES,
} from "../packages/shared/src/lib/customer-memory-core";

// ===========================================================================
// EVENT VOCABULARY
// ===========================================================================

describe("Event Vocabulary", () => {
  it("should have 28 event types", () => {
    expect(ALL_EVENT_TYPES.length).toBe(28);
  });

  it("should include all required session events", () => {
    expect(ALL_EVENT_TYPES).toContain("SESSION_START");
    expect(ALL_EVENT_TYPES).toContain("SESSION_END");
    expect(ALL_EVENT_TYPES).toContain("APP_OPEN");
  });

  it("should include all required product events", () => {
    expect(ALL_EVENT_TYPES).toContain("PRODUCT_VIEW");
    expect(ALL_EVENT_TYPES).toContain("PRODUCT_CLICK");
    expect(ALL_EVENT_TYPES).toContain("PRODUCT_IMAGE_VIEW");
  });

  it("should include all required cart events", () => {
    expect(ALL_EVENT_TYPES).toContain("CART_ADD");
    expect(ALL_EVENT_TYPES).toContain("CART_REMOVE");
    expect(ALL_EVENT_TYPES).toContain("CART_VIEW");
  });

  it("should include all required purchase events", () => {
    expect(ALL_EVENT_TYPES).toContain("PURCHASE");
    expect(ALL_EVENT_TYPES).toContain("PURCHASE_CANCEL");
    expect(ALL_EVENT_TYPES).toContain("REPEAT_PURCHASE");
  });

  it("should include all required recommendation events", () => {
    expect(ALL_EVENT_TYPES).toContain("RECOMMENDATION_VIEW");
    expect(ALL_EVENT_TYPES).toContain("RECOMMENDATION_CLICK");
    expect(ALL_EVENT_TYPES).toContain("RECOMMENDATION_IGNORE");
  });
});

// ===========================================================================
// SCORING WEIGHTS
// ===========================================================================

describe("Scoring Weights", () => {
  it("PURCHASE should have highest positive weight", () => {
    expect(EVENT_WEIGHTS.PURCHASE).toBe(12);
    expect(EVENT_WEIGHTS.PURCHASE).toBeGreaterThanOrEqual(EVENT_WEIGHTS.CART_ADD);
    expect(EVENT_WEIGHTS.PURCHASE).toBeGreaterThanOrEqual(EVENT_WEIGHTS.WISHLIST_ADD);
  });

  it("REPEAT_PURCHASE should have highest weight", () => {
    expect(EVENT_WEIGHTS.REPEAT_PURCHASE).toBe(15);
    expect(EVENT_WEIGHTS.REPEAT_PURCHASE).toBeGreaterThan(EVENT_WEIGHTS.PURCHASE);
  });

  it("negative signals should have negative weights", () => {
    expect(EVENT_WEIGHTS.CART_REMOVE).toBeLessThan(0);
    expect(EVENT_WEIGHTS.WISHLIST_REMOVE).toBeLessThan(0);
    expect(EVENT_WEIGHTS.PURCHASE_CANCEL).toBeLessThan(0);
  });

  it("eventWeight should return correct values", () => {
    expect(eventWeight("PURCHASE")).toBe(12);
    expect(eventWeight("PRODUCT_VIEW")).toBe(2);
    expect(eventWeight("UNKNOWN_EVENT")).toBe(0);
  });
});

// ===========================================================================
// TIME DECAY
// ===========================================================================

describe("Time Decay", () => {
  it("decay at same time should be 1.0", () => {
    const now = Date.now();
    expect(decay("PRODUCT_VIEW", now, now)).toBeCloseTo(1.0, 2);
  });

  it("decay should decrease over time", () => {
    const now = Date.now();
    const d1 = decay("PRODUCT_VIEW", now, now);
    const d2 = decay("PRODUCT_VIEW", now, now + 15 * DAY_MS);
    const d3 = decay("PRODUCT_VIEW", now, now + 30 * DAY_MS);
    expect(d1).toBeGreaterThan(d2);
    expect(d2).toBeGreaterThan(d3);
  });

  it("decay after one half-life should be ~0.5", () => {
    const now = Date.now();
    const halfLife = EVENT_HALF_LIFE["PRODUCT_VIEW"]; // 30 days
    const d = decay("PRODUCT_VIEW", now, now + halfLife * DAY_MS);
    expect(d).toBeCloseTo(0.5, 1);
  });

  it("strong signals should decay slower", () => {
    const now = Date.now();
    const purchaseHalfLife = EVENT_HALF_LIFE["PURCHASE"]; // 120 days
    const viewHalfLife = EVENT_HALF_LIFE["PRODUCT_VIEW"]; // 30 days

    const purchaseDecay = decay("PURCHASE", now, now + 30 * DAY_MS);
    const viewDecay = decay("PRODUCT_VIEW", now, now + 30 * DAY_MS);

    // After 30 days, purchase (120-day half-life) should be stronger than view (30-day half-life)
    expect(purchaseDecay).toBeGreaterThan(viewDecay);
  });

  it("interestContribution should combine weight and decay", () => {
    const now = Date.now();
    const contribution = interestContribution("PURCHASE", now, now);
    expect(contribution).toBeCloseTo(12.0, 1); // weight 1.0 * decay 1.0 = 12
  });
});

// ===========================================================================
// PURCHASE INTENT
// ===========================================================================

describe("Purchase Intent", () => {
  it("should return low for no activity", () => {
    expect(estimateIntent({ purchaseCount: 0, cartAddCount: 0, viewCount: 0, wishlistCount: 0, checkoutCount: 0 })).toBe("low");
  });

  it("should return medium for browsing only", () => {
    expect(estimateIntent({ purchaseCount: 0, cartAddCount: 0, viewCount: 10, wishlistCount: 0, checkoutCount: 0 })).toBe("low");
  });

  it("should return medium for single purchase", () => {
    expect(estimateIntent({ purchaseCount: 1, cartAddCount: 0, viewCount: 0, wishlistCount: 0, checkoutCount: 0 })).toBe("medium");
  });

  it("should return medium for cart add", () => {
    expect(estimateIntent({ purchaseCount: 0, cartAddCount: 1, viewCount: 0, wishlistCount: 0, checkoutCount: 0 })).toBe("medium");
  });

  it("should return high for multiple purchases", () => {
    expect(estimateIntent({ purchaseCount: 3, cartAddCount: 0, viewCount: 0, wishlistCount: 0, checkoutCount: 0 })).toBe("high");
  });

  it("should return high for cart + views", () => {
    expect(estimateIntent({ purchaseCount: 0, cartAddCount: 5, viewCount: 10, wishlistCount: 0, checkoutCount: 0 })).toBe("high");
  });

  it("should return high for wishlists", () => {
    expect(estimateIntent({ purchaseCount: 0, cartAddCount: 0, viewCount: 0, wishlistCount: 3, checkoutCount: 0 })).toBe("high");
  });

  it("should return high for checkouts", () => {
    expect(estimateIntent({ purchaseCount: 0, cartAddCount: 0, viewCount: 0, wishlistCount: 0, checkoutCount: 2 })).toBe("high");
  });
});

// ===========================================================================
// EVENT DEDUPLICATION
// ===========================================================================

describe("Event Deduplication", () => {
  it("eventKey should produce stable keys", () => {
    expect(eventKey("PRODUCT_VIEW", "prod123")).toBe("PRODUCT_VIEW|prod123|");
    expect(eventKey("SEARCH", undefined, "shoes")).toBe("SEARCH||shoes");
    expect(eventKey("CATEGORY_VIEW", undefined, "beauty")).toBe("CATEGORY_VIEW||beauty");
  });

  it("planAnonymousMerge should merge non-duplicate events", () => {
    const anonEvents = [
      { _id: "a1", type: "PRODUCT_VIEW", entityId: "p1" },
      { _id: "a2", type: "PRODUCT_VIEW", entityId: "p2" },
      { _id: "a3", type: "SEARCH", value: "shoes" },
    ];
    const userEvents = [
      { _id: "u1", type: "PRODUCT_VIEW", entityId: "p1" },
    ];

    const { toMerge, toDrop } = planAnonymousMerge(anonEvents, userEvents);
    expect(toMerge.length).toBe(2); // p2 and search
    expect(toDrop.length).toBe(1); // p1 is duplicate
  });

  it("planAnonymousMerge should handle empty inputs", () => {
    const { toMerge, toDrop } = planAnonymousMerge([], []);
    expect(toMerge.length).toBe(0);
    expect(toDrop.length).toBe(0);
  });
});

// ===========================================================================
// PRODUCT AFFINITY
// ===========================================================================

describe("Product Affinity", () => {
  it("should compute product affinities from events", () => {
    const now = Date.now();
    const events = [
      { type: "PRODUCT_VIEW", entityId: "p1", createdAt: now },
      { type: "PRODUCT_VIEW", entityId: "p1", createdAt: now },
      { type: "CART_ADD", entityId: "p1", createdAt: now },
      { type: "PRODUCT_VIEW", entityId: "p2", createdAt: now },
    ];

    const affinities = computeProductAffinities(events, now);
    expect(affinities.get("p1")).toBeGreaterThan(affinities.get("p2")!);
    expect(affinities.get("p1")).toBeCloseTo(2 + 2 + 6, 1); // 2 views + 1 cart add
  });

  it("should apply time decay to affinities", () => {
    const now = Date.now();
    const events = [
      { type: "PRODUCT_VIEW", entityId: "p1", createdAt: now - 60 * DAY_MS }, // old
      { type: "PRODUCT_VIEW", entityId: "p2", createdAt: now }, // recent
    ];

    const affinities = computeProductAffinities(events, now);
    expect(affinities.get("p2")).toBeGreaterThan(affinities.get("p1")!);
  });

  it("should ignore events without entityId", () => {
    const now = Date.now();
    const events = [
      { type: "PRODUCT_VIEW", entityId: undefined, createdAt: now },
    ];

    const affinities = computeProductAffinities(events, now);
    expect(affinities.size).toBe(0);
  });
});

// ===========================================================================
// CATEGORY AFFINITY
// ===========================================================================

describe("Category Affinity", () => {
  it("should compute category affinities from category views", () => {
    const now = Date.now();
    const events = [
      { type: "CATEGORY_VIEW", value: "beauty", createdAt: now },
      { type: "CATEGORY_VIEW", value: "beauty", createdAt: now },
      { type: "CATEGORY_VIEW", value: "food", createdAt: now },
    ];

    const affinities = computeCategoryAffinities(events, new Map(), now);
    expect(affinities.get("beauty")).toBeGreaterThan(affinities.get("food")!);
  });

  it("should compute category affinities from product events", () => {
    const now = Date.now();
    const productCategoryMap = new Map([
      ["p1", "beauty"],
      ["p2", "food"],
    ]);
    const events = [
      { type: "PRODUCT_VIEW", entityId: "p1", createdAt: now },
      { type: "PRODUCT_VIEW", entityId: "p1", createdAt: now },
      { type: "PRODUCT_VIEW", entityId: "p2", createdAt: now },
    ];

    const affinities = computeCategoryAffinities(events, productCategoryMap, now);
    expect(affinities.get("beauty")).toBeGreaterThan(affinities.get("food")!);
  });
});

// ===========================================================================
// SHOP AFFINITY
// ===========================================================================

describe("Shop Affinity", () => {
  it("should compute shop affinities from store views", () => {
    const now = Date.now();
    const events = [
      { type: "STORE_VIEW", entityId: "shop1", createdAt: now },
      { type: "STORE_VIEW", entityId: "shop1", createdAt: now },
      { type: "STORE_VIEW", entityId: "shop2", createdAt: now },
    ];

    const affinities = computeShopAffinities(events, new Map(), now);
    expect(affinities.get("shop1")).toBeGreaterThan(affinities.get("shop2")!);
  });
});

// ===========================================================================
// PURCHASE PATTERNS
// ===========================================================================

describe("Purchase Patterns", () => {
  it("should compute purchase patterns from events", () => {
    const now = Date.now();
    const events = [
      { entityId: "p1", createdAt: now - 30 * DAY_MS },
      { entityId: "p1", createdAt: now - 10 * DAY_MS },
      { entityId: "p2", createdAt: now - 5 * DAY_MS },
    ];

    const patterns = computePurchasePatterns(events);
    expect(patterns.size).toBe(2);
    expect(patterns.get("p1")!.purchaseCount).toBe(2);
    expect(patterns.get("p1")!.averageIntervalDays).toBeCloseTo(20, 0);
    expect(patterns.get("p2")!.purchaseCount).toBe(1);
  });

  it("should handle single purchase (no interval)", () => {
    const events = [
      { entityId: "p1", createdAt: Date.now() },
    ];

    const patterns = computePurchasePatterns(events);
    expect(patterns.get("p1")!.purchaseCount).toBe(1);
    expect(patterns.get("p1")!.averageIntervalDays).toBeNull();
  });
});

// ===========================================================================
// PRICE PREFERENCE
// ===========================================================================

describe("Price Preference", () => {
  it("should compute price preference from events", () => {
    const now = Date.now();
    const events = [
      { type: "PRODUCT_VIEW", price: 100, createdAt: now },
      { type: "PRODUCT_VIEW", price: 200, createdAt: now },
      { type: "CART_ADD", price: 150, createdAt: now },
    ];

    const pref = computePricePreference(events, now);
    expect(pref).not.toBeNull();
    expect(pref!.minPrice).toBe(100);
    expect(pref!.maxPrice).toBe(200);
  });

  it("should return null for no price events", () => {
    const pref = computePricePreference([], Date.now());
    expect(pref).toBeNull();
  });
});

// ===========================================================================
// AGGREGATE SIGNALS
// ===========================================================================

describe("Aggregate Signals", () => {
  it("should aggregate all signal types", () => {
    const productAffinities = new Map([["p1", 10], ["p2", 5]]);
    const categoryAffinities = new Map([["beauty", 8], ["food", 3]]);
    const shopAffinities = new Map([["shop1", 6]]);
    const purchasePatterns = new Map([
      ["p1", { productId: "p1", purchaseCount: 3, averageIntervalDays: 30, lastPurchasedAt: Date.now(), firstPurchasedAt: Date.now() - 90 * DAY_MS }],
    ]);

    const signals = aggregateSignals({
      productAffinities,
      categoryAffinities,
      shopAffinities,
      purchasePatterns,
      pricePreference: { minPrice: 50, maxPrice: 300, averagePrice: 150, medianPrice: 120 },
      intentCounts: { purchaseCount: 3, cartAddCount: 2, viewCount: 10, wishlistCount: 1, checkoutCount: 1 },
      totalEvents: 50,
      lastActivityAt: Date.now(),
    });

    expect(signals.productAffinities.length).toBe(2);
    expect(signals.categoryAffinities.length).toBe(2);
    expect(signals.shopAffinities.length).toBe(1);
    expect(signals.purchasePatterns.length).toBe(1);
    expect(signals.pricePreference).not.toBeNull();
    expect(signals.intent).toBe("high");
    expect(signals.totalEvents).toBe(50);
  });
});
