# VelShop Mobile App — API Requirements

> **Client:** VelShop (Mobile App — React Native or similar)
> **Backend:** Velnox Backend (Convex + Neon)
> **Date:** 2026-08-19

---

## Overview

VelShop is the customer-facing mobile application. All API calls go through the Velnox Backend (Convex). The mobile app NEVER communicates directly with Cloudinary, Neon, or any external service.

---

## 1. Authentication

### Email OTP Login
- **Function:** `signIn("email-otp", formData)`
- **Request:** `{ email: string }`
- **Response:** OTP sent to email
- **Error:** Rate limit, invalid email

### OTP Verification
- **Function:** `signIn("email-otp", formData)`
- **Request:** `{ email: string, code: string }`
- **Response:** Session token
- **Error:** Invalid/expired code

### Anonymous Session
- **Function:** `signIn("anonymous")`
- **Response:** Anonymous session
- **Note:** Anonymous users get global popularity, not personalized memory

### Sign Out
- **Function:** `signOut()`
- **Response:** Session cleared

### Identity Merge (Guest → Account)
- **Function:** `memoryEvents.mergeAnonymousToUser`
- **Request:** `{ anonymousId: string }`
- **Note:** Called automatically on sign-in to preserve browsing history

---

## 2. Home Feed

### Personalized Recommendations
- **Function:** `memory.recommendForCustomer`
- **Request:** `{ limit?: number }`
- **Response:** `{ items: Product[], source: "personal" | "popular" }`
- **Note:** Returns personalized picks for signed-in users, popular items for guests

### Storefront Settings
- **Function:** `storefront.settings`
- **Response:** `{ shopName, tagline, phone, address, announcement }`
- **Note:** Public, no auth required

### Featured Products
- **Function:** `commerce.listProducts`
- **Request:** `{ status: "published", limit: 10 }`
- **Response:** Product list with images

---

## 3. Product Discovery

### Product List (Browse)
- **Function:** `commerce.listProducts`
- **Request:** `{ status: "published", category?, limit?, offset? }`
- **Response:** Paginated product list
- **Events:** CATEGORY_VIEW, SHOP_VIEW

### Product Search
- **Function:** `commerce.searchProducts` (or equivalent)
- **Request:** `{ query: string, limit?: number }`
- **Response:** Search results
- **Events:** SEARCH

### Product Detail
- **Function:** `commerce.getProduct`
- **Request:** `{ productId: string }`
- **Response:** Full product with images, shop info
- **Events:** PRODUCT_VIEW

### Category List
- **Function:** `commerce.listCategories`
- **Response:** Category hierarchy
- **Events:** CATEGORY_VIEW (on browse)

---

## 4. Product Interactions

### Interest/Like
- **Function:** `intelligence.recordInterest`
- **Request:** `{ productId: string }`
- **Events:** INTEREST

### Wishlist Add
- **Function:** `commerce.addToWishlist` (if exists)
- **Request:** `{ productId: string }`
- **Events:** WISHLIST_ADD

### Wishlist Remove
- **Function:** `commerce.removeFromWishlist` (if exists)
- **Request:** `{ productId: string }`
- **Events:** WISHLIST_REMOVE

---

## 5. Cart

### Get Cart
- **Function:** `commerce.getCart`
- **Response:** Cart with items, totals

### Add to Cart
- **Function:** `commerce.addToCart`
- **Request:** `{ productId: string, quantity: number }`
- **Events:** CART_ADD
- **Validation:** Stock check, max quantity

### Remove from Cart
- **Function:** `commerce.removeFromCart`
- **Request:** `{ cartItemId: string }`
- **Events:** CART_REMOVE

### Update Cart Item
- **Function:** `commerce.updateCartItem` (if exists)
- **Request:** `{ cartItemId: string, quantity: number }`

---

## 6. Checkout

### Create Order
- **Function:** `commerce.createOrder`
- **Request:** `{ addressId: string, note?: string, idempotencyKey: string }`
- **Response:** `{ orderId: string, orderNumber: string }`
- **Events:** CHECKOUT_START → PURCHASE (on success)
- **Note:** Idempotent — retry-safe with idempotencyKey

### Get Addresses
- **Function:** `commerce.listAddresses`
- **Response:** Customer saved addresses

### Add Address
- **Function:** `commerce.createAddress`
- **Request:** Address details

---

## 7. Orders

### My Orders List
- **Function:** `commerce.listMyOrders`
- **Request:** `{ status?, limit?, offset? }`
- **Response:** Order list with items

### Order Detail
- **Function:** `commerce.getOrder`
- **Request:** `{ orderId: string }`
- **Response:** Full order with items, status, tracking

### Order Tracking
- **Function:** `commerce.getOrderTracking` (if exists)
- **Request:** `{ orderId: string }`
- **Response:** Shipment tracking info

---

## 8. Profile

### Get Profile
- **Function:** `users.currentUser`
- **Response:** User profile (name, email, role, avatar, cover)

