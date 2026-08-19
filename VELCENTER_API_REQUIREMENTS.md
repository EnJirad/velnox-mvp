# VelCenter Web App — API Requirements

> **Client:** VelCenter (Web — Vite + React)
> **Backend:** Velnox Backend (Convex + Neon)
> **Date:** 2026-08-19

---

## Overview

VelCenter is the company admin panel. Owners, admins, and staff manage users, sellers, products, orders, payments, and platform settings. All API calls go through Convex.

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

### Owner Bootstrap (First-Time)
- **Function:** `users.ownerBootstrap`
- **Request:** `{ code: string, name, email, password }`
- **Note:** Only available when no owner exists

### Sign Out
- **Function:** `signOut()`

### Role Check
- **Expected roles:** `owner`, `admin`, `staff`

---

## 2. Dashboard

### Owner Dashboard Stats
- **Function:** `center.dashboardStats`
- **Response:** Total users, sellers, products, orders, revenue
- **Charts:** Revenue trend, order trend, user growth

### Admin Dashboard
- **Function:** `center.dashboardStats` (filtered by department)
- **Response:** Department-scoped stats
- **Note:** Staff sees read-only numbers; admin sees full data

### Marketplace Insights (Behavioral)
- **Function:** `memory.marketInsights`
- **Response:** Top searches, top categories, popular products, event count
- **Note:** Aggregated, no personal data

---

## 3. User Management

### User List
- **Function:** `centerAdmin.listUsers`
- **Request:** `{ role?, limit?, offset? }`
- **Response:** User list with roles, status

### User Detail
- **Function:** `centerAdmin.getUser` (if exists)
- **Request:** `{ userId }`
- **Response:** Full user profile, order history, activity

### Set User Role/Access
- **Function:** `centerAdmin.setUserAccess`
- **Request:** `{ userId, role, department? }`
- **Note:** Only owner can change roles

### Create Employee
- **Function:** `centerAdmin.createEmployee` (if exists)
- **Request:** `{ name, email, role, department }`
- **Note:** Sends password setup email

### Deactivate User
- **Function:** `centerAdmin.deactivateUser` (if exists)
- **Request:** `{ userId }`

### Employee Permissions
- **Function:** `centerAdmin.setEmployeePermissions` (if exists)
- **Request:** `{ userId, permissions: Permission[] }`
- **Permissions:** VIEW_USERS, EDIT_USERS, VIEW_SELLERS, APPROVE_SELLERS, etc.

---

## 4. Seller Management

### Seller List
- **Function:** `centerAdmin.listSellers`
- **Request:** `{ status?, limit? }`
- **Response:** Seller list with status, shop info

### Approve/Reject Seller
- **Function:** `centerAdmin.approveSeller` / `centerAdmin.rejectSeller`
- **Request:** `{ sellerId, reason? }`
- **Note:** Only pending sellers can be approved/rejected

### Suspend Seller
- **Function:** `centerAdmin.suspendSeller` (if exists)
- **Request:** `{ sellerId, reason }`

### Seller Detail
- **Function:** `centerAdmin.getSeller` (if exists)
- **Request:** `{ sellerId }`
- **Response:** Seller profile, shops, products, orders, revenue

---

## 5. Product Management

### All Products
- **Function:** `centerAdmin.listAllProducts`
- **Request:** `{ status?, category?, limit?, offset? }`
- **Response:** Product list across all sellers

### Product Moderation
- **Function:** `centerAdmin.approveProduct` / `centerAdmin.rejectProduct`
- **Request:** `{ productId, reason? }`
- **Note:** Products need moderation when status = 'pending_review'

### Product Detail
- **Function:** `centerAdmin.getProduct` (if exists)
- **Request:** `{ productId }`
- **Response:** Full product with images, seller info, inventory

### Suspend Product
- **Function:** `centerAdmin.suspendProduct` (if exists)
- **Request:** `{ productId, reason }`

---

## 6. Order Management

### All Orders
- **Function:** `centerAdmin.listAllOrders`
- **Request:** `{ status?, limit?, offset? }`
- **Response:** Order list across all customers/sellers

### Order Detail
- **Function:** `centerAdmin.getOrder` (if exists)
- **Request:** `{ orderId }`
- **Response:** Full order with items, customer, seller, payments

### Order Status Override
- **Function:** `centerAdmin.updateOrderStatus` (if exists)
- **Request:** `{ orderId, status, reason }`
- **Note:** Admin override for exceptional cases

### Process Refund
- **Function:** `centerAdmin.processRefund` (if exists)
- **Request:** `{ orderId, amount, reason }`
- **Note:** Only for approved returns

