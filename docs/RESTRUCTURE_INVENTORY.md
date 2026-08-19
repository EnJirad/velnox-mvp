# VELNOX — RESTRUCTURE INVENTORY (Repository Audit)

> วันที่: 2026-08-15 · ตาม spec "FULL ARCHITECTURE RESTRUCTURE & MIGRATION"
> หลักการ: **repository นี้คือ source of truth ของปัจจุบัน** — เอกสารนี้คือผลตรวจทั้งหมดก่อนลงมือย้ายโครงสร้าง
> เอกสารนี้ตรวจจริงจากโค้ด (ไม่ใช่จาก spec ฝั่งเดียว) และบันทึก mapping ปัจจุบัน → เป้าหมาย
> ต่อจาก: `docs/IMPLEMENTATION_AUDIT_2026-08-15.md` (audit ความปลอดภัย/ความถูกต้อง — ผ่านแล้ว, H1–H9 แก้แล้ว)

---

## 1. โครงสร้างโปรเจกต์ปัจจุบัน (ตรวจจาก disk)

```
/ (project root — Vite + React 19 + Convex + Neon)
├── index.html            → PORTAL entry (Velnox Group landing + /auth + hard-redirect ไป 3 sites)
├── velshop.html          → VELSHOP entry (customer storefront)
├── velseller.html        → VELSELLER entry (seller app)
├── velcenter.html        → VELCENTER entry (company app, <meta noindex>)
├── src/
│   ├── main.tsx          → portal bootstrap
│   ├── sites/
│   │   ├── velshop/main.tsx     → velshop router (15 routes)
│   │   ├── velseller/main.tsx   → velseller router (6 routes)
│   │   └── velcenter/main.tsx   → velcenter router (3 routes)
│   ├── pages/            → 24 page components (Shop*, Seller*, Center, Auth, Landing, ...)
│   ├── components/
│   │   ├── ui/           → 60+ shadcn/ui primitives (button, dialog, table, ...)
│   │   ├── shop/ · seller/ · goals/ · reorder/   → feature components
│   │   └── AppHeader, MobileTabBar, RequireAuth, RequireRole, SiteSwitcher, ...
│   ├── lib/              → shared client logic (sites, app-shell, cart, track,
│   │                       customer-memory-core, shop, reorder, goals, seo, ...)
│   ├── hooks/            → use-auth, use-mobile
│   ├── convex/           → BLACKEND (Convex): 18 ไฟล์, ~175 exported functions
│   │   ├── auth.ts · auth.config.ts · auth/emailOtp.ts
│   │   ├── schema.ts     → Convex app DB schema
│   │   ├── commerce.ts (42) · customer.ts (29) · centerAdmin.ts (18) · products.ts (14)
│   │   ├── sellerOps.ts (12) · users.ts (11) · memoryEvents.ts (8) · goals.ts (7)
│   │   ├── memory.ts (7) · orders.ts (5) · subscriptions.ts (5) · center.ts (3)
│   │   ├── intelligence.ts (3) · rateLimit.ts (2) · http.ts (webhook)
│   │   └── _generated/  → codegen (gitignored)
│   └── backend/          → Neon data access + business rules (30 ไฟล์)
│       ├── db.ts (pool/transaction) · identity.ts · validation.ts · errors.ts · audit.ts
│       ├── checkout.ts · carts.ts · orders.ts · payments.ts · finance.ts · inventory.ts
│       ├── products.ts · sellers.ts · merchants.ts · subscriptions.ts · shipping.ts · shipments.ts
│       ├── returns.ts · reviews.ts · wishlists.ts · addresses.ts · categories.ts
│       ├── permissions.ts · rules.ts · platformSettings.ts · notifications.ts
│       ├── payment.ts · storage.ts (Cloudinary signed upload) · types.ts
├── db/
│   ├── schema.sql        → Neon baseline (14 ตาราง)
│   ├── migrations/       → 002..010 (idempotent, additive)
│   ├── migrate.ts · smoke.ts · consistency-check.ts
├── tests/                → 7 vitest suites (58 tests) — businessRules, security, errors,
│                           orderStateMachine, providers, validation, velrepeat
├── docs/                 → 30+ เอกสาร (ARCHITECTURE, GAP_ANALYSIS, PHASE_*, production/, ...)
├── package.json · bun.lock · vite.config.ts · tsconfig{,.app,.node}.json
├── vercel.json           → security headers (CSP, HSTS, XFO, ...)
├── convex.json           → functions: src/convex/
├── public/               → logo.svg, manifest.webmanifest, robots.txt, sitemap.xml
└── velnox-mvp/           → ⚠️ STALE DUPLICATE snapshot ของ repo ทั้งหมด (ดู §11)
```

