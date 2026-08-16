/**
 * Velnox Backend — domain types for the Neon Commerce Core.
 * These are the API shapes returned by src/backend services (NOT raw rows).
 *
 * Money: the DB stores NUMERIC(12,2); at this boundary we expose `number`
 * (THB, rounded to 2 decimals). Calculation-critical math (order totals,
 * commissions, refunds) runs server-side in the services, never in the
 * frontend.
 */

export type Role = "customer" | "seller" | "staff" | "admin" | "owner";
export type Department = "marketing" | "sales" | "operations" | "finance" | "general";
export type SellerStatus = "pending" | "approved" | "rejected" | "suspended";
export type ShopStatus = "active" | "suspended" | "closed";
export type ProductStatus = "draft" | "pending_review" | "published" | "rejected" | "archived";
export type ProductCategory = "general" | "food" | "daily" | "beauty" | "packaging" | "other";
export type OrderStatus = "pending" | "confirmed" | "shipped" | "delivered" | "completed" | "cancelled";
export type PaymentStatus = "unpaid" | "pending" | "paid" | "partially_refunded" | "refunded" | "failed";
export type ShippingStatus = "not_shipped" | "processing" | "shipped" | "delivered" | "returned";
export type PaymentMethod = "cod" | "transfer" | "card" | "promptpay" | "wallet" | "online";
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

export interface Seller {
  id: string;
  ownerUserId: string;
  name: string;
  taxId: string | null;
  status: SellerStatus;
  /** reason shown when the application was rejected (null otherwise) */
  rejectionReason: string | null;
  /** 0.10 = platform pays at most 10% of sales if the return rate exceeds it */
  refundPolicyLimit: number;
  createdAt: string;
}

export interface Shop {
  id: string;
  sellerId: string;
  name: string;
  slug: string | null;
  description: string | null;
  imageUrl: string | null;
  phone: string | null;
  address: string | null;
  announcement: string | null;
  status: ShopStatus;
  /** 0.03 = 3% platform fee */
  commissionRate: number;
  currency: string;
  /** storefront GPS — used for pickup / return shipping / delivery area */
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
}

export interface ProductImage {
  id: string;
  productId: string;
  /** secure CDN URL (original) */
  url: string;
  /** CDN URL with display transformation (w_800, c_limit, auto format) */
  displayUrl: string;
  /** CDN URL with thumbnail transformation (w_200, h_200, c_fill) */
  thumbUrl: string;
  storageProvider: string;
  /** storage public_id / key (needed to delete the binary from storage) */
  storageKey: string | null;
  alt: string | null;
  sortOrder: number;
  isPrimary: boolean;
  width: number | null;
  height: number | null;
  createdAt: string;
}

export interface Product {
  id: string;
  shopId: string;
  sellerId: string;
  name: string;
  description: string | null;
  category: ProductCategory;
  unit: string;
  price: number;
  currency: string;
  status: ProductStatus;
  /** moderation rejection reason (null unless status === 'rejected') */
  rejectionReason: string | null;
  supplier: string | null;
  createdAt: string;
  updatedAt: string;
  images?: ProductImage[];
  /** primary image (images[0] when set) — convenience for cards */
  primaryImage?: ProductImage | null;
  inventory?: Inventory;
  /** joined for the storefront */
  shopName?: string;
  sellerName?: string;
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
  subdistrict: string | null;
  district: string | null;
  province: string | null;
  postalCode: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  isDefault: boolean;
  createdAt: string;
}

