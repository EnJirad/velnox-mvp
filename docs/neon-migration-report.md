# Velnox — Neon Migration Report

> Status of the V3 data migration (Convex-table MVP → Neon Commerce Core), 2026-08-16.
> Companion: [`data-ownership.md`](./data-ownership.md) (ownership matrix) ·
> [`production-audit.md`](./production-audit.md) (remaining issues).

## 1. Old data source (pre-V3 MVP)

Convex tables were the only store for business data: `users`, `products`, `purchases`,
`orders`, `orderItems`, `subscriptions`, `storeSettings`, `goals`.

## 2. New data source (V3)

**Neon PostgreSQL = authoritative.** `db/schema.sql` + `db/migrations/*` (11 idempotent
migrations, 39 tables) via `backend/*` services. **Convex** keeps only: auth/sessions/roles
(Convex Auth), behavioral events (`customerEvents`, realtime) + durable copy
(`behavioral_events` in Neon), derived intelligence (`interests`, `productViews`,
`businessEvents`, memory), rate-limit counters.

## 3. Tables migrated ✅

| Domain | Neon table | Backend service | Frontend path |
|---|---|---|---|
| Users (business profiles) | `users`, `user_profiles` | `backend/identity.ts` | `commerce.syncUser` / `customer.*` |
| Sellers / Shops | `sellers`, `shops` | `backend/sellers.ts` | `commerce.openShop`, `mySellerProfile`, `customer.publicShops` |
| Products + images | `products`, `product_images` | `backend/products.ts` | `commerce.listProducts`, `customer.publicShops/shopDetail` |
| Inventory | `inventory` | `backend/inventory.ts` | `commerce.setStockAction`, `setReorderLevelAction` |
| Orders | `orders`, `order_items` | `backend/orders.ts`, `backend/checkout.ts` | `customer.checkoutAction`, `myOrders`, `orderDetail`, `commerce.sellerOrders` |
| Payments | `payments`, `payment_transactions`, `refunds` | `backend/payments.ts` | `commerce.confirmPayment`, `refundAction` |
| Addresses | `addresses` | `backend/addresses.ts` | `customer.myAddresses`, `saveAddress` |
| Cart | `carts`, `cart_items` | `backend/carts.ts` | `customer.myCart`, `addToCartAction` |
| Wishlist | `wishlists`, `wishlist_items` | `backend/wishlists.ts` | `customer.myWishlist`, `toggleWishlistAction` |
| Reviews | `reviews` | `backend/reviews.ts` | `customer.reviewProduct`, `productReviews` |
| Returns | `returns`, `return_items` | `backend/returns.ts` | `customer.requestReturnAction` |
| Shipments | `shipments`, `tracking_events` | `backend/shipments.ts` | `sellerOps.*` |
| VelRepeat subscriptions | `subscriptions`, `velrepeat_orders` | `backend/subscriptions.ts` | `commerce.createVelRepeat`, `mySubscriptions`, `processDueSubscriptions` |
| Finance | `financial_ledger`, `seller_balances`, `seller_payouts`, `commissions`, `settlements` | `backend/finance.ts`, `backend/payments.ts` | `sellerOps.sellerFinancialReportAction`, `myPayouts` |
| Platform settings | `platform_settings` | `backend/platformSettings.ts` | (backend-read) |
| Notifications | `notifications` | `backend/notifications.ts` | `customer.myNotifications` |
| Audit | `audit_logs` | `backend/audit.ts` | (backend-written) |
| Behavioral events (durable) | `behavioral_events`, `event_flush_cursor` | `backend/events.ts` | `memory.flushToNeon` (cron) |

## 4. Tables still on Convex (compatibility layer — documented projections)

| Convex table | Purpose | Source of truth | Frontend still using it | Migration |
|---|---|---|---|---|
| `products`, `purchases` | seller Smart Reorder (cycle-learning fields) | Neon `products`+`inventory` (fields missing) | `seller/Reorder.tsx`, `center/Center.tsx` | add cycle fields to Neon (`012_*`), rewire (planned, §5) |
| `goals` | owner/seller goals dashboard | — (planning data) | `seller/SellerGoals.tsx` | move to Neon or accept as Convex-owned planning state |
| `storeSettings` | storefront display settings | Neon `shops` | `shop/ShopHome.tsx`, `center/Center.tsx` | expose public Neon read; retire (planned) |
| `orders`, `orderItems` | legacy read models | Neon `orders` | **none** (dead) | delete after schema migration |
| `subscriptions` (Convex) | legacy | Neon `subscriptions` | **none** (dead) | delete after schema migration |
| `customerEvents` | realtime behavioral events | Neon `behavioral_events` (durable copy) | all apps (tracking) | keep — realtime layer |
| `interests`, `productViews`, `businessEvents` | derived intelligence | Neon + events (rebuildable) | shop, center | keep — derived |
| `users` (Convex) | auth identities + roles | Convex Auth | center role mgmt | keep — auth layer |

## 5. Migration status & remaining work

| # | Work | Status |
|---|---|---|
| 1 | Durable behavioral event store (Neon) + cron | ✅ done (011, `backend/events.ts`, `memory.flushToNeon`) |
| 2 | Seller Smart Reorder → Neon | 📋 planned: migration `012_*` adds `avg_cycle_days`, `estimated_cycle_days`, `last_ordered_at`, `purchase_count` to `products`/`inventory`; new `commerce.productPurchaseHistory` action over Neon `order_items`; rewire `Reorder.tsx` + reorder lib types |
| 3 | Center overview/settings/all-products → Neon | 📋 planned: rebuild `center.overview` over `backend/orders.ts`/`products.ts`/`platformSettings.ts`; expose public store settings from `shops`; retire `api.products.listAll` |
| 4 | Remove dead Convex tables (`orders`, `orderItems`, `subscriptions`) | 📋 after platform-side schema is stable (Convex data migration) |
| 5 | Validation | `db:smoke` + `db:consistency` scripts exist; run against real Neon before launch |

## 6. Rollback strategy

- Migrations are idempotent and additive (`CREATE TABLE IF NOT EXISTS`, guarded `ALTER`).
- No `DROP`/`TRUNCATE` anywhere — nothing destructive exists in `db/`.
- Compatibility layer (§4) keeps the approved UI working until each Neon migration is
  verified; each table is removed only after zero frontend references remain.
- Convex deployment rollback = redeploy the previous deployment; Neon restore = PITR/branch
  (`docs/disaster-recovery.md`).

## 7. Validation results

- `bun run typecheck` — pass (this session)
- `bun test` — 87 pass, 0 fail (this session)
- `bun run build:shop` — pass (this session)
- Neon smoke/consistency — **requires a real `DATABASE_URL`** (add via Keys/API keys UI), then
  `bun run db:smoke` + `bun run db:consistency` per the deployment runbook.