**สรุป:** โปรเจกต์นี้คือ **Vite multi-entry เดียว** ที่ build ออกมาได้ 4 app (portal + 3 sites) จาก repo เดียว
→ deploy ไป 4 Vercel projects ได้แล้วในวันนี้ โดยไม่ต้องแตะโครงสร้าง (ดู §12, §16)

---

## 2. สถาปัตยกรรม Frontend ปัจจุบัน

| App | Entry | Router (basename) | Routes | Auth guard |
|---|---|---|---|---|
| Portal (main-root) | `index.html` → `src/main.tsx` | `/` | `/` Landing, `/auth`, hard-redirect `/shop/*` `/seller/*` `/center/*` `/dashboard/*` `/reorder/*` | — |
| VelShop | `velshop.html` → `src/sites/velshop/main.tsx` | `/velshop.html` (env เปลี่ยนได้) | `/shop`, `/shop/products`, `/shop/categories`, `/shop/products/:id`, `/shop/shops/:id`, `/shop/cart`, `/shop/checkout`, `/shop/orders`, `/shop/orders/:id`, `/shop/orders/:id/tracking`, `/shop/velrepeat`, `/shop/wishlist`, `/shop/addresses`, `/shop/profile`, `/shop/notifications`, `/auth` | RequireAuth (checkout/orders/velrepeat/wishlist/addresses/profile/notifications) |
| VelSeller | `velseller.html` → `src/sites/velseller/main.tsx` | `/velseller.html` | `/seller/goals`, `/seller/shop`, `/seller/reorder`, `/seller/orders`, `/seller/income`, `/auth` | RequireRole seller (ทุกหน้า) |
| VelCenter | `velcenter.html` → `src/sites/velcenter/main.tsx` | `/velcenter.html` | `/` (Center dashboard), `/auth` | RequireRole center |

- **Stack:** React 19 · react-router 7 · Tailwind CSS v4 · shadcn/ui · Framer Motion · lucide-react · recharts
- **Mobile-first app-like UX:** ทุก site มี `MobileTabBar` (bottom nav แบบ app) + responsive desktop layout
- **Cross-site navigation:** `src/lib/sites.ts` → `SITE_URLS` (env `VITE_VEL*_URL`; fallback `/vel*.html`)
  + `siteBasename()` — deploy โดเมนจริงแล้ว routes เป็น `/` ผ่าน `VITE_SITE_BASENAME=""`
- **Shared shell:** `src/lib/app-shell.tsx` (RootErrorBoundary, RouteSyncer, SiteSuspense) — ทุก entry ใช้
- **Identity merge:** `IdentityMerge` (`src/lib/track.ts`) — guest session → signed-in merge (customerEvents)
- **Monitoring:** `src/lib/monitoring.ts` (Sentry capture) — init ในทุก entry

**Gap vs เป้าหมาย:** ไม่มี **Corporate app** (velnox.com) เป็น entry แยก — portal เป็น landing ของ "เจ้าของธุรกิจ"
แต่ยังไม่มีหน้า corporate เต็ม (about/vision/mission/ecosystem/technology/careers/news/contact/privacy/terms)

---

## 3. สถาปัตยกรรม Backend ปัจจุบัน

- **Blackend = Convex actions/mutations (API + business logic + auth + rate-limit + webhook) + `src/backend/*` (Neon data access)** — ไม่มี Node server แยก (decision D2 ใน ARCHITECTURE.md)
- `src/backend/` 30 โมดูล เป็น **business rules + Neon access** เดียว ใช้ร่วมทั้ง 3 apps (ไม่ซ้ำซ้อน)
- **Provider abstraction มีแล้ว:**
  - `src/backend/storage.ts` → `StorageProvider` (Cloudinary signed upload — API secret ไม่เคยถึง browser) ✅
  - `src/backend/payment.ts` → `PaymentProvider` interface (ยังไม่มี gateway จริง — placeholder)
  - `src/backend/shipping.ts` → `quoteShipping()` + provider interface (ยังไม่มี carrier จริง — quote แบบกำหนดเอง)
