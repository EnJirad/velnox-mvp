/**
 * Velnox API — Shared Response Contracts & DTOs
 *
 * Every client (VelShop Mobile, VelSeller Web, VelCenter Web) uses these
 * shared types to understand the same API shapes.
 *
 * Architecture: Phase 2 — Commerce API Foundation
 */

// ============================================================================
// RESPONSE WRAPPER
// ============================================================================

/** Standard API success response. */
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

/** Standard API error response. */
export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/** Union of success and error. */
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ============================================================================
// PAGINATION
// ============================================================================

export interface PaginationParams {
  limit?: number;
  cursor?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
  total?: number;
}

// ============================================================================
// ERROR CODES
// ============================================================================

export const ERROR_CODES = {
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  PRODUCT_NOT_FOUND: "PRODUCT_NOT_FOUND",
  SHOP_NOT_FOUND: "SHOP_NOT_FOUND",
  ORDER_NOT_FOUND: "ORDER_NOT_FOUND",
  OUT_OF_STOCK: "OUT_OF_STOCK",
  INSUFFICIENT_STOCK: "INSUFFICIENT_STOCK",
  PRICE_CHANGED: "PRICE_CHANGED",
  INVALID_QUANTITY: "INVALID_QUANTITY",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  RATE_LIMITED: "RATE_LIMITED",
  CONFLICT: "CONFLICT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// ============================================================================
// EVENT SOURCES
// ============================================================================

export const EVENT_SOURCES = [
  "VELSHOP",
  "VELSELLER",
  "VELCENTER",
  "WEB",
  "ANDROID",
  "IOS",
  "SYSTEM",
] as const;

export type EventSource = (typeof EVENT_SOURCES)[number];

// ============================================================================
// PRODUCT DTOs
// ============================================================================

export interface ProductImageDTO {
  id: string;
  url: string;
  displayUrl: string;
  thumbUrl: string;
  alt: string | null;
  sortOrder: number;
  isPrimary: boolean;
}

export interface ProductDTO {
  id: string;
  shopId: string;
  name: string;
  description: string | null;
  category: string;
  unit: string;
  price: number;
  currency: string;
  images: ProductImageDTO[];
  status: string;
  averageRating: number | null;
  reviewCount: number;
  stockAvailable: number;
  createdAt: number;
  updatedAt: number;
}

export interface ProductDetailDTO extends ProductDTO {
  shopName: string;
  shopSlug: string | null;
  sellerId: string;
  weight: number | null;
  dimensions: string | null;
}

// ============================================================================
// SHOP / STORE DTOs
// ============================================================================

export interface ShopDTO {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  imageUrl: string | null;
  phone: string | null;
  address: string | null;
  announcement: string | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
  productCount: number;
  orderCount: number;
  rating: number | null;
  reviewCount: number;
  createdAt: number;
}

// ============================================================================
// CATEGORY DTOs
// ============================================================================

export interface CategoryDTO {
  category: string;
  label: string;
  productCount: number;
}

// ============================================================================
// CART DTOs
// ============================================================================

export interface CartItemDTO {
  id: string;
  productId: string;
  productName: string;
  productImage: string | null;
  shopId: string;
  shopName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  stockAvailable: number;
}

export interface CartDTO {
  id: string;
  items: CartItemDTO[];
  itemCount: number;
  subtotal: number;
  currency: string;
}

// ============================================================================
// CHECKOUT DTOs
// ============================================================================

export interface CheckoutCalculation {
  subtotal: number;
  shippingCost: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
}

export interface CheckoutRequest {
  addressId: string;
  paymentMethod: string;
  notes?: string;
  idempotencyKey?: string;
}

// ============================================================================
// ORDER DTOs
// ============================================================================

export type OrderStatusDTO =
  | "pending"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "completed"
  | "cancelled";

export interface OrderItemDTO {
  id: string;
  productId: string;
  productName: string;
  productImage: string | null;
  shopId: string;
  shopName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderDTO {
  id: string;
  status: OrderStatusDTO;
  items: OrderItemDTO[];
  subtotal: number;
  shippingCost: number;
  discount: number;
  total: number;
  currency: string;
  paymentStatus: string;
  shippingStatus: string;
  addressSnapshot: Record<string, unknown> | null;
  notes: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface OrderDetailDTO extends OrderDTO {
  shipments: ShipmentDTO[];
  payments: PaymentDTO[];
  returns: ReturnDTO[];
}

// ============================================================================
// ADDRESS DTOs
// ============================================================================

export interface AddressDTO {
  id: string;
  label: string | null;
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  isDefault: boolean;
  createdAt: number;
}

export interface AddressInput {
  label?: string;
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  province: string;
  postalCode: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}

// ============================================================================
// PAYMENT DTOs
// ============================================================================

export type PaymentStatusDTO = "unpaid" | "pending" | "paid" | "partially_refunded" | "refunded" | "failed";

export interface PaymentDTO {
  id: string;
  orderId: string;
  method: string;
  amount: number;
  currency: string;
  status: string;
  reference: string | null;
  createdAt: number;
}

// ============================================================================
// SHIPMENT DTOs
// ============================================================================

export type ShippingStatusDTO = "not_shipped" | "processing" | "shipped" | "delivered" | "returned";

export interface ShipmentDTO {
  id: string;
  orderId: string;
  carrier: string;
  trackingNumber: string | null;
  status: string;
  estimatedDeliveryDate: string | null;
  createdAt: number;
}

// ============================================================================
// RETURN DTOs
// ============================================================================

export type ReturnStatusDTO = "requested" | "approved" | "processed" | "rejected";

export interface ReturnDTO {
  id: string;
  orderId: string;
  reason: string;
  status: ReturnStatusDTO;
  createdAt: number;
}

// ============================================================================
// USER / PROFILE DTOs
// ============================================================================

export interface UserProfileDTO {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  createdAt: number;
}

// ============================================================================
// NOTIFICATION DTOs
// ============================================================================

export interface NotificationDTO {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: number;
}

// ============================================================================
// SEARCH
// ============================================================================

export interface SearchParams {
  query: string;
  category?: string;
  shopId?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: "relevance" | "price_asc" | "price_desc" | "newest" | "rating";
  limit?: number;
  cursor?: string;
}

// ============================================================================
// BRAIN / RECOMMENDATIONS
// ============================================================================

export interface RecommendationItemDTO {
  productId: string;
  score: number;
  reason: string;
}

export interface CustomerMemoryDTO {
  categories: Array<{
    category: string;
    label: string;
    score: number;
    count: number;
  }>;
  searches: Array<{ q: string; count: number }>;
  shops: Array<{
    shopId: string;
    shopName: string;
    score: number;
    count: number;
  }>;
  intent: "low" | "medium" | "high";
  eventCount: number;
}

export interface ReorderReminderDTO {
  productId: string;
  productName: string;
  times: number;
  avgCycleDays: number;
  lastOrderedAt: number;
  nextDueAt: number;
  daysLeft: number;
  emoji: string;
}
