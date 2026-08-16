import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------

export const ACCOUNT_TYPES = {
  CUSTOMER: "customer",
  SELLER: "seller",
  EMPLOYEE: "employee",
} as const;
export const accountTypeValidator = v.union(
  v.literal(ACCOUNT_TYPES.CUSTOMER),
  v.literal(ACCOUNT_TYPES.SELLER),
  v.literal(ACCOUNT_TYPES.EMPLOYEE),
);
export type AccountType = Infer<typeof accountTypeValidator>;

export const SELLER_STATUS = {
  PENDING: "PENDING",
  UNDER_REVIEW: "UNDER_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  SUSPENDED: "SUSPENDED",
  DISABLED: "DISABLED",
} as const;
export const sellerStatusValidator = v.union(
  v.literal(SELLER_STATUS.PENDING),
  v.literal(SELLER_STATUS.UNDER_REVIEW),
  v.literal(SELLER_STATUS.APPROVED),
  v.literal(SELLER_STATUS.REJECTED),
  v.literal(SELLER_STATUS.SUSPENDED),
  v.literal(SELLER_STATUS.DISABLED),
);
export type SellerStatus = Infer<typeof sellerStatusValidator>;

export const PRODUCT_STATUS = {
  DRAFT: "DRAFT",
  PENDING_REVIEW: "PENDING_REVIEW",
  REJECTED: "REJECTED",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  ARCHIVED: "ARCHIVED",
} as const;
export const productStatusValidator = v.union(
  v.literal(PRODUCT_STATUS.DRAFT),
  v.literal(PRODUCT_STATUS.PENDING_REVIEW),
  v.literal(PRODUCT_STATUS.REJECTED),
  v.literal(PRODUCT_STATUS.ACTIVE),
  v.literal(PRODUCT_STATUS.SUSPENDED),
  v.literal(PRODUCT_STATUS.ARCHIVED),
);
export type ProductStatus = Infer<typeof productStatusValidator>;

export const ORDER_STATUS = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  PROCESSING: "PROCESSING",
  SHIPPED: "SHIPPED",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
  REFUNDED: "REFUNDED",
} as const;
export const orderStatusValidator = v.union(
  v.literal(ORDER_STATUS.PENDING),
  v.literal(ORDER_STATUS.CONFIRMED),
  v.literal(ORDER_STATUS.PROCESSING),
  v.literal(ORDER_STATUS.SHIPPED),
  v.literal(ORDER_STATUS.DELIVERED),
  v.literal(ORDER_STATUS.CANCELLED),
  v.literal(ORDER_STATUS.REFUNDED),
);
export type OrderStatus = Infer<typeof orderStatusValidator>;

export const PAYOUT_STATUS = {
  PENDING: "PENDING",
  AVAILABLE: "AVAILABLE",
  PAID: "PAID",
} as const;
export const payoutStatusValidator = v.union(
  v.literal(PAYOUT_STATUS.PENDING),
  v.literal(PAYOUT_STATUS.AVAILABLE),
  v.literal(PAYOUT_STATUS.PAID),
);
export type PayoutStatus = Infer<typeof payoutStatusValidator>;

export const VELREPEAT_STATUS = {
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  CANCELLED: "CANCELLED",
} as const;
export const velrepeatStatusValidator = v.union(
  v.literal(VELREPEAT_STATUS.ACTIVE),
  v.literal(VELREPEAT_STATUS.PAUSED),
  v.literal(VELREPEAT_STATUS.CANCELLED),
);
export type VelRepeatStatus = Infer<typeof velrepeatStatusValidator>;

// Employee roles (VelCenter RBAC)
export const EMPLOYEE_ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  COMPANY_OWNER: "COMPANY_OWNER",
  EXECUTIVE: "EXECUTIVE",
  HR_ADMIN: "HR_ADMIN",
  FINANCE_ADMIN: "FINANCE_ADMIN",
  OPERATIONS_ADMIN: "OPERATIONS_ADMIN",
  SELLER_ADMIN: "SELLER_ADMIN",
  CUSTOMER_SUPPORT: "CUSTOMER_SUPPORT",
  ANALYST: "ANALYST",
  STAFF: "STAFF",
} as const;
export const employeeRoleValidator = v.union(
  v.literal(EMPLOYEE_ROLES.SUPER_ADMIN),
  v.literal(EMPLOYEE_ROLES.COMPANY_OWNER),
  v.literal(EMPLOYEE_ROLES.EXECUTIVE),
  v.literal(EMPLOYEE_ROLES.HR_ADMIN),
  v.literal(EMPLOYEE_ROLES.FINANCE_ADMIN),
  v.literal(EMPLOYEE_ROLES.OPERATIONS_ADMIN),
  v.literal(EMPLOYEE_ROLES.SELLER_ADMIN),
  v.literal(EMPLOYEE_ROLES.CUSTOMER_SUPPORT),
  v.literal(EMPLOYEE_ROLES.ANALYST),
  v.literal(EMPLOYEE_ROLES.STAFF),
);
export type EmployeeRole = Infer<typeof employeeRoleValidator>;

