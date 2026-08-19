# VelSeller Web App — API Requirements

> **Client:** VelSeller (Web — Vite + React)
> **Backend:** Velnox Backend (Convex + Neon)
> **Date:** 2026-08-19

---

## Overview

VelSeller is the merchant-facing web application. Sellers manage their shops, products, orders, and fulfillment. All API calls go through Convex.

---

## 1. Authentication

### Email OTP Login
- **Function:** `signIn("email-otp", formData)`
- **Request:** `{ email: string }`
- **Response:** OTP sent to email

### OTP Verification
- **Function:** `signIn("email-otp", formData)`
- **Request:** `{ email: string, code: string }`
- **Response:** Session token

### Sign Out
- **Function:** `signOut()`

### Role Check
- **Function:** `users.currentUser`
- **Expected role:** `seller` (or `admin`/`owner` for cross-access)

---

## 2. Dashboard

### Seller Dashboard Stats
- **Function:** `sellerOps.dashboardStats` (if exists)
- **Response:** Total orders, revenue, products, pending fulfillment
- **Note:** Neon-backed, seller-scoped

### Recent Orders
- **Function:** `commerce.listSellerOrders`
- **Request:** `{ limit: 10 }`
- **Response:** Latest orders for this seller's shops

### Low Stock Alerts
- **Function:** `sellerOps.lowStockProducts` (if exists)
- **Response:** Products below reorder level

---

## 3. Store Management

### Get Store Profile
- **Function:** `sellerOps.getMyStore` (if exists)
- **Response:** Store details (name, description, contact, image)

### Update Store Profile
- **Function:** `sellerOps.updateStore` (if exists)
- **Request:** `{ name?, description?, phone?, address?, announcement? }`

### Store Image Upload
- **Function:** Server-side upload via Convex
- **Flow:** Get signature → POST to Cloudinary → Save URL

---

## 4. Products

### My Products List
- **Function:** `sellerOps.listSellerProducts`
- **Request:** `{ status?, limit?, offset? }`
- **Response:** Product list with images, inventory

### Product Detail
- **Function:** `sellerOps.getSellerProduct` (if exists)
- **Request:** `{ productId: string }`
- **Response:** Full product with images, inventory, order history

### Create Product
- **Function:** `sellerOps.createProduct`
- **Request:** `{ name, description, category, unit, price, images? }`
- **Response:** Created product
- **Validation:** Price ≥ 0, name required, category valid

### Update Product
- **Function:** `sellerOps.updateProduct`
- **Request:** `{ productId, name?, description?, category?, price?, status? }`
- **Response:** Updated product

### Delete/Archive Product
- **Function:** `sellerOps.archiveProduct` (if exists)
- **Request:** `{ productId: string }`
- **Note:** Soft delete (set status to 'archived')

### Product Image Upload
- **Function:** Server-side upload via Convex
- **Flow:** Get signature → POST to Cloudinary → Save image URL
- **Limit:** Up to 5 images per product, max 10MB each

---

## 5. Inventory

### Get Inventory
- **Function:** `sellerOps.getInventory` (if exists)
- **Request:** `{ productId?: string }`
- **Response:** Stock levels for seller's products

### Update Stock
- **Function:** `sellerOps.updateInventory` (if exists)
- **Request:** `{ productId, quantity, reorderLevel? }`
- **Note:** Direct stock adjustment

### Stock History
- **Function:** `sellerOps.stockHistory` (if exists)
- **Request:** `{ productId, limit? }`
- **Response:** Stock change history

---

## 6. Orders

### Seller Orders List
- **Function:** `commerce.listSellerOrders`
- **Request:** `{ status?, limit?, offset? }`
- **Response:** Orders for this seller's shops

### Order Detail
- **Function:** `commerce.getSellerOrder` (if exists)
- **Request:** `{ orderId: string }`
- **Response:** Full order with items, customer info, shipping

### Update Order Status
- **Function:** `commerce.updateOrderStatus` (if exists)
- **Request:** `{ orderId, status: "confirmed" | "shipped" | "completed" }`
- **Note:** Status progression: pending → confirmed → shipped → delivered → completed

### Confirm Order
- **Function:** `commerce.confirmOrder` (if exists)
- **Request:** `{ orderId: string }`
- **Note:** Seller confirms they can fulfill the order

### Ship Order
- **Function:** `commerce.shipOrder` (if exists)
- **Request:** `{ orderId, trackingNumber, carrier? }`
- **Note:** Creates shipment record

---

## 7. Fulfillment

### Shipment Creation
- **Function:** `commerce.createShipment` (if exists)
- **Request:** `{ orderId, carrier, trackingNumber }`
- **Response:** Shipment record

### Tracking Update
- **Function:** `commerce.updateShipmentTracking` (if exists)
- **Request:** `{ shipmentId, status, location? }`

### Return Requests
- **Function:** `commerce.listReturnRequests` (if exists)
- **Request:** `{ status? }`
- **Response:** Return requests for this seller

### Process Return
- **Function:** `commerce.processReturn` (if exists)
- **Request:** `{ returnId, action: "approve" | "reject", reason? }`

