/**
 * Frontend-facing types for the Neon Commerce Core.
 *
 * The frontend NEVER writes business data directly — it calls the commerce
 * actions (src/convex/commerce.ts) which run the backend services against
 * Neon. These types mirror the backend's API shapes (src/backend/types.ts).
 */

// ---------------------------------------------------------------------------
// products & images
// ---------------------------------------------------------------------------
export interface StoreImage {
  id: string;
  productId: string;
  url: string;
  displayUrl: string;
  thumbUrl: string;
  storageProvider: string;
  storageKey: string | null;
  alt: string | null;
  sortOrder: number;
  isPrimary: boolean;
  width: number | null;
  height: number | null;
  createdAt: string;
}

export interface StoreInventory {
  id: string;
  productId: string;
  shopId: string;
  quantity: number;
  reservedQuantity: number;
  reorderLevel: number;
  warehouse: string;
  available: number;
}

export type StoreProductStatus = "draft" | "published" | "archived";
export type StoreProductCategory = "general" | "food" | "daily" | "beauty" | "packaging" | "other";

export interface StoreProduct {
  id: string;
  shopId: string;
  sellerId: string;
  name: string;
  description: string | null;
  category: StoreProductCategory;
  unit: string;
  price: number;
  currency: string;
  status: StoreProductStatus;
  supplier: string | null;
  createdAt: string;
  updatedAt: string;
  images?: StoreImage[];
  primaryImage?: StoreImage | null;
  inventory?: StoreInventory;
  shopName?: string;
  sellerName?: string;
}

export interface StoreShop {
  id: string;
  sellerId: string;
  name: string;
  slug: string | null;
  description: string | null;
  imageUrl: string | null;
  phone: string | null;
  address: string | null;
  announcement: string | null;
  status: "active" | "suspended" | "closed";
  commissionRate: number;
  currency: string;
  createdAt: string;
}

export interface SellerProfile {
  seller: {
    id: string;
    ownerUserId: string;
    name: string;
    taxId: string | null;
    status: "pending" | "approved" | "suspended";
    refundPolicyLimit: number;
    createdAt: string;
  };
  shops: StoreShop[];
}

// ---------------------------------------------------------------------------
// orders
// ---------------------------------------------------------------------------
export type StoreOrderStatus =
  | "pending"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "completed"
  | "cancelled";
export type StorePaymentStatus =
  | "unpaid"
  | "pending"
  | "paid"
  | "partially_refunded"
  | "refunded"
  | "failed";

export interface StoreAddressSnapshot {
  recipientName: string;
  phone: string;
  line1: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface StoreOrderItem {
  id: string;
  orderId: string;
  productId: string;
  shopId: string;
  sellerId: string;
  productName: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  commissionRate: number;
}

export interface StoreOrder {
  id: string;
  orderNumber: string;
  customerUserId: string;
  status: StoreOrderStatus;
  paymentStatus: StorePaymentStatus;
  shippingStatus: string;
  shippingMethod: string | null;
  trackingNumber: string | null;
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  currency: string;
  addressSnapshot: StoreAddressSnapshot;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  items?: StoreOrderItem[];
  customerName?: string;
  customerPhone?: string;
  itemCount?: number;
}

export const ORDER_STATUS_META: Record<
  StoreOrderStatus,
  { label: string; badge: string; dot: string }
> = {
  pending: {
    label: "รอตรวจสอบ",
    badge: "bg-amber-50 text-amber-700 ring-amber-600/15 hover:bg-amber-50",
    dot: "bg-amber-500",
  },
  confirmed: {
    label: "ยืนยันแล้ว",
    badge: "bg-sky-50 text-sky-700 ring-sky-600/15 hover:bg-sky-50",
    dot: "bg-sky-500",
  },
  shipped: {
    label: "กำลังจัดส่ง",
    badge: "bg-indigo-50 text-indigo-700 ring-indigo-600/15 hover:bg-indigo-50",
    dot: "bg-indigo-500",
  },
  delivered: {
    label: "จัดส่งแล้ว",
    badge: "bg-teal-50 text-teal-700 ring-teal-600/15 hover:bg-teal-50",
    dot: "bg-teal-500",
  },
  completed: {
    label: "เสร็จสิ้น",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/15 hover:bg-emerald-50",
    dot: "bg-emerald-500",
  },
  cancelled: {
    label: "ยกเลิก",
    badge: "bg-slate-100 text-slate-500 ring-slate-600/10 hover:bg-slate-100",
    dot: "bg-slate-400",
  },
};

/** Allowed next statuses per the order state machine (backend enforces too). */
export const NEXT_ORDER_STATUSES: Record<StoreOrderStatus, StoreOrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: ["completed"],
  completed: [],
  cancelled: [],
};

// ---------------------------------------------------------------------------
// subscriptions (VelRepeat)
// ---------------------------------------------------------------------------
export interface StoreSubscription {
  id: string;
  customerUserId: string;
  productId: string;
  shopId: string;
  sellerId: string;
  quantity: number;
  unitPriceSnapshot: number;
  frequency: "daily" | "weekly" | "monthly" | "custom";
  intervalDays: number;
  nextOrderDate: string; // YYYY-MM-DD
  status: "active" | "paused" | "cancelled";
  createdAt: string;
  updatedAt: string;
  productName?: string;
  productImageUrl?: string;
  /** joined for the seller VelRepeat panel */
  customerName?: string;
  customerEmail?: string;
}

// ---------------------------------------------------------------------------
// formatters (Neon timestamps are ISO strings, not Convex ms numbers)
// ---------------------------------------------------------------------------
export function formatBaht(value: number): string {
  return `฿${value.toLocaleString("th-TH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function formatIsoDate(iso: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatIsoDateTime(iso: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function shortOrderId(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

export function shortOrderNumber(orderNumber: string): string {
  return orderNumber.replace(/^ORD-/, "");
}

// ---------------------------------------------------------------------------
// product category labels (mirror of legacy lib/reorder)
// ---------------------------------------------------------------------------
export const PRODUCT_CATEGORY_META: Record<StoreProductCategory, { label: string }> = {
  general: { label: "ทั่วไป" },
  food: { label: "อาหาร" },
  daily: { label: "ของใช้ประจำวัน" },
  beauty: { label: "ความงาม" },
  packaging: { label: "บรรจุภัณฑ์" },
  other: { label: "อื่น ๆ" },
};
