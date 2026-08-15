# Velnox — Phase Plan (Phase 2–12)

> แผนงานต่อจาก **Phase 1 (Architecture)** — อิงจาก `docs/ARCHITECTURE.md` + `docs/GAP_ANALYSIS.md`
> หลักการ: ต่อยอดจากโค้ดที่ทำงานได้อยู่แล้ว **ห้าม rewrite** — ทุก Phase เริ่มจากสิ่งที่ `src/backend/` + `src/convex/` + `db/schema.sql` มีแล้ว

---

## ภาพรวม

```
Phase 1 ✅ Architecture (เอกสาร 3 ฉบับใน docs/)
Phase 2 ✅ Database   — ขยาย Neon schema (categories/variants/cart/audit ฯลฯ) + migration
Phase 3 ✅ Backend    — src/backend/* ต่อตารางใหม่ + validation + error mapping + tests
Phase 4  Auth       — profile/email/phone management + RBAC guard ครบ (ยังไม่เริ่ม — spec เจ้าของสลับลำดับเป็น VelShop ก่อน)
Phase 5 ✅ VelShop   — catalog/category/search + cart + checkout multi-seller + GPS/address
Phase 6  VelSeller  — variants/product type + order fulfillment + store settings + location
Phase 7  VelCenter  — platform settings + seller approve/suspend + product moderation + reports
Phase 8  Shipping   — ShippingProvider abstraction + tracking events + return flow เต็ม
Phase 9  Payment    — PaymentProvider abstraction + webhook + refund integration
Phase 10 Financial  — ledger + settlement อัตโนมัติ + penalty อัตโนมัติ + audit + notification + VelRepeat cron
Phase 11 Testing    — unit/integration test สำหรับ backend + CI
Phase 12 Production — staging/prod env, deploy pipeline, monitoring, backup
```

> หมายเหตุ: ใน repo นี้ "Phase 1 Architecture" = เอกสาร 3 ฉบับใน `docs/` (ARCHITECTURE / GAP_ANALYSIS / PHASE_PLAN นี้) — โค้ดที่ใช้งานได้จริงถูกสร้างก่อนหน้าแล้วและเป็นฐานของ Phase 2 เป็นต้นไป

---

## Phase 2 — Database (Neon Commerce Core) ✅ เสร็จแล้ว

> 📄 รายละเอียดเต็ม: **`docs/PHASE2_DATABASE.md`** — design + conflicts ที่รายงาน + Definition of Done
> สรุป: 36 ตาราง (14 base + 22 ใหม่ใน `db/migrations/002…010`) — `bun run db:migrate` รัน base + migrations เรียงลำดับอัตโนมัติ, `bun run db:smoke` ตรวจตาราง + seeds ครบ

**เป้าหมาย:** schema รองรับ spec ครบโดยไม่ทำลายของเดิม (migration แบบ safe, backward compatible)

### ตารางใหม่ (เพิ่มใน `db/schema.sql` เป็น migration `002`)
| ตาราง | เหตุผล | หมายเหตุ |
|---|---|---|
| `categories` | หมวด hierarchy (parent/child, image, description, active, sort_order) | เชื่อม `products.category_id` — เก็บ `category` TEXT เก่าไว้ชั่วคราวระหว่าง migration |
| `product_variants` | SKU/price/stock/image/weight ต่อ variant (ข้อ 20) | FK → products |
| `carts` + `cart_items` | cart หลายสินค้า/หลายร้าน (ข้อ 11) | cart_items มี product_id/quantity/unit_price_snapshot |
| `product_types` หรือคอลัมน์ `type` | ONE_TIME/VELREPEAT/SERVICE/DIGITAL/PHYSICAL (ข้อ 19) | เพิ่ม CHECK ใหม่ ไม่ลบของเดิม |
| `wishlist_items` | wishlist (ข้อ 8) | FK user + product, unique(user, product) |
| `reviews` | รีวิวสินค้า/ร้าน (ข้อ 8, 10) | rating 1–5 + comment + images |
| `notifications` | in-app notification (ข้อ 46) | receiver_id, type, payload, read_at |
| `platform_settings` | commission/shipping %/return threshold/currency/tax (ข้อ 23/34/35) | single-row key-value + audit |
| `audit_logs` | ทุก action สำคัญ (ข้อ 47) | user/action/target/timestamp/ip/metadata |
| `ledger_entries` | financial journal (ข้อ 57) | order_id/seller_id/type/amount/debit/credit/reference |
| `seller_balances` + `seller_payouts` | ยอดค้างจ่าย + ประวัติจ่าย (ข้อ 17.1/33) | |