### Update Profile
- **Function:** `customer.updateProfile` (if exists)
- **Request:** `{ name?, phone? }`

### Upload Avatar
- **Function:** `customer.getProfileImageUploadSignature` → Cloudinary (server-side)
- **Flow:** Get signature → POST to Cloudinary → Save profile image
- **Note:** Mobile MUST use server-side upload (not direct Cloudinary)

### Upload Cover
- **Same as avatar but with kind: "cover"**

---

## 9. Recommendations

### Personalized Recommendations
- **Function:** `memory.recommendForCustomer`
- **Request:** `{ limit?: number }`
- **Response:** `{ items: Product[], source: "personal" | "popular" }`

### Due Reorder Reminders
- **Function:** `memory.dueReorderReminders`
- **Response:** Products due for reorder based on purchase history

### Customer Memory
- **Function:** `memory.myMemory`
- **Response:** `{ categories, searches, shops, intent, eventCount }`

---

## 10. Subscriptions (VelRepeat)

### My Subscriptions
- **Function:** `subscriptions.listMySubscriptions`
- **Response:** Active subscriptions

### Create Subscription
- **Function:** `subscriptions.createSubscription`
- **Request:** `{ productId, quantity, intervalDays }`
- **Events:** VELREPEAT_START

### Pause/Cancel Subscription
- **Function:** `subscriptions.pauseSubscription` / `cancelSubscription`
- **Events:** VELREPEAT_CANCEL

---

## 11. Notifications

### List Notifications
- **Function:** `commerce.listNotifications` (if exists)
- **Response:** User notifications

### Mark Read
- **Function:** `commerce.markNotificationRead` (if exists)
- **Request:** `{ notificationId: string }`

### Push Token Registration
- **Function:** `customer.registerPushToken` (TO BUILD)
- **Request:** `{ token: string, platform: "ios" | "android" }`
- **Note:** Required for push notifications

---

## 12. Event Tracking

### Track Event
- **Function:** `memoryEvents.track`
- **Request:** `{ type: string, entityId?, value?, context?, anonymousId? }`
- **Note:** Fire-and-forget, never blocks UI

### Supported Events (Mobile)

| Event | Trigger | Context |
|-------|---------|---------|
| APP_OPEN | App launch | — |
| SESSION_START | Session begin | — |
| SESSION_END | Session end | — |
| PRODUCT_VIEW | Product detail screen | productId |
| PRODUCT_CLICK | Product card tap | productId |
| PRODUCT_IMAGE_VIEW | Image zoom/expand | productId |
| SEARCH | Search execution | query |
| SEARCH_RESULT_CLICK | Search result tap | productId, position |
| CATEGORY_VIEW | Category browse | category |
| SHOP_VIEW | Shop detail | shopId |
| WISHLIST_ADD | Add to wishlist | productId |
| WISHLIST_REMOVE | Remove from wishlist | productId |
| CART_ADD | Add to cart | productId, quantity |
| CART_REMOVE | Remove from cart | productId |
| CHECKOUT_START | Begin checkout | — |
| PURCHASE | Order completed | orderId, total |
| REPEAT_PURCHASE | Reorder | orderId, productId |
| RECOMMENDATION_VIEW | Recommendation shown | recommendationId |
| RECOMMENDATION_CLICK | Recommendation tap | productId |
| NOTIFICATION_OPEN | Notification tap | notificationId |
| FILTER_APPLY | Apply filter | filterType, filterValue |
| SORT_CHANGE | Change sort | sortBy |

---

## 13. Offline Support (Future Phase)

### Cached Data
- Product catalog (recently viewed)
- User profile
- Cart contents
- Order history

### Sync Strategy
- Queue events locally, send on reconnect
- Cache product images (with expiration)
- Show stale data with "last updated" indicator

---

## 14. Image Requirements

### Product Images
- Primary image: 800x800 (display)
- Thumbnail: 200x200 (cards)
- Gallery: up to 5 images per product

### Profile Images
- Avatar: 400x400 (display)
- Cover: 1200x400 (banner)

### Upload Flow (Mobile)
```
1. User selects image
2. Client validates (type, size ≤ 10MB)
3. Request signature from: customer.getProfileImageUploadSignature
4. POST to Cloudinary (server-side via Convex HTTP)
5. Save profile image URL
6. Display updated image
```

---

## 15. Error Handling

### Standard Error Response
```json
{
  "error": "Error type",
  "message": "Human-readable message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common Errors
- `UNAUTHORIZED` — Not signed in
- `FORBIDDEN` — No permission
- `NOT_FOUND` — Resource not found
- `VALIDATION_ERROR` — Invalid input
- `RATE_LIMITED` — Too many requests
- `NETWORK_ERROR` — Connection issue
- `STOCK_INSUFFICIENT` — Not enough inventory

### Mobile-Specific Errors
- `OFFLINE` — No network connection
- `SYNC_FAILED` — Background sync failed
- `PUSH_TOKEN_EXPIRED` — Need to re-register
