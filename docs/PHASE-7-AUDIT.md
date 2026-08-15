# PHASE-7-AUDIT — Velnox Architecture & Repository Audit

Version: 1.0 · Phase: 7 (Testing, Security, Production Hardening) · Date: 2026-08-15

> ตรวจสอบ repository ทั้งหมดก่อนเริ่ม Production Hardening (spec §1) — สรุปสิ่งที่พบ สิ่งที่แก้ และสิ่งที่ยังต้องทำ

---

## 1. Repository Structure (ตามจริง)

```
/
├── src/
│   ├── sites/
│   │   ├── main/          → Landing + auth entry (entry: src/main.tsx)
│   │   ├── velshop/       → Customer commerce (entry: velshop.html)
│   │   ├── velseller/     → Seller backend (entry: velseller.html)
│   │   └── velcenter/     → Company backend (entry: velcenter.html)
│   ├── convex/            → Convex: auth + node actions (bridge ไป Neon) + intelligence
│   ├── backend/           → Commerce Core services (Neon = source of truth)
│   ├── pages/             → UI ของทั้ง 4 sites (แยกโดย route)
│   ├── components/        → shared UI (shadcn/ui) + per-site components
│   ├── hooks/ · lib/      → shared hooks/types/libs
│   ├── assets/ · index.css
├── db/
│   ├── schema.sql         → base schema (users/sellers/shops/products/orders/...)
│   └── migrations/        → 002–010 (profiles+gps, catalog, cart, orders, logistics, reviews, finance, store, platform)
├── docs/                  → เอกสารทั้งหมด (ARCHITECTURE, PHASE_PLAN, PHASE-7-*, ...)
├── tests/                 → vitest unit tests (business rules, state machine, security, validation, providers, velrepeat)
├── velnox-mvp/            → deliverable snapshot (ซิงก์จาก root)
├── convex.json            → functions: src/convex/
└── package.json           → build = "tsc -b && vite build"
```

**หมายเหตุ (conflict กับ spec §2):** โครงสร้างจริงไม่ใช่ monorepo `apps/ + packages/` — เป็น single app ที่มี 4 entry (multi-page Vite: `index.html`, `velshop.html`, `velseller.html`, `velcenter.html`) แชร์ backend + convex + UI เดียวกัน นี่คือโครงสร้างที่อนุมัติใน Phase 1–3 และ deploy แยก 4 เว็บได้ (แต่ละ html = entry + basename แยก) — ไม่ refactor ใน Phase 7 ตาม §57

---

## 2. Application Status

| App | Entry | Build แยก | Auth ร่วม | Backend กลาง | สถานะ |
|---|---|---|---|---|---|
| Main | `src/sites/main` + `index.html` | ✅ | ✅ Convex Auth | — (landing เท่านั้น, ไม่มี business logic) | ✅ |
| VelShop | `src/sites/velshop/main.tsx` + `velshop.html` | ✅ | ✅ | ✅ `api.customer.*` + `api.commerce.*` | ✅ E2E ครบ |
| VelSeller | `src/sites/velseller` + `velseller.html` | ✅ | ✅ (seller role guard) | ✅ `api.commerce.*` + `api.sellerOps.*` | ✅ core ครบ (UI บางส่วนใช้ legacy Convex) |
| VelCenter | `src/sites/velcenter` + `velcenter.html` | ✅ | ✅ (RBAC + department scope) | ✅ `api.centerAdmin.*` | ✅ |

- ทั้ง 4 ใช้ **Convex deployment เดียว** + **Neon database เดียว** + **auth เดียว** (Convex Auth) — ผู้ใช้ login ที่ VelShop เข้าถึง VelSeller/VelCenter ได้ตาม role (§55)
- Cross-app nav: `SiteSwitcher` + role guards (`RequireAuth`, `requireSeller`, `requirePermission`, `requireCenter`) — ไม่มี permission → 403/redirect (§56)

## 3. Build / TypeScript / Config

- `build = "tsc -b && vite build"` — **ไม่มี `convex dev`/`convex codegen` ใน build** (§36, §40) ✅
- Vercel deploy ใช้ `npx convex deploy --cmd 'bun run build'` ซึ่งรัน codegen ก่อน build (ไม่ต้อง interactive login — convex deploy ใช้ token ฝั่ง Vercel)
- `tsconfig.app.json` + `tsconfig.node.json` (tests อยู่ใน node config) ✅
- `vite.config.ts` — มี `server.hmr: false` (Freebuff กำหนด, ห้ามแก้) ✅

## 4. Authentication (Convex Auth)

- Provider: **Email OTP** (custom `src/convex/auth/emailOtp.ts` — ส่ง OTP ผ่าน freebuff relay) + **Anonymous** (guest browsing)
- `src/convex/auth.ts` + `auth.config.ts` — **READ-ONLY (platform-managed)** — ห้ามแก้
- @convex-dev/auth `0.0.90 → 0.0.95`, @auth/core `0.37.4 → 0.41.3` — **ปิด critical advisory GHSA-7rqj-j65f-68wh** (homoglyph email bypass) ✅
- Guest sign-in ✅ · Email OTP ✅ · Session ✅ · Logout ✅ · Protected routes (`RequireAuth`) ✅ · Role authorization (backend guards) ✅
- OTP rate limiting: Convex Auth มี built-in protection; app-level rate limiter ใหม่สำหรับเขียน-heavy actions (§25)

