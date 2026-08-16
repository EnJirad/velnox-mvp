import { getCurrentUser } from "./users";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

// ---------------------------------------------------------------------------
// Platform constants — all money in minor units (satang, 1/100 of a baht)
// ---------------------------------------------------------------------------

export const CURRENCY = "THB";
export const COMMISSION_RATE = 0.1; // Velnox takes 10% of each item subtotal
export const FLAT_SHIPPING_MINOR = 4500; // ฿45 flat shipping
export const FREE_SHIPPING_THRESHOLD_MINOR = 100000; // free shipping over ฿1,000

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const generateOrderNumber = () =>
  `VL-${Date.now().toString(36).toUpperCase()}${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;

export const requireUser = async (ctx: QueryCtx | MutationCtx) => {
  const user = await getCurrentUser(ctx);
  if (user === null) {
    throw new Error("You must be signed in to do that.");
  }
  return user;
};

export const audit = async (
  ctx: MutationCtx,
  args: {
    actorId?: Id<"users"> | null;
    action: string;
    targetType: string;
    targetId?: string | null;
    metadata?: Record<string, unknown>;
  },
) => {
  await ctx.db.insert("auditLogs", {
    actorId: args.actorId ?? undefined,
    action: args.action,
    targetType: args.targetType,
    targetId: args.targetId ?? undefined,
    metadata: args.metadata,
  });
};

// ---------------------------------------------------------------------------
// Order item lifecycle — who can move an item where
// ---------------------------------------------------------------------------

export const ORDER_ITEM_FLOW: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
  REFUNDED: [],
};

export const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

export const PRODUCT_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Pending review",
  REJECTED: "Rejected",
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  ARCHIVED: "Archived",
};

export const SELLER_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  SUSPENDED: "Suspended",
  DISABLED: "Disabled",
};

/**
 * Derive the order-level status from its item statuses.
 */
export const deriveOrderStatus = (items: Doc<"orderItems">[]): string => {
  if (items.length === 0) return "PENDING";
  const statuses = items.map((item) => item.status);
  if (statuses.every((s) => s === "DELIVERED")) return "DELIVERED";
  if (statuses.every((s) => s === "CANCELLED" || s === "REFUNDED"))
    return "CANCELLED";
  if (statuses.some((s) => s === "PENDING")) return "PENDING";
  if (statuses.some((s) => s === "CONFIRMED")) return "CONFIRMED";
  if (statuses.some((s) => s === "PROCESSING")) return "PROCESSING";
  if (statuses.some((s) => s === "SHIPPED")) return "SHIPPED";
  return "PENDING";
};

/** Available stock for a product or variant (stock minus reserved). */
export const availableStock = (doc: { stock: number; reserved: number }) =>
  Math.max(0, doc.stock - doc.reserved);