---

## 7. Payment & Finance

### Payment List
- **Function:** `centerAdmin.listPayments`
- **Request:** `{ status?, method?, limit? }`
- **Response:** Payment records across all orders

### Financial Summary
- **Function:** `finance.platformSummary` (if exists)
- **Response:** Total revenue, commissions, refunds, payouts

### Commission Management
- **Function:** `finance.listCommissions`
- **Request:** `{ status?, sellerId?, limit? }`
- **Response:** Commission records

### Settle Commissions
- **Function:** `finance.settleCommissions` (if exists)
- **Request:** `{ sellerId, periodStart, periodEnd }`
- **Note:** Batch settle pending commissions

### Payout Management
- **Function:** `finance.listPayouts`
- **Request:** `{ status?, sellerId?, limit? }`
- **Response:** Payout requests

### Process Payout
- **Function:** `finance.processPayout` (if exists)
- **Request:** `{ payoutId, action: "approve" | "reject" }`

### Ledger
- **Function:** `finance.listLedgerEntries`
- **Request:** `{ type?, sellerId?, limit? }`
- **Response:** Financial transaction log

---

## 8. Platform Settings

### Get Settings
- **Function:** `centerAdmin.getPlatformSettings` (if exists)
- **Response:** Platform configuration

### Update Settings
- **Function:** `centerAdmin.updatePlatformSettings` (if exists)
- **Request:** Settings object
- **Note:** Only owner can change platform settings

### Business Rules
- **Function:** `rules.getBusinessRules`
- **Response:** Configurable rules (commission %, return threshold, etc.)

### Update Business Rules
- **Function:** `rules.updateBusinessRules` (if exists)
- **Request:** Rule changes
- **Audit:** All changes logged

---

## 9. Business Goals

### List Goals
- **Function:** `goals.listGoals`
- **Response:** Business goals with progress

### Create Goal
- **Function:** `goals.createGoal`
- **Request:** `{ title, category, targetValue, period, dueDate? }`

### Update Goal
- **Function:** `goals.updateGoal`
- **Request:** `{ goalId, currentValue? }`

### Goal Categories
- Revenue, Orders, Customers, Other

### Goal Periods
- Monthly, Quarterly, Yearly

---

## 10. Audit Logs

### Audit Log List
- **Function:** `centerAdmin.listAuditLogs`
- **Request:** `{ action?, entityType?, limit? }`
- **Response:** Admin action audit trail

### Audit Log Detail
- **Function:** `centerAdmin.getAuditLog` (if exists)
- **Request:** `{ logId }`
- **Response:** Full audit entry with before/after state

### Logged Actions
- User role changes
- Seller approve/reject/suspend
- Product approve/reject/suspend
- Platform setting changes
- Business rule changes
- Payout processing

---

## 11. Notifications

### Platform Notifications
- **Function:** `centerAdmin.listNotifications` (if exists)
- **Request:** `{ type?, limit? }`
- **Response:** System notifications

### Send Notification
- **Function:** `centerAdmin.sendNotification` (if exists)
- **Request:** `{ userIds?, type, title, message }`
- **Note:** Broadcast or targeted

---

## 12. Behavioral Analytics (To Build)

### Marketplace Trends
- **Function:** `analytics.marketplaceTrends` (TO BUILD)
- **Request:** `{ period: "7d" | "30d" | "90d" }`
- **Response:** Event volume, top categories, search trends

### Customer Cohorts
- **Function:** `analytics.customerCohorts` (TO BUILD)
- **Response:** User segments by behavior (new, returning, inactive)

### Conversion Funnel
- **Function:** `analytics.conversionFunnel` (TO BUILD)
- **Response:** View → Cart → Checkout → Purchase funnel

### Recommendation Performance
- **Function:** `analytics.recommendationPerformance` (TO BUILD)
- **Response:** Recommendation CTR, conversion rate

### Event Volume Monitoring
- **Function:** `analytics.eventVolume` (TO BUILD)
- **Response:** Events by type over time
- **Note:** Used for capacity planning

---

## 13. Reports (To Build)

### Sales Report
- **Function:** `reports.salesReport` (TO BUILD)
- **Request:** `{ period, groupBy: "day" | "week" | "month" }`
- **Response:** Sales data points

### Seller Report
- **Function:** `reports.sellerReport` (TO BUILD)
- **Request:** `{ sellerId, period }`
- **Response:** Seller performance metrics

### Product Report
- **Function:** `reports.productReport` (TO BUILD)
- **Request:** `{ productId?, category?, period }`
- **Response:** Product performance metrics

