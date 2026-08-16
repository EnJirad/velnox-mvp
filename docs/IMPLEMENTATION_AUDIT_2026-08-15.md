# Velnox — Implementation Audit (Repository Audit)

> วันที่: 2026-08-15
> ขอบเขต: อ่าน repo ทั้งหมดก่อนแก้โค้ด ตามคำสั่ง "ห้ามเริ่ม implementation ทันที"
> วิธีตรวจ: อ่าน README, docs/ARCHITECTURE.md, docs/GAP_ANALYSIS.md, docs/PHASE_PLAN.md, docs/Velnox-CPNS.md, docs/CUSTOMER_MEMORY.md, `src/convex/*`, `src/backend/*`, `db/schema.sql` + `db/migrations/*`, `src/pages/*`, `src/sites/*`, `tests/*`, `package.json`, `.env.example`, `vercel.json`, `convex.json`
> สถานะการตรวจ (รันจริง): `bun tsc -b --noEmit` ✅ ผ่าน · `bun test` ✅ 58 ผ่าน / 0 fail (7 files + customer-memory-core)
> **อัปเดต 2026-08-16:** 113 ผ่าน / 0 fail (11 files) — เพิ่ม `tests/passwords.test.ts` (employee password policy §9–§10) และ `tests/stripe.test.ts` (Stripe gateway §24/§58)

---

## สรุปภาพรวม

โปรเจกต์อยู่ในสถานะ **ดีมาก — ทำงานได้จริงทั้ง 3 เว็บ (velshop / velseller / velcenter) บน Convex backend + Neon Commerce Core ชุดเดียว** สิ่งที่ spec Phase 10–13 ต้องการส่วนใหญ่ implement แล้วจริง ไม่ใช่ mock:

- Auth + RBAC + IDOR + rate limiting + audit log + zod validation ✅
- Checkout atomic (transaction + FOR UPDATE + price จาก DB + reserve stock + split หลายร้าน) ✅
- Order state machine, refunds, returns เต็มรอบ, shipments + tracking events, reviews, wishlists, notifications ✅
- Platform settings (ไม่ hard-code ในระบบการเงินใหม่), ledger, seller balances, payouts ✅
- Customer Memory (CPNS) เต็ม pipeline: events → weights/decay → intent → recommend → due reminders ✅
- 58 unit tests ผ่าน + typecheck ผ่าน

**ปัญหาหลักที่พบ (จัดลำดับ):** ระบบข้อมูลคู่ (Convex legacy vs Neon commerce) ที่ศูนย์กลางยังอ่านผิดแหล่ง, seller income ยัง hard-code ค่าธรรมเนียม, checkout รับ shipping fee จาก client, `processDueSubscriptions` ไม่มี seller scope, seller สถานะ pending ยังขายได้, rate limit โตไม่รู้จบ, payment confirm ไม่ตรวจ amount

---

## A. ทำเสร็จแล้ว (Complete)

### สถาปัตยกรรม / โครงสร้าง
- 3 เว็บแยก deploy จาก repo เดียว (Vite multi-entry: `velshop.html` / `velseller.html` / `velcenter.html` → `src/sites/*/main.tsx`) — deliberate decision D3 (docs/ARCHITECTURE.md)
- Backend เดียว = Convex node actions (`src/convex/*`) + Neon data access (`src/backend/*`) — D2
- `vercel.json` พร้อม security headers (CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy, nosniff)
- `"build": "convex codegen && tsc -b && vite build"` ✅ มีอยู่แล้วใน package.json (ตรงที่เคยขอ)

### ฐานข้อมูล
- Neon: `db/schema.sql` (14 ตาราง) + `db/migrations/002–010` (idempotent): GPS, categories, variants, carts, orders multi-seller, payments+transactions, shipments+tracking, returns+return_items, reviews, ledger, balances, payouts, platform_settings, notifications, audit_logs, staff_profiles, coupons, promotions
- Convex: `src/convex/schema.ts` — auth tables, users (+role/department), goals, products, purchases, orders/orderItems (legacy), productViews, interests, businessEvents, customerEvents, subscriptions (legacy), storeSettings, rateLimits

### Auth / Authorization
- Convex Auth: email OTP (`emailOtp.ts`) + Anonymous + Freebuff federated JWT (`auth.config.ts`) — file กันแก้ (README กำกับ)
- Roles: owner / admin / staff / seller / customer + department scoping (`src/convex/users.ts`, `src/backend/permissions.ts`)
- Granular permissions: `staff_profiles.permissions` (13 codes) — `hasPermission`/`requirePermission` ตรวจ server-side (owner/admin ผ่านเสมอ)
- IDOR: ตรวจ ownership ทุกจุด — `requireSeller`, `requireSellerProduct` (Product→Shop→Seller), `sellerOwnsOrder` (order_items.seller_id), address/user, subscription/customer, goal/user
- `RequireAuth` + `RequireRole` (seller/center gate) + `roleHome()` redirect ตาม role หลัง sign-in (Auth.tsx) — ครอบคลุม returnTo same-origin
- ระบบ guest → identity merge (`IdentityMerge` + `mergeAnonymousToUser` + `planAnonymousMerge`) — idempotent + dedup + test ครอบ