---

## 8. Sales & Revenue

### Sales Summary
- **Function:** `finance.getSellerSales` (if exists)
- **Request:** `{ period: "daily" | "weekly" | "monthly" }`
- **Response:** Sales figures, order counts, revenue

### Revenue by Product
- **Function:** `finance.getRevenueByProduct` (if exists)
- **Request:** `{ period? }`
- **Response:** Product-level revenue breakdown

### Commission History
- **Function:** `finance.getSellerCommissions` (if exists)
- **Request:** `{ limit? }`
- **Response:** Commission records (3% platform fee)

### Payout History
- **Function:** `finance.getSellerPayouts` (if exists)
- **Request:** `{ limit? }`
- **Response:** Payout records

### Request Payout
- **Function:** `finance.requestPayout` (if exists)
- **Request:** `{ amount }`
- **Note:** Triggers payout process

---

## 9. Analytics (To Build)

### Sales Trends
- **Function:** `analytics.sellerSalesTrends` (TO BUILD)
- **Request:** `{ period: "7d" | "30d" | "90d" }`
- **Response:** Daily/weekly sales data points
- **Chart:** Line chart

### Product Performance
- **Function:** `analytics.sellerProductPerformance` (TO BUILD)
- **Request:** `{ period? }`
- **Response:** Views, purchases, revenue per product
- **Chart:** Bar chart, table

### Customer Insights
- **Function:** `analytics.sellerCustomerInsights` (TO BUILD)
- **Note:** Anonymized customer data (no PII)
- **Response:** Repeat purchase rate, average order value

### Order Status Distribution
- **Function:** `analytics.sellerOrderStatus` (TO BUILD)
- **Response:** Orders by status (pending, confirmed, shipped, etc.)
- **Chart:** Pie/donut chart

---

## 10. Reviews

### Product Reviews
- **Function:** `commerce.listProductReviews` (if exists)
- **Request:** `{ productId }`
- **Response:** Reviews for seller's products

### Respond to Review
- **Function:** `commerce.respondToReview` (if exists)
- **Request:** `{ reviewId, response }`
- **Note:** Seller can respond to customer reviews

---

## 11. Notifications

### Seller Notifications
- **Function:** `commerce.listNotifications` (if exists)
- **Request:** `{ type?: "order" | "payment" | "return" }`
- **Response:** Notifications for this seller

### Mark Read
- **Function:** `commerce.markNotificationRead` (if exists)
- **Request:** `{ notificationId }`

---

## 12. Profile

### Seller Profile
- **Function:** `users.currentUser`
- **Response:** User profile + seller info

### Update Profile
- **Function:** `sellerOps.updateProfile` (if exists)
- **Request:** `{ name?, phone? }`

### Change Password
- **Function:** `employeeAuth.changeOwnPassword` (if applicable)
- **Request:** `{ currentPassword, newPassword }`

---

## 13. Event Tracking

### Seller Events (Server-Side)
- **Note:** Most seller events are recorded server-side during actions
- **Events:** PRODUCT_CREATED, PRODUCT_UPDATED, ORDER_CONFIRMED, ORDER_SHIPPED, etc.
- **Function:** `memoryEvents.trackForUser` (server-side)

### Key Seller Actions to Track

| Event | Trigger | Context |
|-------|---------|---------|
| PRODUCT_CREATED | New product | productId, category |
| PRODUCT_UPDATED | Edit product | productId, changes |
| ORDER_CONFIRMED | Accept order | orderId |
| ORDER_SHIPPED | Ship order | orderId, carrier |
| STOCK_UPDATED | Change inventory | productId, oldQty, newQty |
| PAYOUT_REQUESTED | Request payout | amount |
| STORE_UPDATED | Edit store | changes |

---

## 14. Image Upload

### Product Images
- **Max:** 5 images per product
- **Max size:** 10MB per image
- **Formats:** JPEG, PNG, WebP
- **Flow:** Server-side only (Convex → Cloudinary)

### Store Images
- **Logo:** 400x400
- **Cover:** 1200x400
- **Flow:** Server-side only

### Upload Process
```
1. Seller selects image
2. Client validates (type, size ≤ 10MB)
3. Request signature from Convex action
4. POST to Cloudinary via Convex HTTP action
5. Save image URL to product/store
6. Display updated image
```

---

## 15. Error Handling

### Standard Errors
- `UNAUTHORIZED` — Not signed in
- `FORBIDDEN` — Not a seller
- `NOT_FOUND` — Resource not found
- `VALIDATION_ERROR` — Invalid input
- `STOCK_INSUFFICIENT` — Not enough inventory
- `ORDER_ALREADY_CONFIRMED` — Duplicate action
- `PRODUCT_NOT_FOUND` — Product doesn't exist

### Seller-Specific Errors
- `SELLER_NOT_APPROVED` — Seller account pending
- `SHOP_SUSPENDED` — Shop is suspended
- `PRODUCT_REJECTED` — Product was rejected by admin
- `INSUFFICIENT_BALANCE` — Not enough for payout
