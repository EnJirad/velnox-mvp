# Velnox — Phase Plan (Phase 2–12)

> แผนงานต่อจาก **Phase 1 (Architecture)** — อิงจาก `docs/ARCHITECTURE.md` + `docs/GAP_ANALYSIS.md`
> หลักการ: ต่อยอดจากโค้ดที่ทำงานได้อยู่แล้ว **ห้าม rewrite** — ทุก Phase เริ่มจากสิ่งที่ `src/backend/` + `src/convex/` + `db/schema.sql` มีแล้ว

---

## ภาพรวม

```
Phase 1 ✅ Architecture (เอกสาร 3 ฉบับใน docs/)
Phase 2  Database   — ขยาย Neon schema (categories/variants/cart/audit ฯลฯ) + migration
Phase 3  Backend    — src/backend/* ต่อตารางใหม่ + validation + error mapping
Phase 4  Auth       — profile/email/phone management + RBAC guard ครบ
Phase 5  VelShop    — catalog/category/search + cart + checkout multi-seller + GPS/address
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

## Phase 3 — Backend (src/backend/*)

**เป้าหมาย:** ทุก business rule อยู่ใน backend ชัดเจน ไม่มี hard-code ใน frontend

- ต่อ service ใหม่: `categories.ts`, `carts.ts`, `reviews.ts`, `wishlists.ts`, `notifications.ts`, `ledger.ts`, `audit.ts`
- `orders.ts` — ขยายเป็น checkout multi-seller: validate cart → group by seller → สร้าง seller order + parent order → reserve stock (transaction)
- `payments.ts` — ต่อ `PaymentProvider` interface (Phase 9 เริ่มตอนนี้ที่ interface)
- `subscriptions.ts` — อ่าน/เขียนเฉพาะ Neon (ยกเลิก Convex subscriptions)
- validation: สร้าง `src/backend/validation.ts` (zod schema กลาง — มี zod ใน deps แล้ว)
- error mapping กลาง: ทุก function คืน error เป็นภาษาไทยที่ frontend แสดงได้
- **ทุก mutation ตรวจ auth + authorization + ownership** (guard ร่วมใน `src/backend/auth.ts`)

---

## Phase 4 — Authentication & Profile

- ต่อจาก Convex Auth (email OTP + guest) ที่มีอยู่
- Profile management: เปลี่ยนชื่อ/รูป (มีแล้ว) + เปลี่ยน email/phone ตาม security rules (ต้องยืนยัน OTP ใหม่)
- Password recovery — ยังเป็น OTP-based อยู่ (ไม่ต้องมี password) → ตัดสินใจว่าต้องการ password-based หรือไม่ (ถามเจ้าของ)
- RBAC guard ครบทุกจุด: `requireSeller()`, `requireRole(owner|admin)`, department scoping สำหรับ velcenter
- เก็บ `convex_id` ↔ `users` (Neon) sync ให้แน่น (ตอนนี้สร้างเมื่อเปิดร้าน/สั่งซื้อ) — ควร sync ทันทีเมื่อ login ผ่าน event bridge

---

## Phase 5 — VelShop

- **Catalog**: categories (tree), search, filter (หมวด/ราคา/ร้าน), sort, related products
- **Product detail**: images gallery, variants, stock, seller card + rating, review section, wishlist ❤️, "สั่งรายเดือน" (VelRepeat)
- **Store page**: logo/banner/description/rating/สินค้า/รีวิว + follow
- **Cart**: เพิ่ม/ลด/ลบ quantity, multiple sellers, stock validation, price snapshot (จาก `carts` ใหม่)
- **Checkout**: เลือก address (+ GPS), split ตาม seller → สร้าง orders, validate อีกครั้งที่ backend (stock/price)
- **GPS/Address (ข้อ 6–7)**: ฟอร์ม address + 3 วิธี: ใช้ตำแหน่งปัจจุบัน / เลือกบนแผนที่ / ลาก marker — ใช้ Leaflet (ฟรี ไม่ต้อง key) หรือ Google Maps (`VITE_MAP_API_KEY`) — ตัดสินใจใน Phase 5; บังคับ lat/long ก่อนบันทึก
- **Order tracking**: สถานะ + timeline (จาก tracking events Phase 8)
- **My Orders**: รายการ/สถานะ/ยกเลิก/สั่งซ้ำ/รีวิว

---

## Phase 6 — VelSeller

- Product: variants editor, product type (ONE_TIME/VELREPEAT/SERVICE/DIGITAL/PHYSICAL), weight/dimensions, SKU
- Order fulfillment: accept/reject, pack, tracking number, ship (สถานะเต็มจาก Phase 2)
- Return management: ดู request + evidence, approve/reject, กำหนดผู้รับผิดชอบ (seller/platform ตาม policy)
- Store settings: banner, operating hours, policies, return address + **location GPS** (map picker เหมือนลูกค้า)
- Dashboard: เพิ่ม KPI ครบตามข้อ 17.1 (return rate, net income, pending payout, available balance)
- Smart Reorder: ต่อเนื่อง (มีแล้ว) + เชื่อม inventory reserved_quantity

---

## Phase 7 — VelCenter

- **Platform settings UI**: commission %, shipping %, return threshold, auto-approve flags, currency, tax (เก็บใน `platform_settings` — admin/owner เท่านั้น, ทุกการแก้ audit)
- **Seller management**: approve/reject/suspend/activate + detail (ยอด/ออเดอร์/สินค้า/return rate)
- **Product moderation**: approve/reject/hide + review images
- **Reports**: GMV, commission, shipping revenue, refunds, penalties, company revenue, seller payouts (จาก ledger — Phase 10 เต็มรูปแบบ)
- RBAC ต่อ: ฝ่าย (department) เห็นเฉพาะ module ของตัวเอง

---

## Phase 8 — Shipping

- `ShippingProvider` interface (ข้อ 55): createShipment / getShipment / trackShipment / cancelShipment / calculateRate
- ตาราง `shipments` + `tracking_events` (มี `orders.tracking_number` เป็นฐาน — migration ต่อ)
- Provider ตัวแรก: **Flash Express** หรือ **Kerry** (ถามเจ้าของ / ใช้ Gravity Index หา service) — MVP อาจ mock provider ไว้ก่อน แต่ interface จริง
- Return shipping flow: สร้าง shipment คืน, status RETURN_SHIPPING → RECEIVED
- Shipping fee คำนวณใน backend (ไม่ hard-code frontend)

---

## Phase 9 — Payment

- `PaymentProvider` interface (ข้อ 56): createPayment / verifyPayment / refundPayment
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