### Commerce (Neon Core)
- Cart หลายร้าน + price snapshot + stock check (`src/backend/carts.ts`)
- Checkout atomic 1 transaction: validate address (GPS บังคับ) → lock product FOR UPDATE → reserve stock → split by shop → parent order + per-shop orders + order_items snapshot + commissions + payment row → clear cart (`src/backend/checkout.ts`)
- Order state machine (pending→confirmed→shipped→delivered→completed, cancel rules) + restock/reserve release (`src/backend/orders.ts`)
- Payments + refunds atomic; full refund → void commissions (`src/backend/payments.ts`); PaymentProvider abstraction (manual provider ทำงานได้จริง) (`src/backend/payment.ts`)
- Returns เต็มรอบ (requested→…→refunded) + evidence urls (`src/backend/returns.ts`)
- Shipments + tracking_events + ShippingProvider abstraction (`src/backend/shipping.ts`, `shipments.ts`)
- Reviews (verified purchase), wishlists, notifications (`src/backend/reviews.ts`, `wishlists.ts`, `notifications.ts`)
- Platform settings (key/value JSONB, 0–100% validation) (`src/backend/platformSettings.ts`, `rules.ts`)
- Ledger + seller balances + payouts (transactional, recompute ได้) (`src/backend/finance.ts`)
- Audit log append-only (`src/backend/audit.ts`) — เรียกในทุก action สำคัญ
- Rate limiting (checkout/review/return/subscribe/product_create/image_upload/cancel_order/customer_events) (`src/convex/rateLimit.ts`)
- Error มาตรฐาน `AppError` + code + ข้อความไทย (`src/backend/errors.ts`)
- Zod validation กลาง: GPS, phone, email, price, quantity, rating, address (GPS คู่ + default ต้องมี GPS), checkout, return, review (`src/backend/validation.ts`)
- Cloudinary signed upload (ไม่เก็บ binary ใน DB) + re-validate type/size server-side (`src/backend/storage.ts`)
- VelRepeat (Neon subscriptions) + `processDueSubscriptions` + `advanceSubscription`

### Customer Memory (CPNS) — `docs/CUSTOMER_MEMORY.md`
- 16 event types, `customerEvents` table + 3 indexes (by_user_type / by_anonymous / by_type)
- weights + half-life decay + `estimateIntent` (แยก interest vs intent) — pure module testable (`src/lib/customer-memory-core.ts`)
- `myMemory` / `recommendForCustomer` (personal → popular fallback) / `dueReorderReminders` / `marketInsights` (aggregate เท่านั้น ไม่เปิด raw)
- Tracking fire-and-forget + rate limit 300/นาที + dedup view ต่อหน้า
- Server-side attribution (PURCHASE/REORDER/VELREPEAT_*/WISHLIST ผูก userId จาก session — client ปลอมไม่ได้)

### Frontend / UX
- Landing page ธีม Modern (slate + emerald ตาม VELNOX_DESIGN_THEME) — hero, how-it-works, ecosystem 3 เว็บ, vision, CTA, footer + Framer Motion
- Mobile app-like: `MobileTabBar` (bottom nav `md:hidden`) + `.site-app` padding + safe-area + responsive classes ทั้ง 3 เว็บ
- หน้า velshop ครบ: Home (personalized), Products (catalog/search/filter), ProductDetail, Shop, Categories, Cart, Checkout, Orders, OrderDetail, Tracking, VelRepeat, Wishlist, Addresses (GPS map picker), Profile, Notifications
- หน้า velseller ครบ: Dashboard (เป้าหมาย), MyShop (สินค้า CRUD + รูป Cloudinary), Reorder (Smart Reorder + เรียนรู้รอบ), SellerOrders, Income
- หน้า velcenter: Center (KPI + products + users + orders + settings + intelligence + audit + sellers + finance + payouts) ผ่าน centerAdmin actions

### Security / Production
- `.gitignore` ครอบ `.env*`, `_generated` — secrets อยู่ใน Keys/API keys UI
- Secret ใช้ `process.env` ฝั่ง node action เท่านั้น (`DATABASE_URL`, `CLOUDINARY_*`)
- CSP + security headers ใน vercel.json
- `docs/production/*` (deploy, backup, rollback, incident-response, monitoring, security, testing) + `docs/DEPLOYMENT.md` + `INSTALL_AND_USAGE.md`
- Health endpoint `/health` (`src/convex/http.ts`)

---

## B. ทำบางส่วน (Partial)

