# Velnox Architecture v3 — Migration Plan

> Neon PostgreSQL = **Commerce Core** (Source of Truth ของธุรกิจ)
> Convex = **Intelligence + Realtime** (สมองของ Velnox)
>
> ห้ามใช้ Neon และ Convex เป็น Source of Truth ของข้อมูลชุดเดียวกันพร้อมกัน

---

## 1. สถานะปัจจุบัน (วิเคราะห์จาก repo)

### Convex Schema เดิม (`src/convex/schema.ts`)
| ตาราง (Convex) | เนื้อหา | ปลายทาง v3 |
|---|---|---|
| `users` (+ authTables) | Auth + role/department | **Neon** (business attributes) + Convex (auth session) |
| `products` | สินค้า + stock + price + reorder | **Neon** (แยก `products` / `inventory`) |
| `purchases` | ประวัติสั่งซื้อของเจ้าของ (Smart Reorder) | **Neon** (`orders`/`order_items`) + Convex (behavior) |
| `orders` / `orderItems` | ออเดอร์ลูกค้า + snapshot | **Neon** |
| `subscriptions` | VelRepeat (สั่งรายเดือน) | **Neon** (`subscriptions`) + Convex (intelligence) |
| `productViews` | พฤติกรรมลูกค้า (คลิก/สนใจ) | **Convex อยู่ต่อ** (Intelligence) |
| `goals` | เป้าหมายธุรกิจ (dashboard เจ้าของ) | **Convex อยู่ต่อ** (dashboard state) |
| `storeSettings` | ตั้งค่าร้าน | **Neon** (`shops`) |

### จุดที่ต้องแก้ตาม v3
1. **Product ownership**: `User -> Product` ต้องกลายเป็น `User -> Merchant -> Shop -> Product -> Inventory`
2. **Order**: ต้องมี Payment / Shipping / Address Snapshot / OrderItem (product+shop+merchant+price snapshot)
3. **Inventory**: แยกออกจาก Product (`quantity`, `reservedQuantity`, `reorderLevel`, `warehouse`)
4. **Commission / Settlement**: เพิ่มระบบค่าคอมมิชชัน 3% + การตีกลับ (policy สูงสุด 10%)
5. **Backend layer**: Frontend ต้องไม่แตะ Neon/Convex ตรง ๆ — ผ่าน Velnox Backend
6. **Event bridge**: Neon -> Convex (realtime แจ้งเตือน velshop/velseller/velcenter)

---

## 2. สถาปัตยกรรมเป้าหมาย

```
                    VELNOX
                       |
        +--------------+--------------+
        |              |              |
     VelShop       VelSeller      VelCenter
        |              |              |
        +--------------+--------------+
                       |
                Velnox Backend
              (Convex node actions
               = src/convex/commerce.ts)
                       |
              +--------+--------+
              |                 |
              v                 v
        Neon PostgreSQL       Convex
        Commerce Core      Intelligence
```

**หมายเหตุการ implement ใน repo นี้:** เราไม่มี server แยก (deploy เป็น static + Convex) ดังนั้น **Velnox Backend = Convex Node Actions** (`"use node"`) ที่เรียก Business Logic ใน `src/backend/*` ซึ่งเป็นตัวเดียวที่แตะ Neon ผ่าน `@neondatabase/serverless`

---

## 3. Neon Schema (14 ตาราง)

ไฟล์: `db/schema.sql` — ใช้ `CREATE TABLE IF NOT EXISTS` (รันซ้ำได้)

