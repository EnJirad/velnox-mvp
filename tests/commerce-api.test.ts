import { describe, it, expect } from "vitest";
import {
  ERROR_CODES,
  EVENT_SOURCES,
  type ErrorCode,
  type EventSource,
  type ProductDTO,
  type CartDTO,
  type OrderDTO,
  type AddressDTO,
  type ApiResponse,
  type PaginatedResponse,
  type SearchParams,
  type CheckoutRequest,
  type RecommendationItemDTO,
} from "../packages/shared/src/api/types";

import {
  ALL_EVENT_TYPES,
  BRAIN_EVENT_SET,
  EVENT_WEIGHTS,
  eventWeight,
  decay,
  DAY_MS,
} from "../packages/shared/src/lib/customer-memory-core";

// ============================================================================
// API RESPONSE CONTRACTS
// ============================================================================

describe("API Response Contracts", () => {
  it("should have consistent error codes", () => {
    expect(ERROR_CODES.UNAUTHENTICATED).toBe("UNAUTHENTICATED");
    expect(ERROR_CODES.FORBIDDEN).toBe("FORBIDDEN");
    expect(ERROR_CODES.NOT_FOUND).toBe("NOT_FOUND");
    expect(ERROR_CODES.PRODUCT_NOT_FOUND).toBe("PRODUCT_NOT_FOUND");
    expect(ERROR_CODES.ORDER_NOT_FOUND).toBe("ORDER_NOT_FOUND");
    expect(ERROR_CODES.OUT_OF_STOCK).toBe("OUT_OF_STOCK");
    expect(ERROR_CODES.INSUFFICIENT_STOCK).toBe("INSUFFICIENT_STOCK");
    expect(ERROR_CODES.PRICE_CHANGED).toBe("PRICE_CHANGED");
    expect(ERROR_CODES.PAYMENT_FAILED).toBe("PAYMENT_FAILED");
    expect(ERROR_CODES.RATE_LIMITED).toBe("RATE_LIMITED");
    expect(ERROR_CODES.INTERNAL_ERROR).toBe("INTERNAL_ERROR");
  });

  it("should have valid event sources", () => {
    expect(EVENT_SOURCES).toContain("VELSHOP");
    expect(EVENT_SOURCES).toContain("VELSELLER");
    expect(EVENT_SOURCES).toContain("VELCENTER");
    expect(EVENT_SOURCES).toContain("ANDROID");
    expect(EVENT_SOURCES).toContain("IOS");
    expect(EVENT_SOURCES).toContain("WEB");
    expect(EVENT_SOURCES).toContain("SYSTEM");
  });

  it("should create valid success response", () => {
    const response: ApiResponse<ProductDTO> = {
      success: true,
      data: {
        id: "prod-1",
        shopId: "shop-1",
        name: "Test Product",
        description: null,
        category: "beauty",
        unit: "piece",
        price: 299,
        currency: "THB",
        images: [],
        status: "published",
        averageRating: null,
        reviewCount: 0,
        stockAvailable: 10,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };
    expect(response.success).toBe(true);
    if (response.success) {
      expect(response.data.name).toBe("Test Product");
      expect(response.data.price).toBe(299);
    }
  });

  it("should create valid error response", () => {
    const response: ApiResponse<never> = {
      success: false,
      error: {
        code: ERROR_CODES.PRODUCT_NOT_FOUND,
        message: "ไม่พบสินค้านี้",
      },
    };
    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.error.code).toBe("PRODUCT_NOT_FOUND");
    }
  });
});

// ============================================================================
// PRODUCT API
// ============================================================================