| เรื่อง | สถานะ | หมายเหตุ |
|---|---|---|
| Payment จริง | 🟡 | มี abstraction + manual provider (COD/โอน/PromptPay บันทึก pending) — ยังไม่มี gateway จริง / webhook (Phase 9 ตามแผน) |
| Shipping จริง | 🟡 | มี abstraction + manual provider (กรอก carrier/tracking ด้วยมือ) — ยังไม่มี carrier API (Phase 8) |
| VelRepeat auto-order | 🟡 | ต้องกด trigger จาก velseller (`processDueSubscriptions`) — ยังไม่มี scheduled cron |
| Variants | 🟡 | schema + cart รองรับ variant_id แต่ seller UI ยังไม่สร้าง/จัดการ variant (`src/backend/products.ts` มี variant? ตรวจแล้วยังไม่เห็น UI) |
| Categories | 🟡 | ตาราง categories + tree + stats มีแล้ว แต่สินค้ายังผูก `products.category` enum 6 ค่า (frontend ยังใช้ enum) |
| Staff profiles | 🟡 | backend + permission catalog ครบ แต่ Center UI ยังไม่มีหน้าจัดการ permission รายคนครบทุก flow |
| Seller approval | 🟡 | `sellers.status='pending'` default + center มี approve/reject แต่ยังไม่บังคับ gate ตอน publish/ขาย |
| Seller income | 🟡 | มี 2 implementation (ดู D.1) — UI ใช้ตัว hard-code |
| SEO | 🟡 | robots.txt + sitemap + meta ต่อ entry มีแล้ว แต่ยังไม่มี per-page meta/OG dynamic |
| Tests | 🟡 | 58 ผ่าน (docs บอก 79 — ตัวเลขเก่า) — ยังไม่มี integration test ต่อ Convex functions / Neon จริง |
| Pagination | 🟡 | list บางจุด `take(100/200)` แบบง่าย — ยังไม่มี cursor pagination |
| Email notification ธุรกิจ | 🟡 | มี OTP email (Freebuff) + in-app notifications — ยังไม่มี email สำหรับ order/return/payout |

---

## C. ยังไม่มี (Missing)

1. **Cron / scheduled jobs** (Convex `crons`) — VelRepeat auto-order, settlement, rate-limit cleanup, event retention
2. **Payment gateway จริง** (Omise/Stripe/PromptPay partner) + webhook endpoint (`http.ts` มีแค่ /health)
3. **Carrier จริง** (Kerry/Flash/J&T/ไปรษณีย์)
4. **Coupon / promotion ใช้งาน** (ตารางมีแล้วใน migration 010 แต่ backend/UI ยังไม่ใช้)
5. **Password auth** (deliberate — OTP แทน, D6) — ไม่นับเป็นบกพร่อง
6. **Per-page SEO / OG tags / structured data**
7. **Event retention/aggregation** (docs/CUSTOMER_MEMORY.md §11 ระบุไว้เองว่ายังไม่ implement)
8. **Seller UI จัดการ variant / SKU / weight**
9. **Admin UI: staff permission assignment ครบ flow** (backend พร้อม)
10. **Backup automation script** (มี docs แต่ยังไม่มี script ลง repo)

---

## D. มีแต่ implementation ผิด (ต้องแก้)

### D.1 — Seller income: hard-code commission/return policy (ขัดหลัก "ห้าม hard-code")
- `src/backend/orders.ts` `sellerIncome()` ใช้ `SELLER_COMMISSION_RATE = 0.03` และ `RETURN_COVERAGE_RATE = 0.1` แบบ hard-code
- `src/convex/orders.ts` (legacy) ก็ hard-code เช่นกัน
- ขณะที่ `src/backend/finance.ts` `sellerFinancialReport()` อ่านจาก `platform_settings` ผ่าน `resolveRules()` ถูกต้อง
- **ผล:** `Income.tsx` ใช้ `api.commerce.sellerIncomeReport` → ตัวเลขไม่สะท้อนการตั้งค่าที่ admin เปลี่ยน → รายได้ seller กับ velcenter ไม่ตรงกัน (conflict กับ D.4/E.2)
- **แก้:** ให้ `sellerIncome` เรียก `resolveRules` เหมือน finance.ts (หรือให้ UI ใช้ `sellerFinancialReportAction` แทน)

### D.2 — Checkout รับ `shippingFee` จาก client
- `checkoutAction` รับ `shippingFee?: number` จาก frontend แล้วใช้เป็น shipping fee ตรง ๆ (มีแค่ max bound) — ขัด spec "ห้าม frontend คำนวณ/กำหนดยอดเงินสำคัญ" (มี `quoteShipping()` อยู่แล้วแต่ไม่ถูกใช้)
- **แก้:** backend คำนวณ fee จาก `shipping.ts` quote (methodId จาก client เท่านั้น) — client ส่ง methodId ไม่ใช่ตัวเลขเงิน

### D.3 — `confirmPayment` รับ amount ตามใจผู้เรียก (ไม่ตรวจเทียบ order.total)
- `src/convex/commerce.ts` `confirmPayment({ amount })` → `recordPayment` แทรก payment ด้วย amount ใดก็ได้ (recordPayment ตรวจแค่ order มีอยู่ + ยังไม่ paid)
- **แก้:** ตรวจ `amount === order.total` (หรือ ≤) ใน transaction