/** Frozen shipping address stored in orders.address_snapshot (JSONB). */
export interface AddressSnapshot {
  recipientName: string;
  phone: string;
  line1: string;
  line2?: string;
  city?: string;
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
  /** joined for seller views */
  customerName?: string;
  customerPhone?: string;
  itemCount?: number;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  shopId: string;
  sellerId: string;
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

export interface Commission {
  id: string;
  orderItemId: string;
  orderId: string;
  sellerId: string;
  shopId: string;
  orderAmount: number;
  commissionRate: number;
  commissionAmount: number;
  status: CommissionStatus;
  settledAt: string | null;
  createdAt: string;
}

export interface Subscription {
  id: string;
  customerUserId: string;
  productId: string;
  shopId: string;
  sellerId: string;
  quantity: number;
  unitPriceSnapshot: number;
  frequency: SubscriptionFrequency;
  intervalDays: number;
  nextOrderDate: string; // YYYY-MM-DD
  status: SubscriptionStatus;
  createdAt: string;
  updatedAt: string;
  productName?: string; // joined
  productImageUrl?: string; // joined (primary image)
}

// ===========================================================================
// Phase 3 — marketplace foundation entities
// ===========================================================================

export interface Category {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  imageUrl: string | null;
  parentId: string | null;
  level: number;
  sortOrder: number;
  isActive: boolean;
  children?: Category[];
}

export interface Cart {
  id: string;
  userId: string;
  status: "active" | "checked_out" | "abandoned";
  createdAt: string;
  updatedAt: string;
  items?: CartItem[];
}

export interface CartItem {
  id: string;
  cartId: string;
  productId: string;
  variantId: string | null;
  sellerId: string;
  shopId: string;
  quantity: number;
  priceSnapshot: number;
  createdAt: string;
  // joined for display
  productName?: string;
  productImageUrl?: string;
  shopName?: string;
  availableStock?: number;
  unit?: string;
}

export interface WishlistItem {
  id: string;
  wishlistId: string;
  productId: string;
  createdAt: string;
  product?: Product;
}

export interface Shipment {
  id: string;
  orderId: string;
  sellerId: string;
  carrier: string;
  trackingNumber: string | null;
  status: string;
  shippingFee: number;
  estimatedDeliveryDate: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  events?: TrackingEvent[];
}

export interface TrackingEvent {
  id: string;
  shipmentId: string;
  status: string;
  description: string | null;
  location: string | null;
  occurredAt: string;
}

export type ReturnStatus =
  | "requested"
  | "under_review"
  | "approved"
  | "rejected"
  | "return_shipping"
  | "received"
  | "refunding"
  | "refunded"
  | "cancelled";

export interface ReturnRequest {
  id: string;
  orderId: string;
  customerUserId: string;
  sellerId: string;
  reason: string | null;
  description: string | null;
  evidenceUrls: string[];
  status: ReturnStatus;
  refundAmount: number;
  returnTrackingNumber: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  productId: string;
  shopId: string;
  userId: string;
  orderId: string | null;
  rating: number;
  title: string | null;
  comment: string | null;
  images: string[];
  status: "published" | "pending" | "hidden";
  createdAt: string;
  userName?: string; // joined
}

export interface Notification {
  id: string;
  userId: string;
  type: "order" | "payment" | "shipping" | "return" | "refund" | "promotion" | "system" | "seller";
  title: string;
  message: string | null;
  data: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

export interface PlatformSetting {
  key: string;
  value: unknown;
}

/** Resolved business rules from platform_settings (never hard-coded). */
export interface BusinessRules {
  platformName: string;
  currency: string;
  /** percent (e.g. 3 = 3%) */
  platformCommissionPercent: number;
  /** percent of shipping revenue that belongs to the platform */
  shippingCompanyPercent: number;
  /** max return rate % the platform covers (10 = 10%) */
  returnRateThreshold: number;
  autoApproveSellers: boolean;
  autoApproveProducts: boolean;
  taxEnabled: boolean;
  taxPercent: number;
}

export type LedgerType =
  | "sale"
  | "platform_commission"
  | "shipping_revenue"
  | "seller_payout"
  | "refund"
  | "return_cost"
  | "penalty"
  | "adjustment";

export interface LedgerEntry {
  id: string;
  transactionId: string | null;
  orderId: string | null;
  sellerId: string | null;
  type: LedgerType;
  amount: number;
  currency: string;
  description: string | null;
  createdAt: string;
}

export interface SellerBalance {
  sellerId: string;
  availableBalance: number;
  pendingBalance: number;
  totalEarned: number;
  totalWithdrawn: number;
  currency: string;
  updatedAt: string;
}

export interface SellerPayout {
  id: string;
  sellerId: string;
  amount: number;
  currency: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  method: string | null;
  destination: string | null;
  requestedAt: string;
  processedAt: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

/** Permission codes (spec §47) — stored on staff_profiles.permissions. */
export const PERMISSIONS = [
  "VIEW_USERS",
  "EDIT_USERS",
  "VIEW_SELLERS",
  "APPROVE_SELLERS",
  "SUSPEND_SELLERS",
  "VIEW_PRODUCTS",
  "APPROVE_PRODUCTS",
  "SUSPEND_PRODUCTS",
  "VIEW_ORDERS",
  "MANAGE_ORDERS",
  "VIEW_FINANCE",
  "MANAGE_PAYOUTS",
  "MANAGE_PLATFORM_SETTINGS",
] as const;
export type Permission = (typeof PERMISSIONS)[number];