### การแก้ของเดิม (migration `001`-ต่อเนื่อง)
- `addresses` + `latitude` `longitude` `place_id` (GPS — ข้อ 7)
- `shops` + `banner_url`, `operating_hours`, `return_address`, `policies` (ข้อ 26)
- `orders` — ขยาย status enum ตามข้อ 13 (PENDING_PAYMENT/PAID/PROCESSING/PACKED/SHIPPED/IN_TRANSIT/DELIVERED/COMPLETED) โดย map ค่าเดิม (`pending`→PENDING_PAYMENT เป็นต้น) — **ใช้ migration UPDATE ไม่ใช่ drop**
- `refunds` — ขยาย lifecycle ตามข้อ 15 (RETURN_REQUESTED/UNDER_REVIEW/APPROVED/RETURN_SHIPPING/RECEIVED/REFUNDING/REFUNDED) + `evidence_urls`
- `order_items` — เพิ่ม `variant_id`, `variant_name`, `discount`, `shipping_fee` ต่อรายการ
- `subscriptions` (Neon) — เป็น **source of truth เดียว** ของ VelRepeat; ลบ/ยกเลิกการใช้งาน `subscriptions` ใน Convex หลัง migration ข้อมูล
- `sellers` — เพิ่ม `return_rate` (คำนวณ) + `penalty_balance`

### Deliverable
- `db/migrations/002_*.sql` (ไฟล์ migration รายตัว) — เพิ่มรองรับ version tracking ใน `db/migrate.ts`
- `db/smoke.ts` อัปเดตให้ตรวจตารางใหม่
- seed หมวดหมู่เริ่มต้น (Electronics/Home/Beauty ฯลฯ)

---

## Phase 3 — Backend (src/backend/*) ✅ เสร็จแล้ว

> 📄 รายละเอียดเต็ม: **`docs/PHASE3_BACKEND.md`** — conflicts ที่รายงาน + Definition of Done
> สรุป: foundation (errors/validation/rules/permissions/audit/identity) + services ครบ (addresses/categories/carts/**checkout multi-seller atomic**/wishlists/reviews/shipments/returns/notifications/platform settings/finance) + Convex node actions 3 ชุด (customer/sellerOps/centerAdmin) + **tests 30 ผ่าน** (`bun test`) + build ตาม §55

**เป้าหมาย:** ทุก business rule อยู่ใน backend ชัดเจน ไม่มี hard-code ใน frontend

- ✅ foundation: `errors.ts` (error codes กลาง), `validation.ts` (zod + GPS), `rules.ts` (commission/return/shipping จาก platform_settings — ไม่ hard-code), `permissions.ts` (13 permissions + RBAC), `audit.ts`, `identity.ts` (guards กลาง)
- ✅ services: `addresses.ts` (+GPS บังคับ default), `categories.ts`, `carts.ts`, `checkout.ts` (multi-seller atomic §39–42), `wishlists.ts`, `reviews.ts` (verified purchase), `shipments.ts`+tracking, `returns.ts` (+penalty), `notifications.ts`, `platformSettings.ts`, `finance.ts` (ledger/payout/report)
- ✅ `orders.ts` — ดึง state machine เป็น pure helper `canTransitionOrderStatus` (ทดสอบได้)
- ✅ Convex node actions: `customer.ts` (VelShop), `sellerOps.ts` (VelSeller), `centerAdmin.ts` (VelCenter)
- ✅ tests: `tests/` (vitest) 30 tests ครอบ §60–63 (commission 3%, return penalty, GPS, state machine, RBAC)
- ✅ build ตาม §55: `tsc -b && vite build` — ไม่มี convex codegen ใน production build
- ⏳ ที่เหลือ (Payment/Shipping provider, ledger เต็ม, integration tests) → Phase 8–11