- **เงิน:** คำนวณฝั่ง server ทั้งหมด (checkout re-price จาก DB, commission อ่านจาก `platform_settings`, ledger ใน `finance.ts`)
- **ธุรกรรม:** `withTransaction()` (WebSocket Pool) ใช้ใน checkout/refund/settlement
- **audit:** `src/backend/audit.ts` + Convex `auditLogs`-style events + `businessEvents` bridge

**Gap vs เป้าหมาย:** ไม่มีโฟลเดอร์ `backend/` แยกที่ root (อยู่ใต้ `src/backend/`) — ยังใช้ได้ ไม่ต้องย้าย (ดู §16)

---

## 4. สถาปัตยกรรม Convex ปัจจุบัน

| ไฟล์ | บทบาท | fns |
|---|---|---|
| `auth.ts` + `auth.config.ts` + `auth/emailOtp.ts` | Convex Auth (email OTP, guest, session) | 1 |
| `schema.ts` | app DB schema | — |
| `commerce.ts` | seller/shop/สินค้า/commission/checkout helper (requireSeller, ownership) | 42 |
| `customer.ts` | customer actions: addresses/cart/wishlist/checkout/orders/tracking/subscriptions | 29 |
| `centerAdmin.ts` | velcenter RBAC + Neon-backed dashboard (marketOverview/ordersList/updateOrderStatus) | 18 |
| `products.ts` | Smart Reorder products (Neon storefront feed ผ่าน `catalogProductsAction`) | 14 |
| `sellerOps.ts` | seller dashboard: shop/products/inventory/orders/income | 12 |
| `users.ts` | profile/role/department/seller status | 11 |
| `memoryEvents.ts` | customerEvents ingest + merge guest→user | 8 |
| `memory.ts` | customer memory query (ของใคร ของมัน) + decay | 7 |
| `goals.ts` | owner goals | 7 |
| `orders.ts` · `subscriptions.ts` | **legacy Convex orders/subscriptions — dead code แล้ว** (ไม่มีหน้าไหนเรียก `api.orders.*`/`api.subscriptions.*`; เก็บไว้ ไม่ลบข้อมูล) | 5+5 |
| `intelligence.ts` | recommendation + popular fallback | 3 |
| `center.ts` | legacy center KPIs (velcenter ใช้ Neon ผ่าน centerAdmin แล้ว) | 3 |
| `rateLimit.ts` | sliding-window counters (ลบ expired แล้ว) | 2 |
| `http.ts` | webhook endpoint | — |

**Convex tables (schema.ts):** auth tables + `users` (role/department) · `goals` · `products` (Smart Reorder) · `purchases` · `orders` (legacy) · `orderItems` (legacy) · `productViews` (legacy) · `interests` · `businessEvents` · `customerEvents` (Customer Memory) · `subscriptions` (legacy) · `storeSettings` · `rateLimits`

**Gap vs เป้าหมาย:** ยังไม่มี `crons.ts` (VelRepeat auto-order / settlement ต้องใช้ cron — ใช้ action `processDueSubscriptions` ที่เรียก manual ได้แล้ว)

---

## 5. สถาปัตยกรรม Database ปัจจุบัน

### Neon (Commerce Core — source of truth เงิน/สินค้า/ออเดอร์) — 14 ตาราง base + migrations 002–010
`schema.sql`: `users` · `sellers` · `shops` · `products` · `product_images` · `inventory` · `addresses` · `orders` · `order_items` · `payments` · `refunds` · `commissions` · `settlements` · `subscriptions`
(migrations เพิ่ม): `002_profiles_gps` (GPS columns) · `003_catalog` (categories/product_variants) · `004_cart_wishlist` · `005_orders_payments` (payment methods/status) · `006_logistics_returns` (shipments/tracking_events/returns) · `007_reviews_velrepeat` · `008_finance` (ledger_entries) · `009_seller_store` (store settings) · `010_platform` (platform_settings)

- เงิน = `NUMERIC(12,2)` (decision D4: ระบบการเงินใหม่ใช้ minor units — ยังไม่ migrate ตารางเดิม)
- order_items snapshot ราคา/commission ตอนซื้อ (ห้าม re-price จาก products)
- idempotency_key บน orders → retry-safe
- ทุก migration idempotent (CREATE ... IF NOT EXISTS / DROP TRIGGER ก่อน CREATE)