### D.4 — `processDueSubscriptions` ไม่มี seller scope (ข้ามร้าน)
- `getDueSubscriptions` ดึง subscription due **ทั้งหมดของทุกร้าน** (ไม่มี seller_id filter) และ action นี้เป็น seller-trigger
- **ผล:** seller A กด trigger → สร้างออเดอร์ให้สินค้าของ seller B ได้ (เป็นช่อง authz + data integrity)
- **แก้:** filter `seller_id` ของผู้เรียกใน action (หรือย้ายเป็น cron ฝั่ง platform)

### D.5 — `sellerIncome` นับ order ที่ **cancelled** เป็น returns
- `order.status === "cancelled"` → `returns += subtotal` — ยกเลิก ≠ คืนสินค้า → return rate ผิดเพี้ยน (finance.ts นับถูก: เฉพาะ `return_requested/returned`)

### D.6 — Seller สถานะ `pending` ยังเปิดร้าน/ขายได้เต็มที่
- `requireSeller` ไม่ตรวจ `seller.status === 'approved'` → seller ที่ยังไม่ผ่านอนุมัติ (default pending, auto_approve=false) ยัง create/publish product และรับออเดอร์ได้
- **แก้:** requireSeller ตรวจ status; seller หน้า openShop หลัง create ถ้า auto_approve=false ต้องสถานะ pending + กัน publish

### D.7 — `resolveRules` cache เป็น fire-and-forget + ไม่ refresh
- `src/backend/rules.ts` ใช้ WeakMap cache ที่ warm ครั้งเดียวแบบ async → ค่าแรกอาจเป็น default ก่อน cache resolve และค่าเก่าอยู่ไปจน process ตาย (admin เปลี่ยน commission แล้ว action ถัดไปอาจยังเห็นค่าเก่า)
- **แก้:** resolveRules อ่านตรงทุกครั้ง (หรือ cache แบบมี TTL/ถูก invalidate ตอน updateSetting)

### D.8 — Legacy Convex functions ยังถูก velcenter ใช้ (อ่านคนละแหล่งข้อมูล)
- `Center.tsx` ใช้ `api.center.overview` + `api.products.listAll` + `api.orders.allOrders` + `api.subscriptions.*` (legacy Convex tables) → dashboard KPI (revenue/productCount/orderCount) **ไม่ตรง** กับข้อมูล commerce จริงใน Neon (ที่ checkout เขียน)
- **แก้:** Center ต้องอ่านจาก Neon actions (`api.centerAdmin.*` / `api.commerce.*`) หรือ migrate overview ไปอ่าน Neon

---

## E. มี duplicate / conflict

| รายการ | รายละเอียด | ข้อเสนอ |
|---|---|---|
| E.1 | **Legacy Convex storefront tables** (products, orders, orderItems, subscriptions ใน Convex schema + `src/convex/products.ts`, `orders.ts`, `subscriptions.ts`) อยู่คู่กับ **Neon commerce core** — ระบบเดียวกันมี 2 แหล่งข้อมูล | คง Convex `products` เฉพาะ Smart Reorder (documented deliberate) แต่ **ห้าม** UI ตัวใดอ่าน legacy orders/subscriptions อีก; legacy orders/orderItems/subscriptions = dead code → เก็บไว้หรือลบพร้อม migration |
| E.2 | **Seller income 2 ตัว** — `commerce.sellerIncomeReport` (hard-code) vs `sellerOps.sellerFinancialReportAction` (settings) | รวมเป็นตัวเดียว (D.1) |
| E.3 | **Docs ไม่ตรงกับโค้ด** — README/docs อ้าง "79 tests" แต่จริง 58; `src/convex/products.ts` ตัวเก่ายังมี `customerRegulars`/`popularProducts` ซ้ำกับ `commerce.ts` | อัปเดต docs + ลบของตาย |
| E.4 | **โฟลเดอร์ `velnox-mvp/` ซ้ำทั้ง repo** (สำเนาเก่า: docs/package.json/src/...) | ลบหรือ sync — เสี่ยงสับสนเวลาแก้ผิดที่ |

---

## F. มี security risk

