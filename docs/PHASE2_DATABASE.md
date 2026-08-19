# Velnox — PHASE 2: Database Architecture & Schema

> วันที่: 14 ส.ค. 2026 · อ่านก่อน: `docs/ARCHITECTURE.md` (Phase 1) + `docs/GAP_ANALYSIS.md`
> Deliverable: `db/schema.sql` (base) + `db/migrations/002…010` (Phase 2) + runner `db/migrate.ts` + ตรวจ `db/smoke.ts`

---

## 1. สถาปัตยกรรมที่ใช้ (ตามที่อนุมัติใน Phase 1)

```
VelShop / VelSeller / VelCenter
        │
   Backend (Convex runtime + src/backend/*)
        │
   ┌────┴───────────────┐
   │                    │
 Neon PostgreSQL      Convex
 Commerce Core        Auth + Intelligence + Realtime
 (Source of Truth)    (ไม่มี commerce source of truth ซ้ำ)
```

- **Neon = Source of Truth ของข้อมูลธุรกิจทั้งหมด** (users/sellers/shops/products/orders/payments/เงินทุกบาท)
- **Convex = auth + พฤติกรรมลูกค้า + recommendation + realtime** (ไม่มีตาราง commerce หลักซ้ำ — ข้อยกเว้น legacy `subscriptions` ที่จะ migrate เข้า Neon ใน Phase 10)
- ทุก calculation ที่เกี่ยวกับเงินทำใน Backend เท่านั้น (spec §49)

## 2. ความขัดแย้งระหว่าง Spec กับของเดิม — รายงานก่อนแก้ (§64.9)

| # | Spec | ของเดิม / การตัดสินใจ | สถานะ |
|---|---|---|---|
| C1 | §2 "Convex เป็น Primary Application Database" | **Neon เป็น Commerce Core** — อนุมัติแล้วใน Phase 1 (deliberate decision D1) เงิน/ออเดอร์/สินค้าอยู่ใน relational DB ปลอดภัยกว่า และ Convex เป็น auth + intelligence | ✅ อนุมัติแล้ว |
| C2 | §50 เงินเก็บเป็น integer minor units (satang) | ใช้ **`NUMERIC(12,2)` + currency** — PostgreSQL NUMERIC เป็นเลขทศนิยมแบบ exact (ไม่ใช่ float) ไม่มี error เรื่องเงิน และ backend เป็นคนคำนวณ เปลี่ยนทั้งระบบเป็น satang = migration ใหญ่โดยไม่ได้ประโยชน์จริง | 🟡 บันทึกใน D5 — เปลี่ยนได้ในอนาคตถ้าต้องการ |
| C3 | §10 `stores` | ของเดิมคือ **`shops`** (โค้ด backend/UI ใช้ `shops` ทั้งหมด) — ขยาย `shops` ในที่เลย ไม่สร้างตารางซ้ำ | ✅ |
| C4 | §11 `storeSettings` แยกตาราง | ของเดิมเก็บ settings ไว้ใน `shops` (announcement/phone/address) — เพิ่มคอลัมน์ (banner/business_hours/policies) ลง `shops` ตรง ๆ ประหยัด join | ✅ |
| C5 | §46 staffProfiles.department = OPERATIONS/FINANCE/SUPPORT/MARKETING/LEGAL/LOGISTICS/ADMIN | ของเดิม `users.department` = marketing/sales/operations/finance/general (velcenter UI ใช้อยู่) — **staff_profiles ใช้ชุดเดียวกัน** เพื่อไม่ให้มี enum 2 ชุดขัดแย้งกัน | ✅ |
| C6 | §24 สถานะ order enum เดียว 13 ค่า | ของเดิมแยก 3 แกน: `status` + `payment_status` + `shipping_status` (backend ใช้ทั้ง 3 แล้ว) — ขยายทั้ง 3 แกนให้ครบ lifecycle แทนการรวมเป็น enum เดียว | ✅ |
| C7 | §42 platformSettings เป็นคอลัมน์ตายตัว | ใช้ **key/value JSONB** — เพิ่ม setting ทีหลัง = เพิ่ม row ไม่ต้อง migration; seed ค่า default (commission 3%, shipping 10%, return threshold 10%) ให้ backend อ่าน | ✅ |
| C8 | §33 `velRepeatSubscriptions` | ของเดิมคือ `subscriptions` (Neon) + **Convex มี `subscriptions` legacy ซ้ำ** — Neon เป็น source of truth เดียว; Convex ตัวเก่า deprecated และ migrate ใน Phase 10 (ห้ามสร้าง entity ซ้ำเพิ่ม) | 🟡 ต้องทำใน Phase 10 |
| C9 | §17 `inventory.stock` ต่อ product | เพิ่ม `variant_id` + partial unique index (product เดียว / product+variant) — รองรับ variant โดยไม่พังข้อมูลเดิม | ✅ |
| C10 | §7 address city/subdistrict/district/province | ของเดิมมี city/state — เพิ่ม subdistrict/district/province + map เอกสาร: city→province, state→district | ✅ |