| # | ตาราง | หน้าที่ |
|---|---|---|
| 1 | `users` | ลูกค้า/พ่อค้า/พนักงาน — business attributes (auth อยู่ Convex) |
| 2 | `merchants` | เจ้าของร้าน (User -> Merchant) |
| 3 | `shops` | ร้านค้า (Merchant -> Shop, commission_rate ค่าเริ่มต้น 0.03) |
| 4 | `products` | สินค้า (Shop -> Product) — ราคาปัจจุบันเท่านั้น |
| 5 | `product_images` | รูปสินค้า |
| 6 | `inventory` | stock แยก entity (quantity/reserved/reorderLevel/warehouse) |
| 7 | `addresses` | ที่อยู่ลูกค้า (snapshot ตอนสั่งซื้อเข้า `orders.address_snapshot`) |
| 8 | `orders` | ออเดอร์ + payment/shipping status + address snapshot |
| 9 | `order_items` | snapshot สินค้า+ราคาตอนซื้อ (product/shop/merchant/unitPrice/subtotal) |
| 10 | `payments` | การชำระเงิน (method/status/ref) |
| 11 | `refunds` | การคืนเงิน / ตีกลับ |
| 12 | `commissions` | ค่าคอมมิชชันต่อรายการ (rate 3% เริ่มต้น, policy ตีกลับ ≤10%) |
| 13 | `settlements` | สรุปจ่ายเงินพ่อค้ารายงวด |
| 14 | `subscriptions` | VelRepeat (frequency, price snapshot, next_order_date) |

**Rule ที่ฝังใน schema/service:**
- ราคา/ยอดเงินทั้งหมด `NUMERIC(12,2)` — ห้ามคำนวณ order เก่าด้วยราคาปัจจุบัน (snapshot ไว้ใน `order_items`)
- `updated_at` auto-update ด้วย trigger
- `status` ทั้งหมดเป็น `TEXT + CHECK` (ยืดหยุ่นกว่า Postgres enum ตอน migrate)

---

## 4. Data Ownership Map

| ข้อมูล | เจ้าของ (Source of Truth) |
|---|---|
| users / merchants / shops / products / inventory / addresses / orders / payments / refunds / commissions / settlements / subscriptions | **Neon** |
| customer_views / recommendations / customer_behavior / notifications / realtime_state / AI_state / goals / storeSettings | **Convex** |
| auth session / role / department | **Convex** (auth) → ข้อมูล role สะท้อนไป Neon `users` |

**กลไกเชื่อม:** หลัง login/signup สำเร็จ → `syncUser` (Neon upsert) เพื่อให้ Neon เป็นที่อ้างอิง business attributes ส่วน Convex ยังเป็น auth source

---

## 5. โครงสร้างโค้ดใหม่

```
db/
  schema.sql          # Neon schema (14 ตาราง + indexes + trigger)
  migrate.ts          # runner: bun run db:migrate (ใช้ DATABASE_URL)
src/backend/          # Velnox Backend layer (Business Logic ฝั่ง server)
  db.ts               # Neon client factory (getDb)
  types.ts            # TS types ของ 14 entities
  merchants.ts        # merchant + shop
  products.ts         # product + product_images
  inventory.ts        # reserve / deduct / release / reorderLevel
  orders.ts           # createOrder (transaction: stock+order+items+payment+commission)
  payments.ts         # recordPayment / refund
  subscriptions.ts    # VelRepeat subscriptions + nextOrderDate
src/convex/commerce.ts # "use node" — Convex node actions เรียก src/backend/*
                      # = Velnox Backend ที่ frontend เรียก (velshop/velseller/velcenter)
```

**Business Logic อยู่ฝั่ง server เท่านั้น:** สร้าง order, จอง/ตัด stock, คำนวณ commission, settle — frontend ส่ง intent ไม่ส่งการคำนวณ

---

## 6. ขั้นตอน Migration (ตามลำดับข้อ 12 ของ v3)

### Phase 0 — พื้นฐาน (ทำในรอบนี้)
- [x] อ่าน repo + วิเคราะห์ schema/functions/auth/3 เว็บ
- [x] ติดตั้ง `@neondatabase/serverless`
- [x] เขียน Migration Plan นี้
- [ ] `db/schema.sql` + `db/migrate.ts` (script `bun run db:migrate`)
- [ ] `src/backend/*` — Commerce Core layer
- [ ] `src/convex/commerce.ts` — Convex node actions bridge
- [ ] ขอ `DATABASE_URL` จากผู้ใช้ (ตั้งค่าใน Keys/API keys) แล้วรัน migrate จริง