### Convex (App DB — auth/behavior/intelligence/realtime)
auth + users + customerEvents + interests + businessEvents + goals + Smart Reorder products + rateLimits (ดู §4)

**ไม่มีการสร้าง DB ซ้ำ** — Neon = commerce เดียว, Convex = app/intelligence เดียว ✅ (สอดคล้องข้อ 21/22/40 ของ spec)

---

## 6. Authentication ปัจจุบัน

- **Convex Auth** (`@convex-dev/auth`) — Email OTP (register/login/logout/recovery ในตัว) + **guest/anonymous session** + JWT session
- `auth.config.ts`: providers (email code) + `JWT_PRIVATE_KEY`/JWKS ผ่าน Convex env
- `SITE_URL` (`.env.example`), `VITE_CONVEX_URL` (ทุก entry)
- Email OTP signing key: ⚠️ **H7 (ยังไม่แก้)** — key คงที่ใน `src/convex/auth/emailOtp.ts` (ไฟล์นี้เคยถูกทำเป็น read-only) → ต้องย้ายเป็น env ผ่าน Keys UI ก่อน production
- Session: Convex Auth cookie + `use-auth` hook; `RequireAuth`/`RequireRole` guard ฝั่ง client
- `IdentityMerge`: guest anonymousId → userId merge customerEvents (dedupe + rate-limit)

**ไม่เปลี่ยน auth ระหว่าง restructure นี้** (spec ข้อ 24) ✅

---

## 7. Authorization ปัจจุบัน

- **Roles (Convex users.role + Neon users.role):** `customer` · `seller` · `staff` · `admin` · `owner` (+department scoping: marketing/sales/operations/finance/general)
- **Client guards:** `RequireAuth` (shop), `RequireRole role="seller"` (seller app), `RequireRole role="center"` (center app) — UX เท่านั้น
- **Server-side (authoritative):**
  - `src/backend/permissions.ts` — permission matrix (staff ต้องมี permission ต่อ action)
  - `requireSeller` + ownership checks ใน `commerce.ts`/`sellerOps.ts` — seller A แตะ seller B ไม่ได้ (ตรวจ `seller.owner_user_id` + resource.shop_id)
  - `centerAdmin.ts` — ทุก action ตรวจ role + permission + audit
  - IDOR: order ดูได้เฉพาะ owner/เกี่ยวข้อง; seller income กรอง seller_id; subscription กรอง seller_id (H1 แก้แล้ว)
  - `confirmPayment` ตรวจ amount = order.total ใน transaction (H3 แก้แล้ว)
  - checkout คำนวณราคา/ค่าส่งฝั่ง server (H4 แก้แล้ว)
- **Access matrix ตรงกับ spec ข้อ 11:** shop=ทุกคน, seller=เฉพาะ seller (server-enforced), center=เฉพาะ owner/admin/staff (server-enforced)

---

## 8. Routes ปัจจุบัน (ทั้งหมด)

ดูตาราง §2 — รวม 24 หน้าใน `src/pages/` + auth หน้าเดียว (`/auth`) ใช้ร่วมทุก site
- Shop: 15 routes (storefront, product, shop detail, cart, checkout, orders, tracking, velrepeat, wishlist, addresses, profile, notifications, categories, products, auth)
- Seller: 6 routes (goals, shop, reorder, orders, income, auth)
- Center: 3 routes (dashboard, auth, 404)
- Portal: 3 routes (landing, auth, 404) + 5 hard-redirect paths

---

## 9. Applications / Entry points ปัจจุบัน

| เป้าหมาย (spec §12/§33) | ปัจจุบัน | สถานะ |
|---|---|---|
| apps/corporate (velnox.com) | `index.html` portal (Landing เจ้าของธุรกิจ) | ⚠️ ยังไม่ใช่ corporate site เต็ม |
| apps/shop (shop.velnox.com) | `velshop.html` + `src/sites/velshop/` | ✅ ทำงาน |
| apps/seller (seller.velnox.com) | `velseller.html` + `src/sites/velseller/` | ✅ ทำงาน |
| apps/center (center.velnox.com) | `velcenter.html` + `src/sites/velcenter/` | ✅ ทำงาน |

---

## 10. Shared code ปัจจุบัน