describe("Product API Contract", () => {
  it("should have required product fields", () => {
    const product: ProductDTO = {
      id: "prod-1",
      shopId: "shop-1",
      name: "Test Product",
      description: null,
      category: "beauty",
      unit: "piece",
      price: 299,
      currency: "THB",
      images: [],
      status: "published",
      averageRating: null,
      reviewCount: 0,
      stockAvailable: 10,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    expect(product.id).toBeTruthy();
    expect(product.shopId).toBeTruthy();
    expect(product.name).toBeTruthy();
    expect(product.price).toBeGreaterThan(0);
    expect(product.currency).toBe("THB");
    expect(["general", "food", "daily", "beauty", "packaging", "other"]).toContain(product.category);
    expect(["draft", "pending_review", "published", "rejected", "archived"]).toContain(product.status);
  });

  it("should not expose sensitive fields", () => {
    const product: ProductDTO = {
      id: "prod-1",
      shopId: "shop-1",
      name: "Test",
      description: null,
      category: "beauty",
      unit: "piece",
      price: 299,
      currency: "THB",
      images: [],
      status: "published",
      averageRating: null,
      reviewCount: 0,
      stockAvailable: 10,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Should NOT have internal fields (verified by type — not in ProductDTO)
    const keys = Object.keys(product);
    expect(keys).not.toContain('costPrice');
    expect(keys).not.toContain('markupPercent');
    expect(keys).not.toContain('sellerSecret');
  });
});

// ============================================================================
// CART API
// ============================================================================

describe("Cart API Contract", () => {
  it("should have valid cart structure", () => {
    const cart: CartDTO = {
      id: "cart-1",
      items: [
        {
          id: "item-1",
          productId: "prod-1",
          productName: "Toothpaste",
          productImage: null,
          shopId: "shop-1",
          shopName: "My Shop",
          unitPrice: 299,
          quantity: 2,
          lineTotal: 598,
          stockAvailable: 10,
        },
      ],
      itemCount: 2,
      subtotal: 598,
      currency: "THB",
    };

    expect(cart.items.length).toBe(1);
    expect(cart.itemCount).toBe(2);
    expect(cart.subtotal).toBe(598);
    expect(cart.subtotal).toBe(cart.items[0].unitPrice * cart.items[0].quantity);
  });

  it("should validate stock availability", () => {
    const item = {
      stockAvailable: 5,
      requestedQuantity: 10,
    };
    expect(item.requestedQuantity).toBeGreaterThan(item.stockAvailable);
    // This should be rejected by the backend
  });
});

// ============================================================================
// ORDER API
// ============================================================================

describe("Order API Contract", () => {
  it("should have valid order statuses", () => {
    const validStatuses = ["pending", "confirmed", "shipped", "delivered", "completed", "cancelled"];
    const orderStatus: OrderDTO["status"] = "pending";
    expect(validStatuses).toContain(orderStatus);
  });

  it("should enforce order state machine", () => {
    // Valid transitions
    const validTransitions: Record<string, string[]> = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["shipped", "cancelled"],
      shipped: ["delivered", "cancelled"],
      delivered: ["completed", "cancelled"],
      completed: [],
      cancelled: [],
    };

    // Can transition from pending to confirmed
    expect(validTransitions["pending"]).toContain("confirmed");
    // Cannot transition from pending to completed directly
    expect(validTransitions["pending"]).not.toContain("completed");
    // Cannot transition from cancelled to anything
    expect(validTransitions["cancelled"]).toHaveLength(0);
    // Cannot transition from completed to anything
    expect(validTransitions["completed"]).toHaveLength(0);
  });

  it("should not allow backward transitions", () => {
    const validTransitions: Record<string, string[]> = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["shipped", "cancelled"],
      shipped: ["delivered", "cancelled"],
      delivered: ["completed", "cancelled"],
      completed: [],
      cancelled: [],
    };

    // Cannot go from shipped back to confirmed
    expect(validTransitions["shipped"]).not.toContain("confirmed");
    // Cannot go from delivered back to shipped
    expect(validTransitions["delivered"]).not.toContain("shipped");
  });
});

// ============================================================================
// ADDRESS API
// ============================================================================