### Phase 1 — วางฐานข้อมูล
1. ผู้ใช้ตั้ง `DATABASE_URL` → รัน `bun run db:migrate`
2. รัน `bun run db:verify` (script ตรวจตารางครบ 14 + indexes)

### Phase 2 — Users/Merchant/Shop
1. `syncUser` หลัง auth สำเร็จ (ทั้ง 3 เว็บ)
2. สร้าง `merchants` + `shops` จาก velseller (หน้าเปิดร้าน) — ข้อมูลใหม่เขียนเข้า Neon
3. velshop อ่านสินค้าจาก Neon (fallback ไป Convex ถ้ายังไม่มี DATABASE_URL)

### Phase 3 — Products/Inventory
1. ย้าย create/update product ไป Neon (`products` + `product_images` + `inventory`)
2. Smart Reorder อ่าน `inventory.reorderLevel` + ประวัติจาก Neon orders
3. Frontend velseller เรียก action ใหม่ (ตัด Convex products ทีละฟีเจอร์)

### Phase 4 — Orders/Payments/Commission (หัวใจ)
1. `createOrder` → Neon transaction: ตรวจ stock → จอง → สร้าง order+items → payment record → commission 3%
2. ยืนยัน/ชำระเงิน → deduct stock จริง + ปล่อย reserved
3. ยกเลิก/ตีกลับ → release stock + สร้าง refund + commission ถูกหัก (policy ตีกลับ >10% จ่ายแค่ 10%)
4. velseller รายได้/ยอดขายอ่านจาก Neon `orders` + `commissions`

### Phase 5 — VelRepeat + Realtime
1. `subscriptions` อยู่ Neon; cron (Convex) ตรวจ `next_order_date` → สร้าง order ผ่าน Commerce Core
2. Convex เก็บ behavior (`productViews` อยู่แล้ว) + คำนวณ purchase cycle → แนะนำ + แจ้งเตือน
3. Event bridge: Neon เปลี่ยนสถานะ (order/payment/inventory) → Convex mutation บันทึก `realtime_state` → frontend subscribe (เพิ่ม `realtime_events` table ใน Convex ภายหลัง)

### Phase 6 — Cleanup
- ลบตาราง Convex ที่ย้ายไป Neon แล้ว (ทีละตัว หลัง E2E ผ่าน)
- ลบ `products.currentStock` (ย้ายไป inventory) — ระวังโค้ดเก่าที่อ่าน

---

## 7. สิ่งที่ Convex ยังรับผิดชอบ (Intelligence)
- `productViews` (behavior) + ระบบ recommend / purchase cycle
- `goals` (dashboard เจ้าของ), `storeSettings` (ชั่วคราวจนกว่าจะย้าย)
- realtime state + notifications + scheduled jobs (VelRepeat cron)
- **Auth** ยังอยู่ Convex Auth (เก็บ role/department) — Neon อ่าน role ผ่าน `syncUser`

---

## 8. ความเสี่ยง / ข้อควรระวัง
1. **Frontend เดิมอ่าน Convex ตรง ๆ** — ต้อง migrate ทีละฟีเจอร์ อย่าตัดทั้งระบบใน PR เดียว (ตามข้อ 12: "ไม่ Rewrite ทั้งระบบ")
2. **Convex node actions ช้ากว่า** (cold start) — ใช้เฉพาะที่ต้องแตะ Neon จริง (order/payment), ข้อมูลอ่านบ่อย cache ไว้ใน Convex
3. **เลขเงิน** — ใช้ `NUMERIC(12,2)` ใน Neon, `number` ใน Convex (ระวัง float ตอนคำนวณ commission → ปัด 2 ตำแหน่งฝั่ง server)
4. **`DATABASE_URL` ไม่ควรอยู่ใน bundle ฝั่ง client** — อยู่แค่ Convex node actions + script migrate เท่านั้น
5. **Idempotency ของ order** — กันสั่งซื้อซ้ำ (clientOrderId / idempotency key) เพราะ action อาจ retry