---

## Phase 4 — Authentication & Profile

- ต่อจาก Convex Auth (email OTP + guest) ที่มีอยู่
- Profile management: เปลี่ยนชื่อ/รูป (มีแล้ว) + เปลี่ยน email/phone ตาม security rules (ต้องยืนยัน OTP ใหม่)
- Password recovery — ยังเป็น OTP-based อยู่ (ไม่ต้องมี password) → ตัดสินใจว่าต้องการ password-based หรือไม่ (ถามเจ้าของ)
- RBAC guard ครบทุกจุด: `requireSeller()`, `requireRole(owner|admin)`, department scoping สำหรับ velcenter
- เก็บ `convex_id` ↔ `users` (Neon) sync ให้แน่น (ตอนนี้สร้างเมื่อเปิดร้าน/สั่งซื้อ) — ควร sync ทันทีเมื่อ login ผ่าน event bridge

---

## Phase 5 — VelShop ✅ เสร็จแล้ว (spec "PHASE 4 — VELSHOP")

> หมายเหตุ: spec ที่เจ้าของส่งมาระบุ "PHASE 4 = VelShop" — ในแผนฉบับนี้ตรงกับ **Phase 5 (VelShop)** ตามลำดับเดิม

- ✅ **Backend cart แทน localStorage** (`src/lib/cart.tsx`): ตะกร้าอยู่ใน Neon จริง (ผ่าน `api.customer.*`) — spec §12 ห้าม localStorage เป็น source of truth; guest เห็น in-memory cart ชั่วคราวเท่านั้น
- ✅ **Catalog/Home**: search + category filter + สินค้ายอดนิยม/แนะนำ (VelRepeat) + สินค้าประจำ (customer memory) + **ส่วนร้านค้าในตลาด** (`publicShops`)
- ✅ **Product detail** (`/shop/products/:id`): gallery + zoom thumb, stock, qty, ใส่ตะกร้า/ซื้อเลย, wishlist ❤️, VelRepeat dialog, รีวิว + verified purchase
- ✅ **Store page** (`/shop/shops/:id`): banner/logo/ชื่อ/rating/จำนวนสินค้า/ออเดอร์ + สินค้าของร้าน
- ✅ **Cart** (`/shop/cart`): แยกตามร้าน (multi-seller), เพิ่ม/ลด/ลบ, stock สูงสุด, สรุปยอด
- ✅ **Checkout** (`/shop/checkout`): เลือกที่อยู่ (default ก่อน, ตรวจ GPS) + วิธีชำระ (COD/PromptPay/โอน/บัตร) + review + **multi-shop order** ผ่าน `checkoutAction` (backend คำนวณราคา/stock ใหม่ §40–41) + หน้าสำเร็จ
- ✅ **GPS/Address** (`/shop/addresses` + `MapPicker` Leaflet): ใช้ตำแหน่งปัจจุบัน / แตะแผนที่ / ลาก marker; default shipping address บังคับ lat/long (§62)
- ✅ **Orders** (`/shop/orders` + `/shop/orders/:id` + `/shop/orders/:id/tracking`): รายการ + detail + timeline + tracking events จาก shipment + **หน้า tracking เฉพาะ**
- ✅ **Order actions** (detail): **ยกเลิกออเดอร์** (ก่อนจัดส่ง — คืนสต็อกอัตโนมัติ), **ซื้ออีกครั้ง** (`reorderAction` ตรวจ product status/stock ใหม่ทุกครั้ง §28), **ขอคืนสินค้า** (`requestReturnAction`), **รีวิวสินค้า** (verified purchase — delivered/completed เท่านั้น)
- ✅ **VelRepeat** (`/shop/velrepeat`): รายการ subscription (active/paused/cancelled) + pause/resume/cancel + **แก้ไขจำนวน/รอบ** (`updateSubscriptionAction` — backend คำนวณ next_order_date ใหม่เสมอ)
- ✅ **Product catalog** (`/shop/products`): search (debounce) + filter หมวดหมู่/ร้านค้า/ช่วงราคา/มีสต็อก + sort (ใหม่ล่าสุด/ราคา/ขายดี/คะแนน) + pagination — **backend-driven** (`catalogProductsAction` นับและกรองใน SQL §31)
- ✅ **Categories** (`/shop/categories`): category tree จาก backend จริง (`categoryStatsAction`) + จำนวนสินค้าจริง (ผ่าน category_id)
- ✅ **Header**: search bar → `/shop/products?q=`, nav หน้าแรก/สินค้า/หมวดหมู่/ออเดอร์/รายการโปรด + VelRepeat icon
- ✅ **Wishlist** (`/shop/wishlist`), **Profile** (`/shop/profile`), **Notifications** (`/shop/notifications` — mark read/all)
- ✅ ทุกหน้า protected ผ่าน `RequireAuth` + returnTo กลับหน้าเดิม; frontend ไม่ trust price/stock/role (backend ตัดสิน)

