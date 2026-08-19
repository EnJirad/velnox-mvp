# Velnox — Production Audit

> Full repository audit, 2026-08-16. Verifies the V3 architecture (Neon = source of truth,
> Convex = realtime/intelligence, Vercel = hosting) against the production-completion checklist
> and records every remaining issue. Companion reports: [`architecture-audit.md`](./architecture-audit.md)
> (architecture state) · [`neon-migration-report.md`](./neon-migration-report.md) (data migration
> status).

## 1. Verified good

| Area | Finding |
|---|---|
| Monorepo | `apps/{shop,seller,center,corporate}` + `packages/shared`, Bun workspaces, per-app Vite/tsconfig/vercel.json |
| Four standalone apps | ✅ each builds independently (`build:shop|seller|center|corporate`), each has CSP/security headers + SPA rewrites in `vercel.json` |
| VelShop storefront-first | ✅ root `/` is the storefront; no `/shop` prefix; no app switcher; single “Become a Seller” entry in footer |
| Neon Commerce Core | ✅ `backend/*` (36 modules) + `db/schema.sql` + 11 idempotent migrations (39 tables) |
| Frontend → Neon wiring | ✅ VelShop storefront is fully Neon-backed (`api.customer.*`, `api.commerce.*` — 50 call sites, 0 legacy) |
| Realtime/intelligence | ✅ `convex/memory.ts` + `memoryEvents.ts` + `intelligence.ts`; durable flush to Neon (migration 011 + cron) |
| Auth | ✅ Convex Auth (email OTP + anonymous), roles + department scoping |
| Authorization | ✅ server-side guards (`convex/users.ts`, `backend/identity.ts`, ownership chains); no sensitive op relies on UI-only protection |
| Order/payment safety | ✅ idempotency keys, `withTransaction`, inventory locking, price/address snapshots, audit trail |
| Validation & rate limiting | ✅ zod schemas, sliding-window rate limits (events 300/min, checkout, reviews, OTP) |
| Secrets | ✅ no `DATABASE_URL`/keys in frontend source; no hardcoded secrets; no debug `console.log`; no TODO/FIXME/mock markers in src |
| Env separation | ✅ `VITE_*` public only; `DATABASE_URL`/`CLOUDINARY_*` server-side (Convex deployment env); dev/staging/prod split documented |
| Tests | ✅ 87 vitest tests (business rules, security matrix, validation, memory core, velrepeat, events, …) |
| Docs | ✅ canonical set present (`architecture.md`, `production-audit.md`, `data-ownership.md`, `deployment.md`, `environment.md`, `realtime.md`, `security.md`, `disaster-recovery.md`) + `neon-migration-report.md` |

## 2. Frontend → backend wiring map (what actually runs)

### VelShop (storefront) — ✅ fully Neon-backed
`api.customer.*` (26 call sites: cart, addresses, wishlist, checkout, orders, reviews, returns,
reorder, notifications) · `api.commerce.*` (24: products, subscriptions, interest) ·
`api.memory.*` (3: customer memory, recommendations, reorder reminders) ·
`api.center.getSettings` (1, **legacy** — store settings, see §4).

### VelSeller — mixed (Neon ✅ + legacy ❌)
- ✅ `api.commerce.*` (13): seller orders, products, income, subscriptions, shop, product actions
- ❌ `api.products.*` (4, `Reorder.tsx`): Smart Reorder list/toggle/remove/purchase-history — **Convex tables**
- ❌ `api.goals.*` (2, `SellerGoals.tsx`): goals — **Convex table**

### VelCenter — mixed
- ✅ `api.centerAdmin.*` (3): orders list, market overview, order status — **Neon-backed**
- ✅ `api.memory.marketInsights` (1): derived intelligence — correct
- ✅ `api.users.*` (2): role/access on the **Convex Auth users table** (auth-owned; acceptable — see §4.4)
- ❌ `api.products.listAll` (1): **Convex products table**
- ❌ `api.center.*` (3, `Center.tsx`): overview / getSettings / updateSettings — **Convex tables**

### Corporate — no backend calls (static site) ✅

### Unused legacy Convex modules (no frontend references, verified by grep)
`convex/orders.ts`, `convex/subscriptions.ts` — zero `api.orders.*` / `api.subscriptions.*` call
sites anywhere in `apps/` or `packages/`.

## 3. Security verification

- Convex function audit: every function in `commerce.ts`, `customer.ts`, `sellerOps.ts`,
  `centerAdmin.ts` resolves the identity/role server-side and scopes reads/writes to the
  caller's own data (ownership chain `User→Seller→Shop→Product`).