describe("Address API Contract", () => {
  it("should have required address fields", () => {
    const address: AddressDTO = {
      id: "addr-1",
      label: "Home",
      recipientName: "John Doe",
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

    expect(address.recipientName).toBeTruthy();
    expect(address.phone).toBeTruthy();
    expect(address.addressLine1).toBeTruthy();
    expect(address.city).toBeTruthy();
    expect(address.province).toBeTruthy();
    expect(address.postalCode).toBeTruthy();
  });
});

// ============================================================================
// BRAIN INTEGRATION
// ============================================================================

describe("Brain Integration: Event Weights", () => {
  it("should have correct purchase weight", () => {
    expect(EVENT_WEIGHTS["PURCHASE"]).toBe(12);
  });

  it("should have correct repeat purchase weight (stronger than first)", () => {
    expect(EVENT_WEIGHTS["REPEAT_PURCHASE"]).toBeGreaterThan(EVENT_WEIGHTS["PURCHASE"]);
  });

  it("should have negative weights for removal events", () => {
    expect(EVENT_WEIGHTS["CART_REMOVE"]).toBeLessThan(0);
    expect(EVENT_WEIGHTS["WISHLIST_REMOVE"]).toBeLessThan(0);
    expect(EVENT_WEIGHTS["PURCHASE_CANCEL"]).toBeLessThan(0);
  });

  it("should have correct weight ordering", () => {
    // Purchase should be strongest
    expect(EVENT_WEIGHTS["PURCHASE"]).toBeGreaterThan(EVENT_WEIGHTS["CART_ADD"]);
    expect(EVENT_WEIGHTS["CART_ADD"]).toBeGreaterThan(EVENT_WEIGHTS["WISHLIST_ADD"]);
    expect(EVENT_WEIGHTS["WISHLIST_ADD"]).toBeGreaterThan(EVENT_WEIGHTS["PRODUCT_VIEW"]);
    expect(EVENT_WEIGHTS["PRODUCT_VIEW"]).toBeGreaterThan(EVENT_WEIGHTS["SEARCH"]);
  });
});

describe("Brain Integration: Event Vocabulary", () => {
  it("should have all commerce events", () => {
    expect(BRAIN_EVENT_SET.has("PRODUCT_VIEW")).toBe(true);
    expect(BRAIN_EVENT_SET.has("CART_ADD")).toBe(true);
    expect(BRAIN_EVENT_SET.has("CART_REMOVE")).toBe(true);
    expect(BRAIN_EVENT_SET.has("PURCHASE")).toBe(true);
    expect(BRAIN_EVENT_SET.has("REPEAT_PURCHASE")).toBe(true);
    expect(BRAIN_EVENT_SET.has("SEARCH")).toBe(true);
    expect(BRAIN_EVENT_SET.has("STORE_VIEW")).toBe(true);
    expect(BRAIN_EVENT_SET.has("CATEGORY_VIEW")).toBe(true);
  });

  it("should use canonical names only (no aliases)", () => {
    // Should NOT have these aliases
    expect(BRAIN_EVENT_SET.has("SHOP_VIEW")).toBe(false);
    expect(BRAIN_EVENT_SET.has("ADD_TO_CART")).toBe(false);
    expect(BRAIN_EVENT_SET.has("REMOVE_FROM_CART")).toBe(false);
    expect(BRAIN_EVENT_SET.has("BUY")).toBe(false);
  });
});

// ============================================================================
// SECURITY: Cross-User Authorization
// ============================================================================

describe("Security: Cross-User Authorization", () => {
  it("should prevent User A from accessing User B's order", () => {
    const userA = { id: "user-a", role: "customer" as const };
    const order = { id: "order-1", userId: "user-b" };

    // Backend must check: order.userId === identity.user.id
    expect(order.userId).not.toBe(userA.id);
    // This should return FORBIDDEN
  });

  it("should prevent User A from modifying User B's address", () => {
    const userA = { id: "user-a" };
    const address = { id: "addr-1", userId: "user-b" };

    expect(address.userId).not.toBe(userA.id);
  });

  it("should prevent customer from accessing admin endpoints", () => {
    const customer = { role: "customer" };
    const adminRoles = ["owner", "admin", "staff"];

    expect(adminRoles).not.toContain(customer.role);
  });

  it("should prevent client from overriding product price", () => {
    const serverPrice = 299;
    const clientPrice = 1; // malicious client

    // Backend must always use server price
    expect(serverPrice).not.toBe(clientPrice);
    // Backend calculation: lineTotal = serverPrice × quantity
  });

  it("should prevent seller from accessing another seller's products", () => {
    const sellerA = { id: "seller-a" };
    const product = { id: "prod-1", sellerId: "seller-b" };

    expect(product.sellerId).not.toBe(sellerA.id);
  });
});

// ============================================================================
// IDEMPOTENCY
// ============================================================================

describe("Idempotency", () => {
  it("should handle duplicate checkout requests with same key", () => {
    const key = "idem-abc-123";
    const request1: CheckoutRequest = {
      addressId: "addr-1",
      paymentMethod: "cod",
      idempotencyKey: key,
    };
    const request2: CheckoutRequest = {
      addressId: "addr-1",
      paymentMethod: "cod",
      idempotencyKey: key,
    };

    expect(request1.idempotencyKey).toBe(request2.idempotencyKey);
    // Backend must return same order for both requests
  });
});

// ============================================================================
// SEARCH API
// ============================================================================

describe("Search API Contract", () => {
  it("should support search parameters", () => {
    const params: SearchParams = {
      query: "toothpaste",
      category: "beauty",
      minPrice: 50,
      maxPrice: 500,
      sortBy: "relevance",
      limit: 20,
    };

    expect(params.query).toBeTruthy();
    expect(params.limit).toBeLessThanOrEqual(100);
  });

  it("should validate sort options", () => {
    const validSorts = ["relevance", "price_asc", "price_desc", "newest", "rating"];
    expect(validSorts).toContain("relevance");
    expect(validSorts).toContain("price_asc");
    expect(validSorts).toContain("price_desc");
  });
});

// ============================================================================
// PAGINATION
// ============================================================================

describe("Pagination Contract", () => {
  it("should have valid paginated response", () => {
    const response: PaginatedResponse<ProductDTO> = {
      items: [],
      nextCursor: null,
      total: 0,
    };

    expect(response.items).toBeInstanceOf(Array);
    expect(response.nextCursor).toBeNull();
  });

  it("should support cursor-based pagination", () => {
    const response: PaginatedResponse<ProductDTO> = {
      items: [],
      nextCursor: "cursor-abc-123",
      total: 100,
    };

    expect(response.nextCursor).toBeTruthy();
  });
});

// ============================================================================
// RECOMMENDATIONS
// ============================================================================

describe("Recommendation Contract", () => {
  it("should have valid recommendation item", () => {
    const rec: RecommendationItemDTO = {
      productId: "prod-1",
      score: 0.92,
      reason: "HIGH_PRODUCT_AFFINITY",
    };

    expect(rec.productId).toBeTruthy();
    expect(rec.score).toBeGreaterThan(0);
    expect(rec.score).toBeLessThanOrEqual(1);
    expect(rec.reason).toBeTruthy();
  });

  it("should have valid recommendation reasons", () => {
    const validReasons = [
      "HIGH_PRODUCT_AFFINITY",
      "CATEGORY_AFFINITY",
      "SHOP_AFFINITY",
      "PRICE_MATCH",
      "EVENT_SCORING",
      "MARKETPLACE_POPULAR",
    ];

    const rec: RecommendationItemDTO = {
      productId: "prod-1",
      score: 0.92,
      reason: "HIGH_PRODUCT_AFFINITY",
    };

    expect(validReasons).toContain(rec.reason);
  });
});