---

## Phase 6 — VelSeller

- Product: variants editor, product type (ONE_TIME/VELREPEAT/SERVICE/DIGITAL/PHYSICAL), weight/dimensions, SKU
- Order fulfillment: accept/reject, pack, tracking number, ship (สถานะเต็มจาก Phase 2)
- Return management: ดู request + evidence, approve/reject, กำหนดผู้รับผิดชอบ (seller/platform ตาม policy)
- Store settings: banner, operating hours, policies, return address + **location GPS** — backend พร้อมแล้ว (`updateShopLocationAction` + `shops.latitude/longitude` + guard เจ้าของร้าน + audit) ยังเหลือ UI ฝั่ง VelSeller
- Dashboard: เพิ่ม KPI ครบตามข้อ 17.1 (return rate, net income, pending payout, available balance)
- Smart Reorder: ต่อเนื่อง (มีแล้ว) + เชื่อม inventory reserved_quantity

---

## Phase 6 (spec "PHASE 6") — Integration, Business Rules & Production Readiness ✅

> spec ที่เจ้าของส่งมาระบุ PHASE 6 = Integration/Production Readiness (ไม่ใช่ VelSeller ซึ่งคือ Phase 7 ในแผนเดิม)

- ✅ **ShippingProvider abstraction** (`src/backend/shipping.ts`): interface (calculateShipping/createShipment/cancelShipment/trackShipment/getTrackingStatus) + **manual provider** ใช้งานได้จริงวันนี้ (seller กรอก carrier + tracking, append events) + registry + TODO ชัดเจนสำหรับ Kerry/Flash/J&T/Thailand Post/DHL (Phase 10)
- ✅ **PaymentProvider abstraction** (`src/backend/payment.ts`): interface (createPayment/verifyPayment/refundPayment) + **manual provider** (COD/โอน/PromptPay บันทึก PENDING — ไม่ fake success; ยืนยันเมื่อเงินถึงจริง) + registry + TODO สำหรับ Omise/Stripe (Phase 9)
- ✅ **Shop GPS** (§11/§21): `updateShopLocation` + `updateShopLocationAction` (seller-owned, gpsSchema) + `Shop.latitude/longitude` ใน type/mapper
- ✅ **Audit wiring** (§39): เพิ่ม audit ลง `SELLER_UPDATED_ORDER_STATUS`, `CUSTOMER_CANCELLED_ORDER`, `CUSTOMER_CREATED_ORDER`, `CUSTOMER_REQUESTED_RETURN`, `SELLER_UPDATED_SHOP` (มีอยู่แล้ว: seller approve/product approve/settings/refund/payout)
- ✅ **Search** (§34): catalogProducts ค้น name + description (backend ILIKE)
- ✅ **SEO** (§44): `src/lib/seo.ts` (title/description/canonical/OG/Twitter/JSON-LD) + ใส่ใน Home / Products / Product detail (Product schema) / Categories / Shop
- ✅ **Tests** (§50): `tests/providers.test.ts` (shipping + payment contracts) — รวม 48 tests ผ่าน
- ✅ **Build** (§65): `bun run build` ผ่าน (tsc -b && vite build — ไม่ต้อง login Convex CLI)
- ✅ **Cleanup sweep** (§61): ไม่พบ mock/dummy/console.log หลงเหลือ — เหลือ TODO ที่ตั้งใจไว้ 2 จุด (carrier/gateway integration)