const localizedText = v.object({
  th: v.string(),
  en: v.string(),
  my: v.string(),
});

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // The users table brought in by authTables, extended with Velnox identity.
    users: defineTable({
      name: v.optional(v.string()),
      image: v.optional(v.string()),
      email: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),

      role: v.optional(v.string()), // legacy role field, kept for compatibility

      accountType: v.optional(accountTypeValidator), // customer | seller | employee
      status: v.optional(v.union(v.literal("active"), v.literal("disabled"))),
      locale: v.optional(v.string()), // th | en | my
      phone: v.optional(v.string()),
    }).index("email", ["email"]),

    categories: defineTable({
      name: localizedText,
      slug: v.string(),
      image: v.optional(v.string()),
      active: v.boolean(),
      sortOrder: v.number(),
    }).index("by_slug", ["slug"]),

    // A single record serves as both the seller application and the approved
    // shop. status drives the lifecycle.
    sellers: defineTable({
      userId: v.id("users"),
      storeName: v.string(),
      storeSlug: v.string(),
      logo: v.optional(v.string()),
      banner: v.optional(v.string()),
      description: v.optional(v.string()),
      contactPerson: v.optional(v.string()),
      contactPhone: v.optional(v.string()),
      contactEmail: v.optional(v.string()),
      businessInfo: v.optional(v.string()),
      storeAddress: v.optional(v.string()),
      returnAddress: v.optional(
        v.object({
          contactPerson: v.optional(v.string()),
          phone: v.optional(v.string()),
          line1: v.optional(v.string()),
          district: v.optional(v.string()),
          subdistrict: v.optional(v.string()),
          province: v.optional(v.string()),
          postalCode: v.optional(v.string()),
          country: v.optional(v.string()),
        }),
      ),
      businessHours: v.optional(v.string()),
      shippingSettings: v.optional(
        v.object({
          shipsNationwide: v.optional(v.boolean()),
          flatFee: v.optional(v.number()),
          freeShippingThreshold: v.optional(v.number()),
          processingDays: v.optional(v.number()),
        }),
      ),
      policies: v.optional(v.string()),
      paymentInfo: v.optional(
        v.object({
          method: v.optional(v.string()),
          accountName: v.optional(v.string()),
          accountNumber: v.optional(v.string()),
          bankName: v.optional(v.string()),
        }),
      ),
      documents: v.optional(v.array(v.string())),
      agreementAccepted: v.optional(v.boolean()),

      status: sellerStatusValidator,
      rejectionReason: v.optional(v.string()),
      reviewedBy: v.optional(v.id("users")),
      reviewedAt: v.optional(v.number()),
      approvedAt: v.optional(v.number()),
      submittedAt: v.optional(v.number()),
    }).index("by_user", ["userId"]).index("by_slug", ["storeSlug"]),

    products: defineTable({
      sellerId: v.id("sellers"),
      categoryId: v.optional(v.id("categories")),
      name: v.string(),
      slug: v.string(),
      description: v.string(),
      price: v.number(), // minor units
      sku: v.optional(v.string()),
      stock: v.number(),
      reserved: v.number(),
      images: v.array(v.string()),
      weight: v.optional(v.number()),
      shippingInfo: v.optional(v.string()),
      status: productStatusValidator,
      rejectionReason: v.optional(v.string()),
      reviewedBy: v.optional(v.id("users")),
      reviewedAt: v.optional(v.number()),
      totalSold: v.number(),
      updatedAt: v.number(),
    })
      .index("by_seller", ["sellerId"])
      .index("by_category", ["categoryId"])
      .index("by_slug", ["slug"])
      .index("by_status", ["status"]),

    variants: defineTable({
      productId: v.id("products"),
      name: v.string(),
      price: v.optional(v.number()), // minor units, overrides product price
      sku: v.optional(v.string()),
      stock: v.number(),
      reserved: v.number(),
    }).index("by_product", ["productId"]),

    cartItems: defineTable({
      userId: v.optional(v.id("users")),
      sessionId: v.optional(v.string()),
      productId: v.id("products"),
      variantId: v.optional(v.id("variants")),
      quantity: v.number(),
      updatedAt: v.number(),
    }).index("by_user", ["userId"]).index("by_session", ["sessionId"]),

    wishlistItems: defineTable({
      userId: v.id("users"),
      productId: v.id("products"),
    }).index("by_user", ["userId"]).index("by_product", ["productId"]),

    addresses: defineTable({
      userId: v.id("users"),
      label: v.string(),
      type: v.union(v.literal("shipping"), v.literal("billing")),
      name: v.string(),
      phone: v.string(),
      line1: v.string(),
      line2: v.optional(v.string()),
      district: v.optional(v.string()),
      subdistrict: v.optional(v.string()),
      province: v.string(),
      postalCode: v.string(),
      country: v.string(),
      isDefault: v.optional(v.boolean()),
    }).index("by_user", ["userId"]),

    orders: defineTable({
      userId: v.id("users"),
      orderNumber: v.string(),
      status: orderStatusValidator,
      currency: v.string(),
      itemsSubtotal: v.number(), // minor units
      shippingFee: v.number(),
      discount: v.number(),
      total: v.number(),
      commissionTotal: v.number(),
      paymentMethod: v.string(),
      idempotencyKey: v.optional(v.string()),
      shippingAddress: v.optional(
        v.object({
          name: v.string(),
          phone: v.string(),
          line1: v.string(),
          province: v.string(),
          postalCode: v.string(),
        }),
      ),
      notes: v.optional(v.string()),
      paidAt: v.optional(v.number()),
      deliveredAt: v.optional(v.number()),
      cancelledAt: v.optional(v.number()),
    }).index("by_user", ["userId"]).index("by_number", ["orderNumber"]),

    orderItems: defineTable({
      orderId: v.id("orders"),
      sellerId: v.id("sellers"),
      productId: v.id("products"),
      variantId: v.optional(v.id("variants")),
      productName: v.string(),
      variantName: v.optional(v.string()),
      image: v.optional(v.string()),
      unitPrice: v.number(), // minor units, snapshot
      quantity: v.number(),
      subtotal: v.number(),
      commission: v.number(),
      sellerNet: v.number(),
      status: orderStatusValidator,
    })
      .index("by_order", ["orderId"])
      .index("by_seller", ["sellerId"]),

    payouts: defineTable({
      sellerId: v.id("sellers"),
      periodStart: v.number(),
      periodEnd: v.number(),
      gross: v.number(),
      commission: v.number(),
      fees: v.number(),
      refunds: v.number(),
      net: v.number(),
      status: payoutStatusValidator,
      paidAt: v.optional(v.number()),
    }).index("by_seller", ["sellerId"]),

    notifications: defineTable({
      userId: v.id("users"),
      type: v.string(),
      title: v.string(),
      body: v.optional(v.string()),
      link: v.optional(v.string()),
      read: v.boolean(),
    }).index("by_user", ["userId"]),

    auditLogs: defineTable({
      actorId: v.optional(v.id("users")),
      action: v.string(),
      targetType: v.string(),
      targetId: v.optional(v.string()),
      metadata: v.optional(v.any()),
      requestId: v.optional(v.string()),
    }).index("by_target", ["targetType", "targetId"]).index("by_action", ["action"]),

    settings: defineTable({
      key: v.string(),
      value: v.any(),
    }).index("by_key", ["key"]),

    velrepeat: defineTable({
      userId: v.id("users"),
      productId: v.id("products"),
      quantity: v.number(),
      frequencyDays: v.number(),
      status: velrepeatStatusValidator,
      nextOrderDate: v.optional(v.number()),
      lastOrderDate: v.optional(v.number()),
      createdAt: v.number(),
    }).index("by_user", ["userId"]).index("by_product", ["productId"]),

    behaviorEvents: defineTable({
      eventType: v.string(),
      sessionId: v.string(),
      anonymousId: v.optional(v.string()),
      userId: v.optional(v.id("users")),
      productId: v.optional(v.id("products")),
      sellerId: v.optional(v.id("sellers")),
      categoryId: v.optional(v.id("categories")),
      metadata: v.optional(v.any()),
      timestamp: v.number(),
    })
      .index("by_session", ["sessionId"])
      .index("by_user", ["userId"])
      .index("by_type", ["eventType"])
      .index("by_product", ["productId"]),

    employees: defineTable({
      userId: v.id("users"),
      employeeId: v.string(), // e.g. VL-0001
      role: employeeRoleValidator,
      department: v.string(),
      status: v.union(v.literal("active"), v.literal("disabled")),
      mustVerify: v.optional(v.boolean()), // force fresh OTP verification
      createdAt: v.number(),
    }).index("by_user", ["userId"]).index("by_employee_id", ["employeeId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
