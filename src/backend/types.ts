/**
 * Velnox Backend — domain types for the Neon Commerce Core.
 * These are the API shapes returned by src/backend services (NOT raw rows).
 * Money is always `number` (THB, rounded to 2 decimals) at this boundary;
 * the DB stores NUMERIC(12,2).
 */

export type Role = "customer" | "seller" | "staff" | "admin" | "owner";
export type Department = "marketing" | "sales" | "operations" | "finance" | "general";
export type MerchantStatus = "pending" | "approved" | "suspended";
export type ShopStatus = "active" | "suspended" | "closed";
export type ProductStatus = "draft" | "published" | "archived";
export type ProductCategory = "general" | "food" | "daily" | "beauty" | "packaging" | "other";
export type OrderStatus = "pending" | "confirmed" | "shipped" | "delivered" | "completed" | "cancelled";
export type PaymentStatus = "unpaid" | "pending" | "paid" | "partially_refunded" | "refunded" | "failed";
export type ShippingStatus = "not_shipped" | "processing" | "shipped" | "delivered" | "returned";
export type PaymentMethod = "cod" | "transfer" | "card" | "promptpay" | "wallet";
export type PaymentRowStatus = "pending" | "succeeded" | "failed" | "refunded";
export type RefundStatus = "requested" | "approved" | "processed" | "rejected";
export type CommissionStatus = "pending" | "settled" | "voided";
export type SubscriptionFrequency = "daily" | "weekly" | "monthly" | "custom";
export type SubscriptionStatus = "active" | "paused" | "cancelled";

export interface User {
  id: string;
  convexId: string | null;
  email: string | null;
  phone: string | null;
  name: string | null;
  role: Role;
  department: Department | null;
  createdAt: string;
}

export interface Merchant {
  id: string;
  ownerUserId: string;
  name: string;
  taxId: string | null;
  status: MerchantStatus;
  refundPolicyLimit: number; // 0.10 = platform pays at most 10% if return rate exceeds it
  createdAt: string;
}

export interface Shop {
  id: string;
  merchantId: string;
  name: string;
  slug: string | null;
  description: string | null;
  imageUrl: string | null;
  phone: string | null;
  address: string | null;
  announcement: string | null;
  status: ShopStatus;
  commissionRate: number; // 0.03 = 3% platform fee
  currency: string;
  createdAt: string;
}

export interface Product {
  id: string;
  shopId: string;
  name: string;
  description: string | null;
  category: ProductCategory;
  unit: string;
  price: number;
  currency: string;
  status: ProductStatus;
  supplier: string | null;
  createdAt: string;
  updatedAt: string;
  images?: ProductImage[];
  inventory?: Inventory;
}

export interface ProductImage {
  id: string;
  productId: string;
  url: string;
  position: number;
}

export interface Inventory {
  id: string;
  productId: string;
  shopId: string;
  quantity: number;
  reservedQuantity: number;
  reorderLevel: number;
  warehouse: string;
  /** quantity - reservedQuantity (available to sell now) */
  available: number;
}

export interface Address {
  id: string;
  userId: string;
  label: string;
  recipientName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string | null;
  country: string;
  isDefault: boolean;
}

/** Frozen shipping address stored in orders.address_snapshot (JSONB). */
export interface AddressSnapshot {
  recipientName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerUserId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  shippingStatus: ShippingStatus;
  shippingMethod: string | null;
  trackingNumber: string | null;
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  currency: string;
  addressSnapshot: AddressSnapshot;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  shopId: string;
  merchantId: string;
  productName: string; // snapshot at purchase time
  unit: string; // snapshot
  unitPrice: number; // snapshot — never re-read product.price for old orders
  quantity: number;
  subtotal: number;
  commissionRate: number; // snapshot of shop rate
}

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentRowStatus;
  externalRef: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface Refund {
  id: string;
  orderId: string;
  paymentId: string | null;
  amount: number;
  reason: string | null;
  status: RefundStatus;
  createdAt: string;
}

export interface Subscription {
  id: string;
  customerUserId: string;
  productId: string;
  shopId: string;
  merchantId: string;
  quantity: number;
  unitPriceSnapshot: number;
  frequency: SubscriptionFrequency;
  intervalDays: number;
  nextOrderDate: string; // YYYY-MM-DD
  status: SubscriptionStatus;
  createdAt: string;
  updatedAt: string;
  productName?: string; // joined
}
