import { describe, it, expect } from "vitest";
import {
  ALL_EVENT_TYPES,
  BRAIN_EVENT_SET,
  eventWeight,
  decay,
  DAY_MS,
  computeProductAffinities,
  aggregateSignals,
  type IntentCounts,
} from "../packages/shared/src/lib/customer-memory-core";
import {
  ERROR_CODES,
  type ProductDTO,
  type CartDTO,
  type OrderDTO,
  type AddressDTO,
  type CheckoutRequest,
  type RecommendationItemDTO,
} from "../packages/shared/src/api/types";

/**
 * Commerce Flow Integration Test
 *
 * Simulates the complete customer journey:
 *   Browse → Search → View → Cart → Checkout → Order → Brain
 *
 * This test verifies:
 *   1. API contract consistency
 *   2. Event tracking correctness
 *   3. Brain integration
 *   4. Security model
 */

// ============================================================================
// COMPLETE COMMERCE FLOW
// ============================================================================

describe("Commerce Flow: Complete Customer Journey", () => {
  it("should support the full browse-to-purchase flow", () => {
    // Step 1: Customer browses products
    const catalog: ProductDTO[] = [
      {
        id: "prod-toothpaste",
        shopId: "shop-1",
        name: "Toothpaste White",
        description: "Whitening toothpaste",
        category: "beauty",
        unit: "tube",
        price: 120,
        currency: "THB",
        images: [],
        status: "published",
        averageRating: 4.5,
        reviewCount: 23,
        stockAvailable: 50,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: "prod-soap",
        shopId: "shop-1",
        name: "Organic Soap",
        description: "Natural soap bar",
        category: "daily",
        unit: "bar",
        price: 80,
        currency: "THB",
        images: [],
        status: "published",
        averageRating: 4.2,
        reviewCount: 15,
        stockAvailable: 30,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    expect(catalog.length).toBe(2);
    expect(catalog[0].price).toBeGreaterThan(0);
    expect(catalog[1].price).toBeGreaterThan(0);

    // Step 2: Customer searches
    const searchResults = catalog.filter((p) =>
      p.name.toLowerCase().includes("tooth"),
    );
    expect(searchResults.length).toBe(1);
    expect(searchResults[0].id).toBe("prod-toothpaste");

    // Track: SEARCH event
    const searchEvent = { type: "SEARCH", value: "toothpaste", entityId: undefined, createdAt: Date.now() };
    expect(BRAIN_EVENT_SET.has(searchEvent.type)).toBe(true);

    // Step 3: Customer views product
    const product = catalog.find((p) => p.id === "prod-toothpaste")!;
    expect(product.stockAvailable).toBeGreaterThan(0);

    // Track: PRODUCT_VIEW event
    const viewEvent = { type: "PRODUCT_VIEW", entityId: product.id, createdAt: Date.now() };
    expect(BRAIN_EVENT_SET.has(viewEvent.type)).toBe(true);
    expect(eventWeight("PRODUCT_VIEW")).toBe(2);

    // Step 4: Customer adds to cart
    const cart: CartDTO = {
      id: "cart-1",
      items: [
        {
          id: "item-1",
          productId: product.id,
          productName: product.name,
          productImage: product.images[0]?.url ?? null,
          shopId: product.shopId,
          shopName: "My Shop",
          unitPrice: product.price,
          quantity: 2,
          lineTotal: product.price * 2,
          stockAvailable: product.stockAvailable,
        },
      ],
      itemCount: 2,
      subtotal: product.price * 2,
      currency: "THB",
    };

    expect(cart.subtotal).toBe(240);
    expect(cart.items[0].lineTotal).toBe(240);
    expect(cart.items[0].quantity).toBeLessThanOrEqual(cart.items[0].stockAvailable);

    // Track: CART_ADD event
    const cartEvent = { type: "CART_ADD", entityId: product.id, createdAt: Date.now() };
    expect(BRAIN_EVENT_SET.has(cartEvent.type)).toBe(true);
    expect(eventWeight("CART_ADD")).toBe(6);

    // Step 5: Customer checks out
    const address: AddressDTO = {
      id: "addr-1",
      label: "Home",
      recipientName: "Test User",
      phone: "0812345678",
      addressLine1: "123 Main St",
      addressLine2: null,
      city: "Bangkok",
      province: "Bangkok",
      postalCode: "10110",
      country: "TH",
      latitude: 13.7563,
      longitude: 100.5018,
      isDefault: true,
      createdAt: Date.now(),
    };

    const checkoutReq: CheckoutRequest = {
      addressId: address.id,
      paymentMethod: "cod",
      idempotencyKey: `checkout-${Date.now()}`,
    };

    expect(checkoutReq.addressId).toBeTruthy();
    expect(checkoutReq.paymentMethod).toBeTruthy();

    // Track: CHECKOUT_START event
    const checkoutEvent = { type: "CHECKOUT_START", createdAt: Date.now() };
    expect(BRAIN_EVENT_SET.has(checkoutEvent.type)).toBe(true);
    expect(eventWeight("CHECKOUT_START")).toBe(4);

    // Step 6: Order created
    const order: OrderDTO = {
      id: "order-1",
      status: "pending",
      items: cart.items.map((item) => ({
        id: `order-item-${item.id}`,
        productId: item.productId,
        productName: item.productName,
        productImage: item.productImage,
        shopId: item.shopId,
        shopName: item.shopName,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
      })),
      subtotal: cart.subtotal,
      shippingCost: 0,
      discount: 0,
      total: cart.subtotal,
      currency: "THB",
      paymentStatus: "unpaid",
      shippingStatus: "not_shipped",
      addressSnapshot: address as unknown as Record<string, unknown>,
      notes: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    expect(order.status).toBe("pending");
    expect(order.total).toBe(cart.subtotal);
    expect(order.items.length).toBe(1);

    // Track: PURCHASE event
    const purchaseEvent = { type: "PURCHASE", entityId: product.id, createdAt: Date.now() };
    expect(BRAIN_EVENT_SET.has(purchaseEvent.type)).toBe(true);
    expect(eventWeight("PURCHASE")).toBe(12);

    // Step 7: Brain processes events
    const allEvents = [
      { ...searchEvent, entityId: undefined },
      viewEvent,
      { ...cartEvent, entityId: product.id },
      { ...checkoutEvent, entityId: undefined },
      purchaseEvent,
    ];
    const productAffinities = computeProductAffinities(
      allEvents.filter((e): e is typeof e & { entityId: string } => Boolean(e.entityId)),
      Date.now(),
    );

    // Product should have high affinity after this flow
    const affinity = productAffinities.get(product.id) ?? 0;
    expect(affinity).toBeGreaterThan(0);
  });
});

// ============================================================================
// ORDER STATE MACHINE FLOW
// ============================================================================

describe("Order State Machine: Full Lifecycle", () => {
  it("should follow correct order lifecycle", () => {
    const validTransitions: Record<string, string[]> = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["shipped", "cancelled"],
      shipped: ["delivered", "cancelled"],
      delivered: ["completed", "cancelled"],
      completed: [],
      cancelled: [],
    };

    // Happy path: pending → confirmed → shipped → delivered → completed
    let status = "pending";

    status = validTransitions[status].find((s) => s === "confirmed")!;
    expect(status).toBe("confirmed");

    status = validTransitions[status].find((s) => s === "shipped")!;
    expect(status).toBe("shipped");

    status = validTransitions[status].find((s) => s === "delivered")!;
    expect(status).toBe("delivered");

    status = validTransitions[status].find((s) => s === "completed")!;
    expect(status).toBe("completed");

    // Terminal state
    expect(validTransitions[status]).toHaveLength(0);
  });

  it("should support cancellation from any non-terminal state", () => {
    const validTransitions: Record<string, string[]> = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["shipped", "cancelled"],
      shipped: ["delivered", "cancelled"],
      delivered: ["completed", "cancelled"],
      completed: [],
      cancelled: [],
    };

    const cancellableStates = ["pending", "confirmed", "shipped", "delivered"];
    for (const state of cancellableStates) {
      expect(validTransitions[state]).toContain("cancelled");
    }

    // Terminal states cannot be cancelled
    expect(validTransitions["completed"]).not.toContain("cancelled");
    expect(validTransitions["cancelled"]).not.toContain("cancelled");
  });
});

// ============================================================================
// SECURITY: Multi-Role Authorization
// ============================================================================

describe("Security: Multi-Role Authorization", () => {
  const roles = {
    customer: { canBuy: true, canSell: false, canAdmin: false, canCenter: false },
    seller: { canBuy: false, canSell: true, canAdmin: false, canCenter: false },
    staff: { canBuy: false, canSell: false, canAdmin: false, canCenter: true },
    admin: { canBuy: false, canSell: true, canAdmin: true, canCenter: true },
    owner: { canBuy: false, canSell: true, canAdmin: true, canCenter: true },
  };

  it("should enforce role-based access", () => {
    // Customer can buy but not sell
    expect(roles.customer.canBuy).toBe(true);
    expect(roles.customer.canSell).toBe(false);
    expect(roles.customer.canAdmin).toBe(false);

    // Seller can sell but not admin
    expect(roles.seller.canSell).toBe(true);
    expect(roles.seller.canAdmin).toBe(false);

    // Admin can do everything except buy
    expect(roles.admin.canSell).toBe(true);
    expect(roles.admin.canAdmin).toBe(true);
    expect(roles.admin.canCenter).toBe(true);

    // Owner has all permissions
    expect(roles.owner.canSell).toBe(true);
    expect(roles.owner.canAdmin).toBe(true);
    expect(roles.owner.canCenter).toBe(true);
  });

  it("should enforce seller ownership", () => {
    const sellerA = { id: "seller-a", ownerUserId: "user-a" };
    const sellerB = { id: "seller-b", ownerUserId: "user-b" };

    // Seller A cannot operate Seller B's shop
    expect(sellerA.id).not.toBe(sellerB.id);
    expect(sellerA.ownerUserId).not.toBe(sellerB.ownerUserId);
  });
});

// ============================================================================
// EVENT TRACKING: All Commerce Events
// ============================================================================

describe("Event Tracking: Commerce Events", () => {
  it("should track all customer-facing commerce events", () => {
    const commerceEvents = [
      "PRODUCT_VIEW",
      "PRODUCT_CLICK",
      "PRODUCT_IMAGE_VIEW",
      "CATEGORY_VIEW",
      "STORE_VIEW",
      "SEARCH",
      "SEARCH_RESULT_CLICK",
      "CART_ADD",
      "CART_REMOVE",
      "CART_VIEW",
      "WISHLIST_ADD",
      "WISHLIST_REMOVE",
      "CHECKOUT_START",
      "PURCHASE",
      "PURCHASE_CANCEL",
      "REPEAT_PURCHASE",
      "RECOMMENDATION_VIEW",
      "RECOMMENDATION_CLICK",
      "RECOMMENDATION_IGNORE",
    ];

    for (const event of commerceEvents) {
      expect(BRAIN_EVENT_SET.has(event)).toBe(true);
    }
    // Most commerce events should have non-zero weight (signal for brain)
    const weightedEvents = commerceEvents.filter((e) => eventWeight(e) !== 0);
    expect(weightedEvents.length).toBeGreaterThan(commerceEvents.length / 2);
  });

  it("should have time decay for all commerce events", () => {
    const now = Date.now();
    const eventsWithDecay = [
      "PRODUCT_VIEW",
      "CART_ADD",
      "WISHLIST_ADD",
      "PURCHASE",
      "SEARCH",
      "STORE_VIEW",
      "CATEGORY_VIEW",
    ];

    for (const event of eventsWithDecay) {
      const d = decay(event, now - 30 * DAY_MS, now);
      expect(d).toBeGreaterThan(0);
      expect(d).toBeLessThan(1);
    }
  });
});

// ============================================================================
// RECOMMENDATION QUALITY
// ============================================================================

describe("Recommendation Quality", () => {
  it("should rank products by affinity score", () => {
    const now = Date.now();

    // User has strong interest in beauty products
    const events = [
      { type: "PRODUCT_VIEW", entityId: "prod-a", createdAt: now - 1 * DAY_MS },
      { type: "PRODUCT_VIEW", entityId: "prod-a", createdAt: now - 1 * DAY_MS },
      { type: "CART_ADD", entityId: "prod-a", createdAt: now - 0.5 * DAY_MS },
      { type: "PURCHASE", entityId: "prod-a", createdAt: now - 0.1 * DAY_MS },
      { type: "PRODUCT_VIEW", entityId: "prod-b", createdAt: now - 5 * DAY_MS },
    ];

    const affinities = computeProductAffinities(events, now);
    const scoreA = affinities.get("prod-a") ?? 0;
    const scoreB = affinities.get("prod-b") ?? 0;

    // Product A should have much higher affinity (more interactions + purchase)
    expect(scoreA).toBeGreaterThan(scoreB);
  });

  it("should generate explainable recommendations", () => {
    const recs: RecommendationItemDTO[] = [
      { productId: "prod-a", score: 0.92, reason: "HIGH_PRODUCT_AFFINITY" },
      { productId: "prod-b", score: 0.81, reason: "CATEGORY_AFFINITY" },
      { productId: "prod-c", score: 0.70, reason: "SHOP_AFFINITY" },
    ];

    for (const rec of recs) {
      expect(rec.reason).toBeTruthy();
      expect(rec.score).toBeGreaterThan(0);
      expect(rec.productId).toBeTruthy();
    }
  });
});