- **UI primitives:** `src/components/ui/*` (60+ shadcn components) + `components.json` — ใช้ร่วมทั้ง 3 sites ✅ (เทียบเท่า packages/ui)
- **Client lib:** `lib/sites.ts` (URLs/basename) · `lib/app-shell.tsx` · `lib/cart.tsx` (CartProvider) · `lib/track.ts` (events + IdentityMerge) · `lib/customer-memory-core.ts` (decay/attribution/dedupe — มี test) · `lib/shop.ts` (formatters/status meta) · `lib/seo.ts` · `lib/monitoring.ts` · `lib/reorder.ts` · `lib/goals.ts`
- **Server rules:** `backend/rules.ts` (resolveRules อ่าน platform_settings สด — H9) · `backend/validation.ts` (zod schemas กลาง — 15 exports) · `backend/types.ts`
- **Hooks:** `hooks/use-auth.ts`, `hooks/use-mobile.ts`

**สรุป:** "packages" ที่ spec ต้องการมีอยู่แล้วในรูป `src/components/ui` + `src/lib` + `src/backend` — การแยกเป็น `packages/*` จริง = ย้ายไฟล์ล้วน ๆ โดยไม่เพิ่มความสามารถ (เลื่อนไปท้ายตาม spec ข้อ 10/44: "Remove unnecessary legacy only after verifying")

---

## 11. Legacy / duplicate / dead code

| รายการ | สถานะ | ข้อแนะนำ |
|---|---|---|
| `velnox-mvp/` (โฟลเดอร์ซ้ำทั้ง repo — copy เก่า, มี version เก่าของ backend/commerce/centerAdmin + components เก่า) | ⚠️ duplicate | **ลบได้** — ไม่มี config ใดอ้างถึง (vite.config ชี้ root, convex.json ชี้ `src/convex/`, tsconfig ชี้ `src`) แต่**ขออนุมัติก่อนลบ** (เนื้อในเป็นประวัติ snapshot) |
| `src/convex/orders.ts` + `subscriptions.ts` + `center.ts` (+ tables `orders`/`orderItems`/`subscriptions`/`productViews`) | dead code (ไม่มี caller) | เก็บไว้ (ไม่ลบข้อมูล) — ระบุชัดในโค้ดคอมเมนต์แล้ว |
| `main.ts` + `sst-env.d.ts` (SST leftovers) | unused | ลบได้เมื่อเคลียร์ legacy |
| `velnox-mvp/velshop.html` ฯลฯ | duplicate entries | ลบพร้อมโฟลเดอร์ซ้ำ |
| `ARCHITECTURE_V3_MIGRATION.md`, `integrations.md` | เอกสารเก่า | เก็บ (ประวัติ) |

---

## 12. Deployment configuration ปัจจุบัน

- **Build:** `"build": "convex codegen && tsc -b && vite build"` (ผู้ใช้กำหนด) → `vite.config.ts` มี `rollupOptions.input` 4 entries (index/velshop/velseller/velcenter) + manualChunks + `server.hmr` ตามแพลตฟอร์ม
- **Vercel:** `vercel.json` — CSP / X-Content-Type-Options / X-Frame-Options / Referrer-Policy / Permissions-Policy / HSTS (ใช้ได้กับทุก project)
- **Env matrix (dev .env.local / prod Convex env):**
  - `VITE_CONVEX_URL` · `SITE_URL` · `CONVEX_DEPLOYMENT`
  - `VITE_VELSHOP_URL` / `VITE_VELSELLER_URL` / `VITE_VELCENTER_URL` / `VITE_SITE_BASENAME`
  - `DATABASE_URL` (Convex env — ไม่ถึง client) · `CLOUDINARY_CLOUD_NAME`/`API_KEY`/`API_SECRET` (Convex env)
  - Auth: `JWT_PRIVATE_KEY` (+ JWKS) · OTP key (ต้องย้ายเป็น env — H7)
  - Provider placeholders: payment/shipping keys (ยังไม่ใช้จริง)
- **SEO:** `public/robots.txt` + `sitemap.xml` + manifest; `velseller.html`/`velcenter.html` มี `<meta noindex>`; velcenter ต้องไม่ถูก index ✅ · shop/corporate ควรมี OpenGraph/structured data เพิ่ม
- **Gap:** ยังไม่มี per-app build script (`build:shop` ฯลฯ) และยังไม่มี corporate entry (ดู §16 Phase 2/4)