**Decisions / deferred (บันทึกตาม §63 — ไม่ fake):**
- **เงิน**: เก็บเป็น NUMERIC(12,2) ใน Neon + `round2()` server-side (ตามที่อนุมัติใน Phase 2–3) — ไม่ refactor เป็น satang integer; เงินทั้งหมดคำนวณใน backend เท่านั้น
- **โครงสร้าง monorepo** (apps/ packages/): repo ปัจจุบันเป็น single app ที่มี 3 หน้าเว็บแยก entry (velshop/velseller/velcenter) + backend/convex ร่วมกัน — รักษาโครงสร้างที่อนุมัติแล้ว 3 เว็บ deploy แยกกันได้โดยใช้ base เดียวกัน
- **Product variants**: ตาราง `product_variants` มีแล้ว (migration 003) แต่ยังไม่มี service/UI — เป็นงาน VelSeller (Phase 7)
- **Category linkage**: สินค้ายังไม่ได้ set `category_id` (ใช้ enum) — หน้า /shop/categories แสดง tree + นับของจริง; ให้ seller form set category_id ใน Phase 7
- **Carrier API + Payment gateway**: abstraction + manual provider พร้อม — รอ Phase 8/9 (พร้อมใช้ Gravity Index เลือก provider)

---

## Phase 7 — VelCenter

- **Platform settings UI**: commission %, shipping %, return threshold, auto-approve flags, currency, tax (เก็บใน `platform_settings` — admin/owner เท่านั้น, ทุกการแก้ audit)
- **Seller management**: approve/reject/suspend/activate + detail (ยอด/ออเดอร์/สินค้า/return rate)
- **Product moderation**: approve/reject/hide + review images
- **Reports**: GMV, commission, shipping revenue, refunds, penalties, company revenue, seller payouts (จาก ledger — Phase 10 เต็มรูปแบบ)
- RBAC ต่อ: ฝ่าย (department) เห็นเฉพาะ module ของตัวเอง

---

## Phase 8 — Shipping

- ✅ `ShippingProvider` interface (ข้อ 22): calculateShipping / createShipment / cancelShipment / trackShipment / getTrackingStatus — **เสร็จใน Phase 6** (`src/backend/shipping.ts`, manual provider ใช้งานได้แล้ว)
- ตาราง `shipments` + `tracking_events` มีแล้ว (migration 006)
- Provider ตัวแรกจริง: **Flash Express** หรือ **Kerry** (ถามเจ้าของ / ใช้ Gravity Index หา service) — ต่อจาก registry ที่วางไว้
- Return shipping flow: สร้าง shipment คืน, status RETURN_SHIPPING → RECEIVED
- Shipping fee คำนวณใน backend (ไม่ hard-code frontend)

---

## Phase 9 — Payment