| # | ความเสี่ยง | จุด | ความรุนแรง |
|---|---|---|---|
| F.1 | `processDueSubscriptions` ข้ามร้าน (seller A สร้างออเดอร์สินค้า seller B) | commerce.ts D.4 | สูง |
| F.2 | Seller pending ยังขายได้ (ข้าม approval gate) | backend/identity.ts D.6 | สูง |
| F.3 | `confirmPayment` amount ไม่ตรวจเทียบ total | commerce.ts D.3 | กลาง |
| F.4 | Client ส่ง `shippingFee` ได้ | customer.ts D.2 | กลาง |
| F.5 | `setOrderStatus` — seller เปลี่ยน `payment_status='paid'` ได้เอง (manual provider) — intentional แต่อยากให้มี audit/note | commerce.ts | ต่ำ (ตามแบบ manual) |
| F.6 | Rate limit counter ไม่มี cleanup → โตไม่รู้จบ (และ attacker เปิด window ใหม่ได้เรื่อย ๆ) | rateLimit.ts G.1 | ต่ำ-กลาง |
| F.7 | OTP send ผ่าน `auth.freebuff.app` มี API key **hard-code ในซอร์ส** (`emailOtp.ts` x-api-key) | auth/emailOtp.ts | กลาง (key นี้เป็นของ platform template — ควรย้ายเป็น env) |
| F.8 | `sellerOwnsOrder` ใช้ `seller_id` จาก order_items — สินค้าที่ถูกย้าย shop/seller หลังสั่งอาจ mismatch | commerce.ts | ต่ำ (snapshot กันแล้ว) |

---

## G. มี performance risk

| # | จุด | ปัญหา |
|---|---|---|
| G.1 | `rateLimits` insert row ใหม่ทุก window หมดอายุ — ไม่มี delete/cleanup | ตารางโตไม่จำกัด |
| G.2 | `customerEvents`/`businessEvents` โตเรื่อย ๆ — อ่าน `take(400–500)` แบบ linear ต่อผู้ใช้ (ยอมรับได้ตอนนี้) | ต้องมี retention policy |
| G.3 | `popularProducts`/`recommendForCustomer` วน loop อ่าน Neon ทีละสินค้า (N+1) ต่อ request | cache/list query รวม |
| G.4 | `resolveRules` เรียกแยก key ต่อครั้ง (WeakMap cache ยังไม่เสถียร) | D.7 |
| G.5 | Center `overview` รวบ collect ตารางทั้งตาราง (orders/products/users) | ใช้ aggregate query แทน |

---

## H. ต้องแก้ก่อน production (Must-fix)

ลำดับตามความเสี่ยง (รวม D+F+G):

1. **H1 — D.4/F.1** `processDueSubscriptions`: เพิ่ม seller scope (หรือย้ายเป็น platform cron)
2. **H2 — D.6/F.2** `requireSeller`: บังคับ `seller.status === 'approved'` + publish gate
3. **H3 — D.3/F.3** `confirmPayment`: ตรวจ amount เทียบ order.total
4. **H4 — D.2/F.4** Checkout: shipping fee คำนวณจาก quote (client ส่งแค่ methodId)
5. **H5 — D.1/D.5/E.2** Income: รวมเป็นตัวเดียว อ่าน platform_settings + นับ return ให้ถูก
6. **H6 — D.8/E.1** Center dashboard: อ่านจาก Neon (หรือ migrate) — เลิกอ่าน legacy orders/products
7. **H7 — F.7** ย้าย OTP API key ออกจากซอร์สเป็น env
8. **H8 — G.1** rate-limit cleanup (cron หรือ delete expired ตอน hit)
9. **H9 — D.7** resolveRules: อ่านสด/refresh หลัง updateSetting
10. **H10** อัปเดต docs (จำนวน test, ลบอ้างอิง legacy) + จัดการโฟลเดอร์ `velnox-mvp/` ซ้ำ

---

## I. ไม่จำเป็นสำหรับ MVP (Keep out)

- Monorepo split จริง (apps/ + packages/) — D3 ชัดเจน: multi-entry ทำได้แล้ว ไม่เพิ่มค่า
- Password auth — D6: OTP ปลอดภัยพอสำหรับ v1
- Real payment/shipping gateway — abstraction พร้อม, ต่อทีหลังโดยไม่แตะ core
- ML/AI recommendation — deterministic ทำงานแล้ว (CPNS §18)
- Coupon/promotion — ตารางมีแล้ว, เปิดใช้ทีหลัง
- Multi-language (EN) — ไทยก่อน
- PWA/App wrapper — UI เป็น app-like แล้ว, future work ตามที่คุยกัน

---

## ลำดับการ implement (เสนอ — ยึด architecture เดิม)

**รอบ 1 (ความปลอดภัย/ความถูกต้องของเงิน — H1–H5):**
seller scope ของ VelRepeat → seller approval gate → payment amount check → checkout shipping quote → รวม income logic

**รอบ 2 (ความถูกต้องของข้อมูลศูนย์กลาง — H6, H9):**
Center overview อ่าน Neon → resolveRules refresh → อัปเดต docs/test count

**รอบ 3 (สุขอนามัยระบบ — H7, H8, H10, E.4):**
OTP key → env, rate-limit cleanup, ลบ legacy dead code/โฟลเดอร์ซ้ำ

**รอบ 4 (ฟีเจอร์ต่อจากนี้):**
cron VelRepeat + settlement, staff permission UI, variants UI, categories ผูกสินค้า, payment/carrier จริง

---

## สถานะการแก้ไข (อัปเดตหลัง audit — 2026-08-15)

