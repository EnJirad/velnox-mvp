# VELNOX — Orders

Version: 1.0 · Phase 10 — ตรงกับโค้ดจริง

## 1. Flow

Customer (cart) → `checkoutAction` (`src/backend/checkout.ts`) → order + order_items + commissions + payment (1 transaction)

- **Multi-seller**: cart หลายร้าน → แยก per-shop order (แต่ละ order = สินค้าของร้านเดียว) — ตรวจ `s.seller_id` ต่อ shop
- **ราคา**: backend โหลด price/stock จาก DB ใหม่ (FOR UPDATE) — client ส่งแค่ productId+quantity+addressId; ราคาเปลี่ยน → `PRICE_CHANGED`
- **Stock**: reserve ใน transaction; cancel → คืน stock
- **Idempotency**: `idempotency_key` unique ต่อ customer+cart — กดซ้ำไม่สร้าง order ซ้ำ

## 2. State machine (`src/backend/orders.ts` — `canTransitionOrderStatus`)

```
pending → confirmed → shipped → delivered → completed
pending/confirmed → cancelled
shipped/delivered/completed → cancelled ❌ (ต้องใช้ return/refund)
ทุกสถานะ → สถานะเดิม (no-op allowed)
```
- เปลี่ยนสถานะได้เฉพาะผ่าน backend (`updateOrderStatus`) — seller ผ่าน `setOrderStatus`, center ผ่าน admin; customer ผ่าน `cancelOrderAction` (ก่อน ship เท่านั้น)
- Tests: `tests/orderStateMachine.test.ts`

## 3. Order fields (snapshot)

order_number (unique `ORD-` + seq) · customer · status/payment_status/shipping_status · subtotal/discount/shipping_fee/total/currency · address_snapshot (JSONB freeze) · idempotency_key · timestamps

## 4. ทัศนวิสัย (privacy)

| ใคร | เห็น |
|---|---|
| Customer | order ของตัวเอง (customer_user_id) |
| Seller | เฉพาะ order ที่มี order_items.seller_id = ตัวเอง |
| Center | ทั้งหมด (requirePermission) |

## 5. Tracking

`shipments` + `tracking_events` — carrier/tracking_number/status/events; seller กรอก tracking (ManualShippingProvider — Phase 9.5 carrier จริง); customer ดู timeline ผ่าน `/shop/orders/:id/tracking`