- VelCenter: `canAccessCenter` on every center query/action; knowing the URL grants nothing.
- Seller isolation: `sellerOrders`, `sellerIncomeReport`, `sellerSubscriptions`, product
  actions all filter by the authenticated seller's id server-side (no IDOR).
- Customer isolation: `myCart`, `myOrders`, `orderDetail`, `myAddresses`, `myWishlist`,
  `myMemory` are scoped to the authenticated user (“ของใคร ของมัน”).
- No `DATABASE_URL`, JWT, private keys, or payment secrets anywhere in frontend source or
  committed files; `.env*` gitignored.
- Error contract: `backend/errors.ts` — `AppError` with stable codes + safe Thai messages; no
  stack traces or SQL leak to clients.

## 4. Remaining issues (all documented, none blocking the approved UI)

### 4.1 [MEDIUM] Seller Smart Reorder still reads Convex product/purchase tables
`apps/seller/src/pages/Reorder.tsx` uses `api.products.{list,listPurchases,togglePublished,
remove}` (Convex `products` + `purchases` tables). The Neon equivalents exist for CRUD
(`api.commerce.listProducts`, `setProductStatusAction`, `deleteProductAction`,
`setStockAction`, `setReorderLevelAction`) but the page's **cycle-learning fields**
(`avgCycleDays`, `estimatedCycleDays`, `lastOrderedAt`, `purchaseCount`) do not exist on the
Neon `products`/`inventory` tables. Migration needs a Neon schema addition
(`db/migrations/012_*`), a `productPurchaseHistory` action over Neon `order_items`, and a
type-level rewire of the shared reorder lib. Planned — see `neon-migration-report.md` §3.

### 4.2 [MEDIUM] Center overview/settings + all-products still Convex
`Center.tsx` derives its KPI overview from Convex `orders`/`products`/`goals` tables and its
settings from Convex `storeSettings`. Neon-backed `centerAdmin.marketOverviewAction` +
`ordersListAction` exist; the overview should be rebuilt over Neon commerce data
(`backend/orders.ts`, `backend/products.ts`, `backend/platformSettings.ts`). Planned.

### 4.3 [LOW] VelShop storefront settings via Convex `storeSettings`
`ShopHome.tsx` reads `api.center.getSettings` (shopName/tagline/phone/address/announcement).
Neon `shops` already carries name/description/phone/address/announcement — expose a public
read action over `backend/sellers.ts getShopById` and retire `storeSettings`. Planned.

### 4.4 [INFO] VelCenter user management on the Convex Auth users table
`api.users.listUsers/setUserAccess` manage roles on the Convex users table. Acceptable for
the auth layer (roles gate Convex functions), but business user *profiles* live in Neon
(`users`, `user_profiles`). Documented; no action required for MVP.

### 4.5 [INFO] `convex/orders.ts` + `convex/subscriptions.ts` are dead legacy modules
Unused by any frontend. Marked `@deprecated` in code. Removal requires a Convex data
migration for the orphaned tables (`orders`, `orderItems`, `subscriptions` in the Convex
schema) — schedule after the platform-side schema is stable.

### 4.6 [LOW] SEO pass pending for public apps
VelShop + Corporate lack sitemap/robots/structured data (titles/descriptions exist per page).
Center/Seller must stay noindex. Planned as a follow-up.

### 4.7 [INFO] Codegen note
`convex/_generated` is regenerated by the platform's Convex tooling (credentials are not
available in the sandbox terminal). New Convex functions must live in **existing** modules
(e.g. `memory.ts`) or codegen must run once with access — this is why the durable-flush
action lives in `memory.ts` and not a new module file.

## 5. Checklist status

- [x] Four applications build independently (verified: `build:shop`; tsc across all 4 apps)
- [x] Neon is the business source of truth for the storefront, seller commerce, center ops
- [x] Convex is not authoritative for any business data (remaining Convex-table reads are
      documented in §4 and marked deprecated)
- [x] Important behavior has durable persistence (Neon `behavioral_events` + 15-min cron)
- [x] Convex intelligence is rebuildable (documented procedure in `disaster-recovery.md`)
- [x] Authentication + server-side authorization verified
- [x] Seller/customer isolation verified (no IDOR paths found)
- [x] Orders/inventory/payment status authoritative in Neon
- [x] Idempotency for orders/payments/subscriptions
- [x] No production secrets exposed; dev/prod separated
- [x] th/en/my supported (i18n locale files verified)
- [x] Mobile floating navigation + responsive layouts in place
- [ ] Seller Smart Reorder + center overview on Neon (**planned**, §4.1–4.2)
- [ ] SEO pass (**planned**, §4.6)