รอบแรก implement แล้ว (H1–H5 + H8 + H9) — ตรวจผ่าน `bun convex dev --once` + `bun tsc -b --noEmit` + `bun test` (58 ผ่าน):

| # | รายการ | การแก้ไข | ไฟล์ |
|---|---|---|---|
| H1 | VelRepeat ข้ามร้าน | `getDueSubscriptions(db, date, sellerId?)` กรอง seller + action ส่ง `seller.id` + บังคับ approved | `src/backend/subscriptions.ts`, `src/convex/commerce.ts` |
| H2 | Seller pending ยังขายได้ | `openShop` auto-approve เมื่อ `auto_approve_sellers` หรือ role owner/admin · `setProductStatusAction` ห้าม publish ถ้า seller ยังไม่ approved | `src/convex/commerce.ts` |
| H3 | `confirmPayment` amount ไม่ตรง | `recordPayment` ตรวจ `amount === order.total` (throw ถ้าไม่ตรง) | `src/backend/payments.ts` |
| H4 | Client ส่ง shippingFee | checkout รับแค่ `shippingMethod` — fee คำนวณจาก `quoteShipping()` ฝั่ง server; `ShopCheckout` ส่ง `shippingMethod: "standard"` | `src/backend/checkout.ts`, `src/backend/validation.ts`, `src/convex/customer.ts`, `src/pages/ShopCheckout.tsx` |
| H5 | Income hard-code + นับ cancelled เป็น return | `sellerIncome` อ่าน `resolveRules()` (commission/threshold จาก platform_settings) + นับเฉพาะ `return_requested/returned` | `src/backend/orders.ts` |
| H8 | rate-limit โตไม่รู้จบ | ลบ expired windows ของ limiter เดิมทุกครั้งที่เปิด window ใหม่ | `src/convex/rateLimit.ts` |
| H9 | rules cache stale | `resolveRules` อ่าน settings ครั้งเดียวต่อ call — ไม่มี cache ตาย | `src/backend/rules.ts` |

ยังไม่ได้ทำ (ต้องทำต่อ):
- ~~**H6**~~ — ✅ **ทำแล้ว (2026-08-16)**: Center dashboard อ่าน marketplace KPI + orders จาก Neon (`centerAdmin.marketOverviewAction` / `ordersListAction`) — เหลือ `api.center.overview` ไว้เฉพาะ goals + reorder intelligence (Convex-owned โดย design)
- ~~**H7**~~ — ✅ **ทำแล้ว (2026-08-16)**: OTP API key ย้ายออกจากซอร์ส → `FREEBUFF_EMAIL_API_KEY` (Keys/API keys UI); `emailOtp.ts` fail loudly ถ้าไม่มี key
- ~~**H10**~~ — ✅ **ทำแล้ว (2026-08-16)**: โฟลเดอร์ `velnox-mvp/` ที่ซ้ำถูกลบแล้ว; ตัวเลข test อัปเดตเป็น 113 ใน docs ปัจจุบัน
- **Phase 14 #1 (Payment จริง)** — ✅ **ทำแล้ว (2026-08-16)**: Stripe hosted Checkout (บัตร/PromptPay) + webhook verify + idempotent confirm — ดูตาราง Phase 14 ด้านล่าง
- E.1 — legacy Convex tables (orders/subscriptions) ยังเป็น dead code — เสนอให้เก็บไว้หรือลบพร้อม migration

## งานที่ทำเพิ่มหลัง audit (2026-08-16)

| # | รายการ | ไฟล์ |
|---|---|---|
| §9–§11 | **Employee password auth (velcenter)**: `Password` provider (scrypt hash ใน authAccounts), create/reset พนักงานโดย owner, temp password แสดงครั้งเดียว, `mustChangePassword` บังคับตั้งรหัสใหม่, resolve employee-id/email → email, list/active toggle | `convex/auth.ts`, `convex/employeeAuth.ts`, `convex/employeeAuthHelpers.ts`, `backend/passwords.ts`, `db/migrations/012_employee_auth.sql`, `apps/center/src/components/EmployeeManager.tsx`, `ChangePasswordScreen.tsx`, `packages/shared/src/pages/Auth.tsx` |
| §44 | **Audit Logs tab** ใน velcenter (owner/admin) — อ่าน `audit_logs` (Neon, append-only) | `apps/center/src/components/AuditLogTab.tsx`, `convex/centerAdmin.ts` (`auditLogs`) |
| §19/§47 | **VelRepeat platform cron**: ทุก 6 ชม. ประมวลผล subscription ครบกำหนดทั้งหมด (idempotent ต่อ sub+due date, cron-only + rate limit 1/6h) | `convex/commerce.ts` (`processAllDueSubscriptions`), `convex/crons.ts` |
| H7/§69 | OTP key → env (`FREEBUFF_EMAIL_API_KEY`) | `convex/auth/emailOtp.ts` |
| — | script `build:prod` (typecheck + build shop → `dist/`) สำหรับ hosting | `package.json` |
| §10 | tests password policy | `tests/passwords.test.ts` |

