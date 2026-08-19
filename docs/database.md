# VELNOX — Database (Neon Commerce Core)

Version: 1.0 · Phase 10 — ตรงกับโค้ดจริง (`db/schema.sql` + `db/migrations/`)

## 1. หลัก

> Neon = Source of Truth ของธุรกิจ (commerce) · Convex = Intelligence + Auth + Realtime
> ฐานข้อมูลเดียว 3 เว็บ — ห้ามสร้าง DB แยก

## 2. ตารางหลัก (schema.sql)

| Layer | ตาราง |
|---|---|
| Identity | `users`, `sellers`, `shops`, `user_profiles`, `addresses`, `staff_profiles` |
| Catalog | `categories`, `products`, `product_variants`, `product_images`, `inventory` |
| Commerce | `carts`, `cart_items`, `wishlists`, `wishlist_items`, `orders`, `order_items` |
| Payments | `payments`, `payment_transactions`, `refunds` |
| Logistics | `shipments`, `tracking_events`, `returns`, `return_items` |
| Subscription | `subscriptions`, `velrepeat_orders` |
| Finance | `financial_ledger`, `seller_balances`, `seller_payouts`, `commissions`, `settlements` |
| Platform | `platform_settings`, `notifications`, `audit_logs`, `coupons`, `promotions` |

## 3. ความปลอดภัยของข้อมูล (constraints จริงใน SQL)

- เงิน: `NUMERIC(12,2)` + currency column — **ไม่มี float** (decision D4: ระบบใหม่ใช้ minor units)
- `CHECK`: stock/reserved ≥ 0 · price ≥ 0 (ผ่าน schema/backend) · status enums ทุกตาราง (orders/payments/commissions/returns…) · product_type ∈ 5 ค่า
- `UNIQUE`: order_number, orders.idempotency_key, shops.slug, users.email (unique index)
- FK + cascade: order_items→orders ON DELETE CASCADE; financial_ledger→orders ON DELETE **SET NULL** (ห้ามข้อมูลเงินหาย)
- Soft delete: product `status='archived'`; financial records **ห้าม hard delete**

## 4. Snapshot กลไก

- `order_items`: product_name/unit_price/commission_rate snapshot ตอนสั่ง — ราคา/commission เปลี่ยนทีหลัง ไม่กระทบ order เก่า
- `orders.address_snapshot` JSONB — ที่อยู่ freeze ตอน checkout
- `commissions.order_amount/commission_rate/commission_amount` — คำนวณ + แช่แข็งตอนสร้าง order

## 5. Indexes สำคัญ (มีใน schema/migrations)

users(email/convex_id) · shops(slug) · products(shop_id/status) · order_items(order_id/seller_id) · orders(customer_user_id, created_at) · payments(order_id) · financial_ledger(order/seller/type/created) · notifications(user_id) · inventory(product_id)

## 6. Migrations

`db/migrations/001…011` — **idempotent, backward-compatible** (CREATE/ADD IF NOT EXISTS — ไม่ DROP)
- ตรวจ: `bun run db:smoke` (ตารางครบ) · `bun run db:consistency` (data integrity + reconciliation — Phase 9)

## 7. Convex tables (App/Intelligence)

`src/convex/schema.ts` — `interests`, `businessEvents`, `rateLimits` (+ auth tables) — ดูไฟล์ schema จริง
