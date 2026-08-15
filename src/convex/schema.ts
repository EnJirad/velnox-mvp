import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// Velnox has 3 sites sharing one backend + database:
// - velshop  (customer / shopper)
// - velseller (seller / merchant who opened a shop with us)
// - velcenter (company-only: owner / admin / staff with scoped permissions)
export const ROLES = {
  // velcenter: company owner — everything, including managing employees
  OWNER: "owner",
  // velcenter: department-scoped admin (e.g. marketing) — business data but no employee management
  ADMIN: "admin",
  // velcenter: employee with view access to business numbers
  STAFF: "staff",
  // velseller: merchant who opened a shop
  SELLER: "seller",
  // velshop: shopper (default)
  CUSTOMER: "customer",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.OWNER),
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.STAFF),
  v.literal(ROLES.SELLER),
  v.literal(ROLES.CUSTOMER),
);
export type Role = Infer<typeof roleValidator>;

// Department scoping for velcenter employees (owner manages who sees what).
export const departmentValidator = v.union(
  v.literal("marketing"),
  v.literal("sales"),
  v.literal("operations"),
  v.literal("finance"),
  v.literal("general"),
);
export type Department = Infer<typeof departmentValidator>;

// Business goal categories for the owner dashboard
export const goalCategoryValidator = v.union(
  v.literal("revenue"),
  v.literal("orders"),
  v.literal("customers"),
  v.literal("other"),
);
export type GoalCategory = Infer<typeof goalCategoryValidator>;

// Goal tracking periods
export const goalPeriodValidator = v.union(
  v.literal("monthly"),
  v.literal("quarterly"),
  v.literal("yearly"),
);
export type GoalPeriod = Infer<typeof goalPeriodValidator>;

// Customer order status (velshop -> seller fulfillment)
export const orderStatusValidator = v.union(
  v.literal("pending"),
  v.literal("confirmed"),
  v.literal("completed"),
  v.literal("cancelled"),
);
export type OrderStatus = Infer<typeof orderStatusValidator>;