## Phase 14 — การชำระเงินจริง (Stripe) — 2026-08-16

| # | รายการ | ไฟล์ |
|---|---|---|
| §24/§58 | **Payment gateway จริง (Stripe)**: วิธีชำระ "ออนไลน์ (บัตร/PromptPay)" ผ่าน hosted Checkout Session — amount สร้างฝั่ง server จาก pending payment rows (client ส่งแค่ orderId + return path) · webhook `/stripe/webhook` verify signature (Web Crypto, replay-proof) แล้ว confirm ทั้ง parent order แบบ idempotent + ตรวจยอดเงินตรง (ไม่ trust ตัวเลขจาก gateway เกิน server math) · PromptPay async: รองรับ `async_payment_succeeded/failed` · fallback `stripePaymentStatusAction` เมื่อกลับจาก Stripe ก่อน webhook ลง · UI: วิธีชำระใน checkout (ซ่อนถ้ายังไม่ตั้งคีย์), ปุ่ม "ชำระเงินทันที" ที่หน้า success + order detail, toast สถานะที่ /orders | `backend/stripe.ts`, `backend/stripeVerify.ts`, `backend/payment.ts`, `backend/payments.ts` (`confirmPaymentsForParentOrder`/`failPaymentsForParentOrder`), `convex/stripe.ts`, `convex/http.ts`, `apps/shop/src/pages/{ShopCheckout,ShopOrderDetail,MyOrders}.tsx`, i18n en/my/th |
| — | Required env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (+ `SITE_URL` สำหรับ return URL) — ตั้งใน Keys/API keys UI; ไม่ตั้ง = วิธีออนไลน์ถูกซ่อน ระบบ fallback manual | `docs/ENVIRONMENT.md`, `docs/production/environment.md`, `INSTALL_AND_USAGE.md` |
| — | tests: conversion THB↔satang, signature verify (tamper/expiry/wrong-secret), session metadata gating, registry fallback — **113 ผ่าน / 0 fail** | `tests/stripe.test.ts` |

## Phase 15 — Production Hardening (2026-08-16)

รอบนี้ตอบ spec "FINAL PRODUCTION HARDENING":

- **ลบ app switcher (SiteSwitcher)** ออกจากทุกเว็บ — แต่ละเว็บมี identity ของตัวเอง, ไม่มี dropdown สลับ app ใกล้โลโก้
- **Corporate ปลอดข้อมูลภายใน**: เอา link velcenter ออกจาก footer สาธารณะ + เรียบเรียง content.ts ใหม่ ไม่พูดถึง Neon/Convex/DB/API/schema/RBAC — พูดแค่แบรนด์/สินค้า/บริการ/ติดต่อ
- **Owner bootstrap ที่ปลอดภัย (spec §31)**: ลบ `becomeOwner` (first-come-first-served) → `claimOwner({ bootstrapCode })` ตรวจ `BOOTSTRAP_OWNER_SECRET` (env ฝั่ง server, ≥16 ตัว, เทียบ digest แบบ constant-time ผ่าน Web Crypto), ใช้แล้วปิดถาวร (มี owner แล้วทุกครั้งถูกปฏิเสธ), บันทึก business event `OwnerBootstrapped`; UI velcenter แสดงช่องป้อนรหัสแทนปุ่ม self-claim
- **Seller application (spec §11–13)**: ลบ `becomeSeller` (self-promotion) → `createSellerApplication`/`openShop` สร้าง application สถานะ `pending` (re-submit ของ `rejected` กลับเป็น `pending` ใหม่; `suspended` โดนบล็อก); `requireSeller` ฝั่ง server อนุญาตเฉพาะ `approved` เท่านั้น (ทุก action เขียนข้อมูล); center approve/reject/suspend → sync Convex role ผ่าน `setSellerRoleInternal` (owner/admin เท่านั้น) + notification; RequireRole ฝั่ง seller อ่าน Neon `mySellerStatus` — ยังไม่ approved = เห็นสถานะ/แบบฟอร์มสมัคร ไม่ใช่หน้าจัดการ
- **Product moderation (spec §16–17, §37)**: status ใหม่ `pending_review`/`rejected` + คอลัมน์ `rejection_reason` (migration 013 + schema.sql); publish intent → review pipeline (auto-approve ตาม rule `auto_approve_products`); center tab "สินค้า" กลายเป็น moderation queue จริง (อนุมัติ/ปฏิเสธ/ระงับ + เหตุผลบังคับก่อนปฏิเสธ + แจ้งเตือนพ่อค้า); พ่อค้าเห็น rejection reason + ปุ่มส่งตรวจสอบใหม่ใน velseller
- **VelCenter tab "พ่อค้า" ใหม่**: review seller application (อนุมัติ/ปฏิเสธ/ระงับ) — ก่อนหน้านี้มีแต่ backend action ไม่มี UI
- **i18n**: keys ใหม่ `gate.*` + `productModeration.*` ครบ th/en/my + test parity (ทุก locale ต้องมี key set เท่ากัน)
- **Tests ใหม่**: bootstrap secret, seller/product moderation rules, locale parity → **127 pass / 0 fail**

