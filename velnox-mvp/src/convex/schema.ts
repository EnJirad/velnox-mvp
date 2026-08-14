import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
// Velnox has 3 sites sharing one backend: velshop (customer), velseller
// (seller/owner tools), velcenter (admin/control center).
export const ROLES = {
  ADMIN: "admin",
  SELLER: "seller",
  CUSTOMER: "customer",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.SELLER),
  v.literal(ROLES.CUSTOMER),
);
export type Role = Infer<typeof roleValidator>;

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
  },
  {
    schemaValidation: false,
  },
);

export default schema;
