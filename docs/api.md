# VELNOX — API (Convex actions)

Version: 1.0 · Phase 10 — ตรงกับโค้ดจริง

## 1. Architecture

- Frontend เรียก **Convex functions โดยตรง** (typed client) — ไม่มี REST server แยก (decision D2)
- `src/backend/*` = data access + business logic (Neon); `src/convex/*` = API layer (auth/ownership/validation/rate-limit + events)
- Http action เดียว: `GET /health` (`src/convex/http.ts`)

## 2. Error contract

- ทุก action ทิ้ง `AppError` (code + safe Thai message) — `src/backend/errors.ts`
- Codes: `AUTH_REQUIRED` · `FORBIDDEN` · `NOT_FOUND` · `INVALID_INPUT` · `OUT_OF_STOCK` · `PRICE_CHANGED` · `ORDER_NOT_FOUND` · `SHOP_NOT_FOUND` · `PRODUCT_NOT_FOUND` · `INSUFFICIENT_STOCK` · `INVALID_STATUS_TRANSITION` · `PAYMENT_FAILED` · `ADDRESS_GPS_REQUIRED` · `CONFLICT`
- Client ไม่เห็น stack trace / DB error / secret (tests: `tests/errors.test.ts`)

## 3. VelShop — `src/convex/customer.ts` (+ commerce.ts)

| กลุ่ม | actions |
|---|---|
| Catalog | `catalogProductsAction` (filter/sort/pagination) · `categoryStatsAction` · `getProductDetail` · shop detail/reviews |
| Account | `syncUser` · address CRUD · cart (add/update/remove) · `checkoutAction` |
| Orders | `myOrders` · `orderDetail` · `cancelOrderAction` · `reorderAction` · tracking |
| After-sale | `requestReturnAction` · `reviewAction` · wishlist toggle · notifications |
| VelRepeat | `createVelRepeat` · `mySubscriptions` · `updateSubscriptionAction` · pause/resume |

## 4. VelSeller — `src/convex/commerce.ts`

| กลุ่ม | actions |
|---|---|
| Shop | `openShop` · `mySellerProfile` · `updateShopInfo` · `updateShopLocationAction` |
| Product | `createProductAction` · `updateProductAction` · `setProductStatusAction` · `deleteProductAction` · image upload (signed → save) |
| Inventory | `setStockAction` · `setReorderLevelAction` |
| Order | `sellerOrders` · `setOrderStatus` (state machine) · `confirmPayment` · `refundAction` · `sellerIncomeReport` |
| VelRepeat | `sellerSubscriptions` · `processDueSubscriptions` |

## 5. VelCenter — `src/convex/centerAdmin.ts`

Platform settings · seller moderation (approve/reject/suspend) · product moderation · staff permissions (owner-only) · financial reports · payouts · audit log list · `recomputeBalances` (owner)

## 6. Security ทุก action

auth → authorization → ownership → zod validation → business rule → audit log (สำหรับ write สำคัญ) → rate limit (checkout/cancel/review/return/subscribe)