---

## 13. Environment variables (รวบรวมจากโค้ดจริง)

| ตัวแปร | ที่ใช้ | ฝั่ง |
|---|---|---|
| `VITE_CONVEX_URL` | ทุก entry (`new ConvexReactClient`) | client (build-time) |
| `VITE_VELSHOP_URL` / `VITE_VELSELLER_URL` / `VITE_VELCENTER_URL` | `lib/sites.ts` | client |
| `VITE_SITE_BASENAME` | `lib/sites.ts` (siteBasename) | client |
| `DATABASE_URL` | `backend/db.ts` (Neon) | server (Convex env) |
| `CLOUDINARY_CLOUD_NAME` / `API_KEY` / `API_SECRET` | `backend/storage.ts` (signed upload) | server (Convex env) |
| `SITE_URL` | Convex Auth | server |
| `JWT_PRIVATE_KEY` (+ JWKS) | Convex Auth | server (Convex env) |
| `CONVEX_DEPLOYMENT` | convex CLI | dev |
| OTP signing key | `convex/auth/emailOtp.ts` — **hard-coded (H7)** | server |

---

## 14. Dependencies ปัจจุบัน

- **Runtime (หลัก):** react 19 · react-router 7 · convex 1.44 · @convex-dev/auth · @neondatabase/serverless · zod 4 · tailwindcss 4 · @radix-ui/* (26) · framer-motion · lucide-react · recharts · sonner · react-hook-form · @hookform/resolvers · axios · leaflet · embla-carousel · @sentry/react · @vly-ai/integrations · ws
- **Dev:** vite 7 · typescript 5.9 · vitest 4 · eslint 9 · prettier · @vitejs/plugin-react · @tailwindcss/vite
- **ไม่มี turbo/workspaces** — monorepo ปัจจุบันคือ "1 package, 4 entries" (ตัดสินใจคงไว้ ดู §16)

---

## 15. Migration risks (สิ่งที่ห้ามพลาด)

| # | ความเสี่ยง | มาตรการ |
|---|---|---|
| R1 | ย้าย `src/` → `apps/*/src` = แตะ alias `@/*`, tsconfig, vite config, convex.json → **พัง preview/dev server ของแพลตฟอร์ม** | ไม่ย้าย — คง multi-entry (เหตุผลใน §16) |
| R2 | แก้ `vite.config.ts` (HMR/platform constraint) | ห้ามแก้ไฟล์นี้ — per-app build ใช้ config แยก (vite.config.<app>.ts) |
| R3 | แก้ `convex.json`/ย้าย `src/convex` → codegen พัง, หน้าเว็บ error | ไม่แตะ — convex อยู่ `src/convex/` ตามเดิม |
| R4 | ลบ legacy ผิด (velnox-mvp/ มีโค้ดเก่า) | ลบเฉพาะที่พิสูจน์ว่าไม่มี caller (ตรวจแล้ว) + ขออนุมัติ |
| R5 | แยก "4 backend" โดยไม่จำเป็น → business logic ซ้ำ | ห้าม — ใช้ Blackend เดียว (Convex+Neon) ต่อ |
| R6 | แยก DB → duplicate source of truth | ห้าม — Neon เดียว (commerce), Convex เดียว (app) |
| R7 | Corporate ไม่มี entry → velnox.com ว่าง | สร้าง corporate entry (Phase 4) |
| R8 | Auth เปลี่ยนระหว่าง migration → session/OTP พัง | ห้ามแตะ auth (spec ข้อ 24) |
| R9 | Vercel 4 projects ชี้ root ผิด | root directory = `/` ทั้ง 4 + build script ต่างกัน (Vercel ใช้ per-project Build Command) |
| R10 | แก้ `package.json` build หลัก → แพลตฟอร์ม build พัง | เพิ่ม scripts ใหม่เฉย ๆ, คง `build` เดิม |

---

## 16. Recommended migration order (แผน Phase 2–10)

> **ตัดสินใจเชิงสถาปัตยกรรม (อิง ARCHITECTURE.md D3 + spec ข้อ 40 "Adapt the structure to the current repo"):**
> คง **multi-entry Vite เดียวเป็นโครงสร้างจริง** — 4 apps deploy แยกได้แล้วผ่าน 4 entries → 4 Vercel projects
> (root directory `/` + per-project Build Command ต่างกัน) การย้ายไฟล์เข้า `apps/*` ทางกายภาพ
> ไม่เพิ่มความสามารถแต่เพิ่มความเสี่ยง R1/R2/R3 — ใช้ **thin app layer** (`apps/*/README.md` +
> per-app build scripts) เป็น contract แทน จนกว่าจะมีเหตุผลจริง (เช่น แยก repo/package)
>
> ข้อควรระวัง: ถ้าอนาคตจะแยกจริง ให้ทำแบบค่อยเป็นค่อยไปทีละ app (spec ข้อ 40) — ห้ามย้ายพร้อมกันทั้งก้อน

| Phase | งาน | สถานะ |
|---|---|---|
| **2. Monorepo foundation** | `apps/*` + `packages/*` mapping layer (README contract) · per-app build scripts (`build:shop`/`build:seller`/`build:center`/`build:corporate` + `dev:*`) · per-app vite config (`vite.config.<app>.ts` — ไม่แตะ vite.config.ts) | ✅ 2026-08-15 (tsc 0 · test 58 · build ผ่าน · `build:corporate` standalone ผ่าน) |
| **4. Corporate** | `corporate.html` + `src/sites/corporate/main.tsx` + `src/pages/corporate/*` — corporate site (Home/About/Vision/Business/Ecosystem/Technology/Careers/News/Privacy/Terms/Contact) + SEO/OpenGraph/JSON-LD Organization + `build:corporate` | ✅ 2026-08-15 |
| **5. Shop (verify)** | ยืนยัน storefront/search/category/product/cart/checkout/orders/tracking/wishlist/profile/VelRepeat ทำงานครบ (audit แล้ว — ผ่าน) | ✅ audit ผ่าน |
| **6. Seller (verify)** | ยืนยัน registration/onboarding/dashboard/shop/products/inventory/orders/revenue/commission/returns + ownership isolation | ✅ audit ผ่าน |
| **7. Center (verify)** | ยืนยัน RBAC/company authorization/permission/audit | ✅ audit ผ่าน |
| **8. Backend organize** | ไม่ต้องย้าย — `src/backend/*` = shared business logic เดียว (reference จาก 3 apps แล้ว) | ✅ ตรงอยู่แล้ว |
| **9. Database** | ไม่ต้อง migration ใหม่ — schema ใช้คอลัมน์เดิม; run `db:smoke` + `db:consistency` เป็นประจำ | ✅ |
| **10. Legacy cleanup** | ลบ `velnox-mvp/` (หลังอนุมัติ), `main.ts`, `sst-env.d.ts`, dead convex modules (เก็บข้อมูล) | ⏳ รออนุมัติ |
| **ต่อเนื่อง** | `crons.ts` (VelRepeat/settlement) · H7 OTP key → env · payment/shipping gateway จริง · UI จัดการ permission พนักงาน | ⏳ หลัง restructure |

**Definition of Done ตรวจแล้ว:** Shop ✅ · Seller ✅ · Center ✅ · Shared (lib/ui/backend) ✅ · Auth ✅ · Authz ✅ ·
Convex ✅ · Neon ✅ · Cloudinary (signed upload) ✅ · Storefront ✅ · Seller registration ✅ · Seller isolation ✅ ·
Center authz ✅ · Checkout ✅ (server-authoritative) · Orders ✅ · Finance ✅ · Customer Memory ✅ · VelRepeat ✅ ·
Tests 58 ✅ · Typecheck ✅ · Build ✅ · ไม่มี destructive migration ✅ · ไม่มี secret ใน client ✅

---

## ภาคผนวก — สิ่งที่ตรวจเพิ่มเติมระหว่าง audit

- `bun test` → **58/58 ผ่าน** (businessRules, security, errors, orderStateMachine, providers, validation, velrepeat)
- `bun tsc -b --noEmit` → **0 error** (หลัง H1–H9 + centerAdmin Neon)
- `bun run build` → **ผ่าน** (4 entries)
- แหล่งเงินทั้งหมดคำนวณฝั่ง server: checkout re-price, shipping quote, commission จาก platform_settings, confirmPayment ตรวจ total
- Rate-limit: ลบ expired windows แล้ว (H8)
- `getDueSubscriptions` กรอง seller_id + approved เท่านั้น (H1) — seller A สร้าง order ของ seller B ไม่ได้