## 3. Entity ทั้งหมด (36 ตารางหลัง Phase 2)

**Layer 1 — Identity** (spec §58): `users` (+status) · `user_profiles` · `addresses` (+GPS)

**Layer 2 — Commerce**: `sellers` (+profile/approval) · `shops` (+settings/location) · `categories` · `products` (+type/moderation) · `product_variants` · `product_images` (+variant) · `inventory` (+variant)

**Layer 3 — Transaction**: `carts` · `cart_items` · `wishlists` · `wishlist_items` · `orders` (+multi-seller/tax) · `order_items` (+variant/sku) · `payments` (+provider) · `payment_transactions`

**Layer 4 — Logistics**: `shipments` · `tracking_events`

**Layer 5 — After Sales**: `returns` · `return_items` · `refunds` (+provider) · `reviews`

**Layer 6 — Subscription**: `subscriptions` (VelRepeat, Neon only) · `velrepeat_orders`

**Layer 7 — Finance**: `financial_ledger` (source of truth เงิน) · `seller_balances` · `seller_payouts` · `commissions` · `settlements`

**Layer 8 — Platform**: `platform_settings` · `notifications` · `audit_logs` · `staff_profiles` · `coupons` · `promotions`

## 4. ไฟล์ migration

| ไฟล์ | เนื้อหา |
|---|---|
| `db/schema.sql` | Base Commerce Core 14 ตาราง (เดิม — ไม่แตะ) |
| `db/migrations/002_profiles_gps.sql` | user_profiles, users.status, addresses GPS |
| `db/migrations/003_catalog.sql` | categories (+seed), products ext, product_variants, inventory variant |
| `db/migrations/004_cart_wishlist.sql` | carts, cart_items, wishlists, wishlist_items |
| `db/migrations/005_orders_payments.sql` | orders multi-seller + statuses, order_items snapshot, payments provider, payment_transactions, refunds |
| `db/migrations/006_logistics_returns.sql` | shipments, tracking_events, returns, return_items |
| `db/migrations/007_reviews_velrepeat.sql` | reviews, velrepeat_orders, subscriptions ext |
| `db/migrations/008_finance.sql` | financial_ledger, seller_balances, seller_payouts |
| `db/migrations/009_seller_store.sql` | sellers profile/approval, shops settings + GPS |
| `db/migrations/010_platform.sql` | platform_settings (+seed), notifications, audit_logs, staff_profiles, coupons, promotions |

ทุกไฟล์ **idempotent** — `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` / guarded `DROP CONSTRAINT` → `ADD CONSTRAINT` ใน `DO $$` block — รันซ้ำกี่รอบก็ไม่พัง และ **ไม่ DROP ข้อมูลเดิม**

## 5. Security & Integrity (spec §49, §53, §54, §55)

- Frontend **ไม่เคย**กำหนด price/total/commission/stock/status — backend คำนวณทั้งหมด (โครงสร้างเดิม + `src/backend/*`)
- CHECK constraint กันข้อมูลผิด: เงิน ≥ 0, stock ≥ 0, quantity > 0, rating 1–5, latitude ±90 / longitude ±180, amount > 0 (payout)
- **Soft delete** (`deleted_at`) บน users/sellers/shops/products/addresses — ข้อมูลสำคัญไม่ hard delete
- **Financial records ห้าม hard delete** — การแก้ไข = เขียน `ADJUSTMENT` รายการใหม่ใน ledger (document ใน 008_finance.sql)
- `financial_ledger` เป็น Source of Truth ของเงิน — `seller_balances` เป็น projection ที่ backend คำนวณจาก ledger
- audit_logs เป็น append-only