## 5. Database (Neon)

- Source of truth: **Neon PostgreSQL** (commerce) · Convex = intelligence/realtime (ไม่ duplicate source of truth)
- Schema: `db/schema.sql` + migrations 002–010 — idempotent (`IF NOT EXISTS`) — รันซ้ำได้ปลอดภัย
- Tables: users/sellers/shops/products/product_images/inventory/addresses/orders/order_items/payments/refunds/commissions/settlements/subscriptions + categories/variants/carts/wishlists/shipments/tracking_events/returns/reviews/velrepeat_orders/financial_ledger/seller_balances/seller_payouts/platform_settings/notifications/audit_logs/staff_profiles/coupons/promotions
- **Indexes**: มีสำหรับ foreign keys + lookup ที่ใช้บ่อย (products.shop/status/seller/category, orders.customer/created, order_items.order/seller/product, payments.order, refunds.order, subscriptions.customer/seller/product/due, reviews.product/shop, notifications.user, audit.entity, shipments.order/seller, tracking.shipment, inventory.product) ✅ (§47/§33)
- **Constraints**: CHECK สำหรับ status enums, price >= 0, quantity > 0, stock >= 0, rating 1–5, GPS ranges; UNIQUE (idempotency_key, reviews(user,product,order), variant sku) ✅ (§48)
- **Race safety**: checkout ใช้ transaction + `FOR UPDATE` + reserve inventory (atomic — ห้าม overselling §17) ✅
- Money: NUMERIC(12,2) + `round2()` server-side (decision จาก Phase 2–3; ไม่ refactor เป็น satang integer) ✅ (§12/§58)

## 6. Convex

- `convex.json` functions → `src/convex/`
- Node actions: `commerce.ts` (products/orders/subs/shop ops) · `customer.ts` (cart/checkout/address/wishlist/reviews/returns/notifications) · `sellerOps.ts` (fulfillment/finance) · `centerAdmin.ts` (settings/audit/revenue/seller mgmt)
- Intelligence: `intelligence.ts` (business events, interests) — VelRepeat learning
- **ใหม่ใน Phase 7**: `rateLimit.ts` (rate_limits table + enforceRateLimit mutation) + **health endpoint** `GET /health` (http.ts) ✅
- CRUD ผ่าน `_generated` (codegen ฝั่ง dev เท่านั้น — commit ลง git) ✅

## 7. Auth & Authorization (ทดสอบด้วย tests)

- `tests/security.test.ts` — IDOR/Customer ดู order คนอื่น ✗ · Seller แก้ product คนอื่น ✗ · Seller แก้ settings ✗ · Staff เกิน permission ✗ (§9)
- `tests/orderStateMachine.test.ts` — transition ถูกต้องเท่านั้น (§16)
- ทุก write action: `requireIdentity` → ownership check → zod validation → (audit) → transaction ✅ (§10)

## 8. Mock / Hardcode / Debug Scan (§58, §59, §61)

- ไม่พบ `const products = [...]` mock / fake data ใน production flow
- ไม่พบ `console.log` / `debugger` ใน src (มีแค่ `console.error` ใน catch blocks = logging)
- TODO ที่ตั้งใจ: carrier integration (shipping.ts) + payment gateway (payment.ts) — ตาม §63
- **พบ 1 จุดที่ต้องทราบ**: `src/convex/auth/emailOtp.ts` มี `x-api-key` ของ freebuff OTP relay ฝังในไฟล์ template (platform-managed, read-only) — ดู SECURITY.md §secrets

## 9. Known Issues (ก่อน Phase 7 fixes)

1. `@convex-dev/auth` + `@auth/core` critical advisory — **แก้แล้ว** (0.0.95 / 0.41.3)
2. `react-router` CSRF advisory (RSC mode) — **แก้แล้ว** (7.18.2)
3. เหลือ dev/build-time advisories (eslint→js-yaml/brace-expansion, vite→postcss/nanoid, @ai-sdk low) — ไม่กระทบ production bundle
4. Product variants: ตารางมีแล้ว ยังไม่มี service/UI (VelSeller)
5. Products ยังไม่ set `category_id` (ใช้ enum) — categories page นับ 0 จริงจนกว่า seller form จะลิงก์
6. Payment/carrier เป็น manual provider — abstraction พร้อม, gateway จริง Phase 9/10
7. ไม่มี rate limit บน OTP flow ฝั่งแอปเอง (Convex Auth มี built-in; app limiter ครอบ write actions)

---

*ต่อ: docs/PHASE-7-REPORT.md (สรุป + blockers) · docs/SECURITY.md · docs/DEPLOYMENT.md · docs/PRODUCTION.md · docs/DATABASE-RECOVERY.md · docs/ENVIRONMENT.md · docs/E2E-TESTING.md*