// Product categories for the Smart Reorder inventory
export const productCategoryValidator = v.union(
  v.literal("general"),
  v.literal("food"),
  v.literal("daily"),
  v.literal("beauty"),
  v.literal("packaging"),
  v.literal("other"),
);
export type ProductCategory = Infer<typeof productCategoryValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
      department: v.optional(departmentValidator), // velcenter department scope
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // business goals / targets for the owner goals dashboard
    goals: defineTable({
      userId: v.id("users"),
      title: v.string(),
      description: v.optional(v.string()),
      category: goalCategoryValidator,
      unit: v.string(),
      targetValue: v.number(),
      currentValue: v.number(),
      period: goalPeriodValidator,
      dueDate: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_user", ["userId"]),

    // inventory products for the Smart Reorder feature (owner restocking)
    // and the velshop storefront (published + price)
    products: defineTable({
      userId: v.id("users"),
      name: v.string(),
      category: productCategoryValidator,
      unit: v.string(),
      currentStock: v.number(),
      reorderLevel: v.number(),
      price: v.optional(v.number()),
      description: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      published: v.optional(v.boolean()),
      supplier: v.optional(v.string()),
      // Velnox "Learn": estimated cycle set by the owner, overwritten once real
      // purchase history teaches the actual average cycle (days between reorders).
      estimatedCycleDays: v.optional(v.number()),
      avgCycleDays: v.optional(v.number()),
      purchaseCount: v.number(),
      lastOrderedAt: v.optional(v.number()),
      lastPurchaseQty: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_user", ["userId"]),

    // reorder history (purchase history) — the basis of Velnox Intelligence
    purchases: defineTable({
      userId: v.id("users"),
      productId: v.id("products"),
      quantity: v.number(),
      cost: v.optional(v.number()),
      note: v.optional(v.string()),
      orderedAt: v.number(),
      createdAt: v.number(),
    }).index("by_user", ["userId"]),

    // customer orders placed on velshop (customer -> shop)
    orders: defineTable({
      userId: v.id("users"), // the customer who placed the order
      status: orderStatusValidator,
      customerName: v.string(),
      customerPhone: v.string(),
      customerAddress: v.optional(v.string()),
      note: v.optional(v.string()),
      total: v.number(),
      itemCount: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_user", ["userId"]),

    // line items snapshot of an order (product name/price at order time)
    orderItems: defineTable({
      orderId: v.id("orders"),
      productId: v.id("products"),
      productName: v.string(),
      unit: v.string(),
      quantity: v.number(),
      price: v.number(), // unit price snapshot (THB)
      subtotal: v.number(),
    }).index("by_order", ["orderId"]),

    // VelRepeat analytics: every "สนใจ / view" click a shopper makes on velshop.
    // Data is kept per customer so Velnox can learn who is interested in what
    // and recommend the right products to the right person.
    // NOTE: productId is the NEON product id (Commerce Core lives in Neon).
    productViews: defineTable({
      userId: v.optional(v.id("users")), // null = signed-out visitor
      productId: v.id("products"),
      viewedAt: v.number(),
    })
      .index("by_product", ["productId"])
      .index("by_user", ["userId"]),

    // VelRepeat interests for the Neon storefront (legacy productViews above
    // are kept for the legacy Convex storefront; this table tracks clicks on
    // products whose source of truth lives in Neon).
    interests: defineTable({
      userId: v.optional(v.id("users")), // null = signed-out visitor
      productId: v.string(), // Neon product id
      viewedAt: v.number(),
    })
      .index("by_product", ["productId"])
      .index("by_user", ["userId"]),

    // Neon -> Convex business event bridge (realtime/intelligence foundation).
    // The commerce layer writes an event here whenever a business fact changes
    // in Neon (OrderCreated, PaymentConfirmed, OrderStatusChanged, ...).
    businessEvents: defineTable({
      type: v.string(),
      entityId: v.string(), // Neon entity id (order id, product id, ...)
      payload: v.any(),
      createdAt: v.number(),
    })
      .index("by_entity", ["entityId"])
      .index("by_type", ["type"]),

    // -----------------------------------------------------------------------
    // Customer Memory & Personal Intelligence (docs/Velnox-CPNS.md)
    // -----------------------------------------------------------------------
    // "ทุก Interaction คือข้อมูล": every meaningful shopper action on velshop
    // is recorded here, bound to the customer identity (userId) — or to a
    // guest anonymous session (anonymousId) when signed out. Personalization
    // reads ONLY the authenticated user's own rows ("ของใคร ของมัน").
    // entityId is the NEON commerce id (product / shop / category).
    customerEvents: defineTable({
      userId: v.optional(v.id("users")), // signed-in customer
      anonymousId: v.optional(v.string()), // guest session (localStorage uuid)
      type: v.string(), // PRODUCT_VIEW | PRODUCT_CLICK | SEARCH | CATEGORY_VIEW | SHOP_VIEW | INTEREST | WISHLIST_ADD | WISHLIST_REMOVE | CART_ADD | CART_REMOVE | CHECKOUT_START | PURCHASE | REORDER | VELREPEAT_START
      entityId: v.optional(v.string()), // Neon product / shop / category id
      value: v.optional(v.string()), // search query / category label
      context: v.optional(v.any()), // extra hints (price, quantity, page)
      createdAt: v.number(),
    })
      .index("by_user_type", ["userId", "type", "createdAt"])
      .index("by_anonymous", ["anonymousId", "createdAt"])
      .index("by_type", ["type", "createdAt"]),

    // Monthly subscription purchases (velshop "สั่งรายเดือน"): the shop
    // auto-places a new order every intervalDays for the customer.
    subscriptions: defineTable({
      userId: v.id("users"),
      productId: v.id("products"),
      quantity: v.number(),
      intervalDays: v.number(),
      status: v.union(
        v.literal("active"),
        v.literal("paused"),
        v.literal("cancelled"),
      ),
      nextOrderAt: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_product", ["productId"]),

    // single store settings doc (shopName, contact info, announcement)
    storeSettings: defineTable({
      key: v.literal("main"),
      shopName: v.optional(v.string()),
      tagline: v.optional(v.string()),
      phone: v.optional(v.string()),
      address: v.optional(v.string()),
      announcement: v.optional(v.string()),
      updatedAt: v.number(),
    }).index("by_key", ["key"]),

    // API rate limiting counters (spec §25): one doc per (name, key) window.
    // Used by write-heavy / abuse-prone node actions (checkout, review,
    // return, subscription) — a fixed sliding window enforced server-side.
    rateLimits: defineTable({
      name: v.string(), // e.g. "checkout", "review", "otp"
      key: v.string(), // e.g. user id (or ip for auth endpoints)
      count: v.number(),
      resetAt: v.number(), // epoch ms when the window resets
    }).index("by_name_key", ["name", "key"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