## 6. Money Architecture (spec §50, §58)

```
Order
  ├── order_items.subtotal (snapshot ราคาตอนซื้อ)
  ├── commissions (3% snapshot ต่อรายการ)
  ├── refunds / returns (policy ≤10%)
  └── financial_ledger entries:
        SALE (+) → PLATFORM_COMMISSION (−) → SHIPPING_REVENUE (+/−)
        → REFUND / RETURN_COST (−) → PENALTY (ถ้า return rate > 10%) → SELLER_PAYOUT
```

- ชนิด: `NUMERIC(12,2)` + `currency` ทุกแถวการเงิน (C2)
- commission/return threshold/shipping % อ่านจาก `platform_settings` — **ไม่ hard-code** (spec §38/§39/§41)

## 7. GPS Architecture (spec §8)

- `addresses` + `shops` มี latitude/longitude/place_id + subdistrict/district/province
- CHECK กันพิกัดนอกช่วง
- 3 วิธีสร้าง: CURRENT_LOCATION / MAP_PICKER (ลาก marker ได้) / MANUAL — UI อยู่ใน Phase 5/6; ฝั่ง DB พร้อมรับแล้ว
- Address ที่มีอยู่ก่อน GPS (ไม่มีพิกัด) ยังใช้ได้ — อนุญาต NULL, บังคับพิกัดเฉพาะ address ใหม่ (ตามนโยบาย migration)

## 8. Definition of Done (Phase 2) ✅

- [x] Database entities ครบ (36 ตาราง — 14 base + 22 ใหม่)
- [x] Relationships ถูกต้อง (FK ทุกจุด, ON DELETE ตาม ownership)
- [x] Users system พร้อม (status, soft delete, profile)
- [x] Seller system พร้อม (profile, approval audit, rejected status)
- [x] Store system พร้อม (settings, policies, GPS)
- [x] Product system พร้อม (type, moderation status, slug, compareAt, soft delete)
- [x] Category system พร้อม (hierarchy + seed)
- [x] Inventory พร้อม (variant-level, reserved, partial unique)
- [x] Cart พร้อม (multi-seller, price snapshot)
- [x] Order พร้อม (multi-seller parent, tax, full statuses)
- [x] Payment พร้อม (provider, transaction journal)
- [x] Shipping พร้อม (shipments + carrier + tracking)
- [x] Tracking พร้อม (tracking_events timeline)
- [x] Return พร้อม (full lifecycle + evidence)
- [x] Refund พร้อม (provider ref, completed_at)
- [x] Review พร้อม (rating 1–5, verified purchase)
- [x] VelRepeat พร้อม (subscriptions + velrepeat_orders; Convex legacy ต้อง migrate ใน Phase 10)
- [x] Seller balance พร้อม (projection จาก ledger)
- [x] Seller payout พร้อม (lifecycle + method/destination)
- [x] Financial ledger พร้อม (8 ประเภท transaction)
- [x] Platform settings พร้อม (key/value + seed ครบ)
- [x] Notifications พร้อม (8 ประเภท)
- [x] Staff permissions พร้อม (staff_profiles + permission catalog)
- [x] Audit logs พร้อม (append-only, actor/entity/action index)
- [x] Indexes ถูกออกแบบ (ตาม spec §52 + index ที่ query จริงใช้)
- [x] Security rules ถูกกำหนด (CHECK, soft delete, backend-only calculation)
- [x] Money calculation architecture ถูกกำหนด (ledger + NUMERIC + platform settings)
- [x] GPS architecture ถูกกำหนด (3 วิธี + NULL policy สำหรับข้อมูลเก่า)

## 9. สิ่งที่ยังไม่ทำใน Phase 2 (ตาม spec §62 — ไม่สร้าง UI)

- Backend services ต่อตารางใหม่ → **Phase 3**
- UI ใด ๆ → Phase 5–7
- migrate Convex `subscriptions` legacy → Neon → Phase 10 (พร้อมกับ VelRepeat cron)

## 10. ขั้นต่อไป

**PHASE 3 — BACKEND** : สร้าง services/API/authorization สำหรับ entity ใหม่ (categories, carts, checkout multi-seller, variants, reviews, returns, ledger, audit, notifications, platform settings) — ต่อจาก `src/backend/*` ที่มีอยู่