### Financial Report
- **Function:** `reports.financialReport` (TO BUILD)
- **Request:** `{ period }`
- **Response:** Revenue, commissions, refunds, net

### Export
- **Function:** `reports.exportReport` (TO BUILD)
- **Request:** `{ type, format: "csv" | "xlsx" }`
- **Response:** Download URL

---

## 14. Event Tracking

### Admin Events (Server-Sided)
- **Note:** Admin actions are tracked via audit_logs, not customerEvents
- **Events:** USER_ROLE_CHANGED, SELLER_APPROVED, PRODUCT_MODERATED, etc.

### Key Admin Actions to Track

| Event | Trigger | Context |
|-------|---------|---------|
| USER_CREATED | Create employee | userId, role |
| USER_ROLE_CHANGED | Change role | userId, oldRole, newRole |
| SELLER_APPROVED | Approve seller | sellerId |
| SELLER_REJECTED | Reject seller | sellerId, reason |
| SELLER_SUSPENDED | Suspend seller | sellerId, reason |
| PRODUCT_APPROVED | Approve product | productId |
| PRODUCT_REJECTED | Reject product | productId, reason |
| PLATFORM_SETTING_CHANGED | Update settings | key, oldValue, newValue |
| BUSINESS_RULE_CHANGED | Update rules | key, oldValue, newValue |
| PAYOUT_PROCESSED | Process payout | payoutId, amount |

---

## 15. Employee Management

### Employee List
- **Function:** `centerAdmin.listEmployees` (if exists)
- **Response:** Employee list with roles, departments, status

### Create Employee
- **Function:** `centerAdmin.createEmployee`
- **Request:** `{ name, email, role, department }`
- **Note:** Only owner can create employees

### Update Employee
- **Function:** `centerAdmin.updateEmployee` (if exists)
- **Request:** `{ userId, role?, department?, status? }`

### Reset Password
- **Function:** `centerAdmin.resetEmployeePassword` (if exists)
- **Request:** `{ userId }`
- **Note:** Forces password change on next login

### Deactivate Employee
- **Function:** `centerAdmin.deactivateEmployee` (if exists)
- **Request:** `{ userId }`

---

## 16. Security

### Access Control Matrix

| Feature | Owner | Admin | Staff |
|---------|-------|-------|-------|
| View Users | ✅ | ✅ | ✅ |
| Edit Users | ✅ | ✅ | ❌ |
| View Sellers | ✅ | ✅ | ✅ |
| Approve Sellers | ✅ | ✅ | ❌ |
| Suspend Sellers | ✅ | ❌ | ❌ |
| View Products | ✅ | ✅ | ✅ |
| Approve Products | ✅ | ✅ | ❌ |
| View Orders | ✅ | ✅ | ✅ |
| Manage Orders | ✅ | ✅ | ❌ |
| View Finance | ✅ | ✅ | ❌ |
| Manage Payouts | ✅ | ❌ | ❌ |
| Platform Settings | ✅ | ❌ | ❌ |
| Manage Employees | ✅ | ❌ | ❌ |
| Business Goals | ✅ | ✅ | ❌ |
| Audit Logs | ✅ | ✅ | ❌ |

### Department Scoping
- Staff sees data only for their department
- Admin sees all business data but no employee management
- Owner sees everything, manages employees

### Audit Trail
- Every admin action is logged with actor, action, entity, before/after state
- Logs are immutable
- IP address and user agent captured

---

## 17. Image Upload

### All uploads via server-side only
- Product images: Convex → Cloudinary
- User avatars: Convex → Cloudinary
- Store images: Convex → Cloudinary
- **NEVER** direct browser → Cloudinary

### Upload Limits
- Max file size: 10MB
- Allowed formats: JPEG, PNG, WebP
- Max images per product: 5

---

## 18. Error Handling

### Standard Errors
- `UNAUTHORIZED` — Not signed in
- `FORBIDDEN` — Insufficient permissions
- `NOT_FOUND` — Resource not found
- `VALIDATION_ERROR` — Invalid input
- `ALREADY_EXISTS` — Duplicate resource

### Admin-Specific Errors
- `CANNOT_MODIFY_SELF` — Can't change own role
- `CANNOT_DEACTIVATE_OWNER` — Owner can't be deactivated
- `SELLER_NOT_PENDING` — Seller not in pending state
- `PRODUCT_NOT_PENDING` — Product not in pending moderation
- `INSUFFICIENT_FUNDS` — Not enough for payout
- `BOOTSTRAP_UNAVAILABLE` — Owner already exists