- ✅ `PaymentProvider` interface (ข้อ 24): createPayment / verifyPayment / refundPayment — **เสร็จใน Phase 6** (`src/backend/payment.ts`, manual provider: COD/โอน/PromptPay บันทึก PENDING)
- วิธีที่แนะนำสำหรับไทย: **PromptPay QR (Omise/Opn Payments)** หรือ **Stripe** — ใช้ Gravity Index ตอนเริ่ม Phase 9 เพื่อเลือก service
- Webhook endpoint (Convex http action) ยืนยัน payment → อัปเดต `payments` + trigger business event → แจ้ง seller
- Refund ผ่าน provider (refundPayment) + บันทึกใน `refunds` + กลับ ledger
- COD ยังใช้ได้ (วิธี enum มีอยู่แล้ว)

---

## Phase 10 — Financial System + VelRepeat + Notification + Audit

- **Ledger**: ทุกการเคลื่อนไหวเงินเขียน `ledger_entries` (Order→Gross→Commission→Shipping→Return Cost→Seller Payout→Company Revenue)
- **Settlement**: cron (Convex cron) สร้าง `settlements` + `seller_payouts` ทุกสิ้นเดือนอัตโนมัติ
- **Return penalty อัตโนมัติ**: return_rate > 10% → คำนวณส่วนเกิน → หักจากยอดรับจริง (ตอนนี้ flag อย่างเดียว)
- **VelRepeat เต็มรูปแบบ**: source of truth = Neon `subscriptions` เดียว; Convex cron ตรวจ `next_order_date` → สร้าง order อัตโนมัติ → อัปเดตรอบถัดไป → แจ้งเตือนลูกค้า/ร้านค้า; ย้ายข้อมูล subscriptions จาก Convex เก่ามา Neon (migration)
- **Notification**: in-app (`notifications` table) + email (ผ่าน provider — Gravity Index)
- **Audit log**: เขียนทุก action สำคัญ (ADMIN_APPROVED_SELLER, SELLER_UPDATED_PRODUCT, CUSTOMER_CREATED_ORDER, ADMIN_CHANGED_PLATFORM_SETTING…)
- **Intelligence (VelRepeat)**: ต่อจากที่มี (avgCycleDays, purchase cycle) — เก็บ behavior ใน Convex ตามสถาปัตยกรรม (Convex = Intelligence)

---

## Phase 11 — Testing

- Unit test: `src/backend/*` (commission calc, penalty, order snapshot, ledger)
- Integration test: Neon ทดสอบ (test database แยก) — สร้าง order → stock reserve → payment → settlement flow
- Test runner: Vitest (มี ecosystem อยู่แล้วใน Vite project)
- CI: GitHub Actions — typecheck (`bun tsc -b --noEmit`) + test + `convex deploy` เฉพาะ production branch

---

## Phase 12 — Production Deployment

- สร้าง deployment แยก: dev / staging / production (Convex)
- Env แยกตาม deployment (Keys/API keys) — ตาม `INSTALL_AND_USAGE.md` §6
- Deploy 3 เว็บ Vercel (มีคู่มือแล้ว) + custom domains (shop/seller/center.velnox.com)
- Monitoring: error tracking (Sentry — Gravity Index) + uptime
- Backup: Neon automated backup + policy ทดสอบ restore
- Security review: CORS/Allowed Origins, rate limit, secret rotation

---

## ลำดับแนะนำสำหรับเจ้าของ

1. **เริ่ม Phase 2** (Database) — พื้นฐานทุกอย่าง ต่อยอดจาก `db/schema.sql` ที่มีแล้ว
2. ระหว่าง Phase 2–3 ตั้ง **Neon + Cloudinary** ให้ครบ (Keys/API keys) แล้วรัน `db:migrate` หนึ่งครั้ง
3. Phase 5 (VelShop catalog + cart) เป็นฟีเจอร์ที่ user เห็นผลเร็วสุด — ถ้าอยากได้ของโชว์ก่อน อาจสลับ Phase 5 ขึ้นมาหลัง Phase 3

> แต่ละ Phase มี deliverable ตรวจสอบได้ และไม่ทำลายของเดิม — migration ทุกอัน safe (CREATE/UPDATE ไม่ DROP)