Env ใหม่ที่ต้องตั้ง (Convex deployment env / Keys UI): `BOOTSTRAP_OWNER_SECRET` — ดู docs/ENVIRONMENT.md

## Round 16 — Convex production mismatch + Neon migrations (2026-08-16)

**Root cause ของ `users:ownerBootstrapStatus` not found (production):**
- ฟังก์ชันมีอยู่ใน source ถูกต้อง (`convex/users.ts`, public query, ชื่อตรงกับ
  frontend `api.users.ownerBootstrapStatus`) และ codegen ผ่าน
- สาเหตุคือ **production Convex deployment เก่า** — frontend (velcenter.vercel.app)
  ถูก deploy จาก commit ใหม่แล้ว แต่ Convex deployment ยังไม่มีฟังก์ชันใหม่
  (ขั้นตอน `npx convex deploy` ใน Vercel build ไม่ได้ push หรือ push ไม่ทัน)
- วิธีแก้ (ต้องรันจากเครื่องของผู้ใช้ เพราะ sandbox นี้ Convex เป็น local/anonymous):
  ```bash
  npx convex login
  npx convex deploy          # push ฟังก์ชันล่าสุดไป production deployment
  npx convex run users:ownerBootstrapStatus   # ตรวจว่ามีจริง
  ```
  หรือตั้ง `CONVEX_DEPLOY_KEY` ใน Vercel env แล้ว redeploy velcenter

**Smart Reorder บน Neon (#14):**
- ใหม่ `backend/reorder.ts` + `api.commerce.sellerReorderSuggestionsAction` —
  คำนวณจาก Neon `order_items` + `orders` (ยอดขายจริง รอบการซื้อเฉลี่ย
  คาดการณ์รอบถัดไป ความมั่นใจ high/medium/low/not_enough_data) + inventory
- Reorder.tsx เขียนใหม่: ใช้ข้อมูลจริง ไม่มี fake prediction (ข้อมูลไม่พอ = "ข้อมูลไม่พอ")
  ลบ dependency `api.products.*` (legacy Convex) ออกจากหน้า — CRUD สินค้าอยู่ที่ MyShop

**Storefront settings บน Neon (#15–16):**
- เพิ่ม keys `store_shop_name/tagline/phone/address/announcement` ใน
  `platform_settings` (Neon) + `storefrontSettings()` (public subset เท่านั้น)
- ใหม่ `api.storefront.settings` (public action) — velshop ShopHome อ่านจากนี้แทน
  legacy Convex `storeSettings`
- VelCenter settings tab เขียน/อ่านผ่าน `centerAdmin.getPlatformSettings` +
  `updatePlatformSettingAction` (Neon, owner/admin, audit-logged) แทน
  `api.center.updateSettings` (Convex storeSettings) — legacy storeSettings
  ไม่มี production read/write เหลือแล้ว (ยกเว้นในโค้ด legacy ที่ไม่ได้ใช้)

**Security sweep (#18/#22):** grep mock/dummy/fake/placeholder ใน production code
สะอาด; ไม่มี becomeSeller/becomeOwner หลงเหลือ; ไม่มี Math.random ใน dashboard

## ไฟล์ที่ตรวจแล้ว (สำหรับอ้างอิง)

- Docs: README.md, docs/ARCHITECTURE.md, docs/GAP_ANALYSIS.md, docs/PHASE_PLAN.md, docs/Velnox-CPNS.md, docs/CUSTOMER_MEMORY.md, docs/PHASE-10/11/12/13-REPORT.md, docs/PRODUCTION.md, docs/SECURITY.md
- Backend: src/backend/{db,identity,validation,errors,audit,platformSettings,rules,types,addresses,carts,checkout,orders,payments,payment,shipping,shipments,returns,reviews,wishlists,notifications,categories,products,inventory,sellers,subscriptions,finance,permissions,storage}.ts
- Convex: src/convex/{schema,auth,auth.config,auth/emailOtp,users,commerce,customer,center,centerAdmin,sellerOps,orders,products,subscriptions,goals,memory,memoryEvents,intelligence,rateLimit,http}.ts
- Frontend: src/pages/*, src/sites/*/main.tsx, src/components/{MobileTabBar,RequireAuth,RequireRole,shop/*,seller/*,reorder/*}, src/lib/{sites,track,customer-memory-core,cart,app-shell,commerce}.ts(x)
- DB: db/schema.sql, db/migrations/002–010
- Tests: tests/* (10 files) + src/lib/customer-memory-core.test.ts — 98 pass
- Config: package.json, vercel.json, convex.json, vite.config.ts, .env.example, .gitignore
