# Velnox — FINAL IMPLEMENTATION REPORT

> วันที่: 2026-08-15
> พื้นฐาน: `docs/IMPLEMENTATION_AUDIT_2026-08-15.md` (audit ครบ A–I)
> ตรวจหลังจบทุก phase: `bun convex dev --once` ✅ · `bun tsc -b --noEmit` ✅ 0 error · `bun test` ✅ 58 pass · `bun run build` ✅

---

## 1. สิ่งที่แก้ (ตามลำดับความเสี่ยง)

| # | ปัญหา (จาก audit) | การแก้ไข | สถานะ |
|---|---|---|---|
| H1 | `processDueSubscriptions` ไม่มี seller scope — seller A สร้างออเดอร์สินค้า seller B ได้ (authz + data integrity) | `getDueSubscriptions(db, date, sellerId?)` กรอง `sellers.seller_id` + action ส่ง `seller.id` + บังคับ seller ต้อง approved | ✅ |
| H2 | Seller `pending` ยัง publish/ขายสินค้าได้ (ข้าม approval gate) | `setProductStatusAction`: publish ต้อง `seller.status === 'approved'`; `openShop`: auto-approve เมื่อ `auto_approve_sellers` หรือ role owner/admin (ร้านของบริษัทใช้ได้ทันที) | ✅ |
| H3 | `confirmPayment` รับ amount ตามใจ ไม่ตรวจเทียบ order.total | `recordPayment` ตรวจ `amount === order.total` ใน transaction (throw ถ้าไม่ตรง) | ✅ |
| H4 | Checkout รับ `shippingFee` จาก client (ขัดหลัก "เงินคำนวณจาก backend") | checkout รับแค่ `shippingMethod` — fee คำนวณจาก `quoteShipping()` ฝั่ง server; `ShopCheckout` ส่ง `shippingMethod: "standard"` | ✅ |
| H5 | `sellerIncome` hard-code 3%/10% + นับ cancelled เป็น return | อ่าน `resolveRules()` (commission/threshold จาก platform_settings) + นับเฉพาะ `return_requested/returned` — ตัวเลขตรงกับ velcenter | ✅ |
| H6 | velcenter อ่าน legacy Convex (revenue/orders แสดง 0/ผิด) | เพิ่ม `marketOverviewAction`/`ordersListAction`/`updateOrderStatusAction` อ่าน Neon; `Center.tsx` ใช้ข้อมูลจริง (ดู §3) | ✅ |
| H8 | rate-limit ตารางโตไม่รู้จบ | ลบ expired windows ของ limiter เดิมทุกครั้งที่เปิด window ใหม่ | ✅ |
| H9 | `resolveRules` cache ค้าง (ค่าเก่าอยู่จน process ตาย) | อ่าน settings ครั้งเดียวต่อ call — ไม่มี cache ตาย | ✅ |
| H10 | เอกสารตัวเลข test เก่า (79/30) | อัปเดตเป็น 58 (ตรวจจริง) ใน README/GAP_ANALYSIS/CUSTOMER_MEMORY | ✅ |

## 2. ไฟล์ที่แก้

**Backend (Neon services):**
- `src/backend/orders.ts` — `sellerIncome` อ่าน platform_settings + นับ return จริง
- `src/backend/checkout.ts` — shipping fee คำนวณจาก `quoteShipping()` (รับ `shippingMethod`)
- `src/backend/validation.ts` — `checkoutInputSchema`: `shippingFee` → `shippingMethod` (enum standard/express)
- `src/backend/payments.ts` — `recordPayment` ตรวจ amount เทียบ order.total
- `src/backend/subscriptions.ts` — `getDueSubscriptions` รองรับ `sellerId` scope
- `src/backend/rules.ts` — `resolveRules` อ่านสด (ลบ WeakMap cache)

**Convex (API layer):**
- `src/convex/commerce.ts` — `openShop` auto-approve · `setProductStatusAction` approval gate · `processDueSubscriptions` seller scope + approved gate
- `src/convex/customer.ts` — `checkoutAction` รับ `shippingMethod` (ไม่รับ `shippingFee`)
- `src/convex/rateLimit.ts` — expired-window cleanup
- `src/convex/centerAdmin.ts` — เพิ่ม 3 actions ใหม่ (ดู §4)

**Frontend:**
- `src/pages/Center.tsx` — KPI + ออเดอร์ อ่านจาก Neon; status select จำกัดเฉพาะ transition ที่ถูกต้องตาม state machine
- `src/pages/ShopCheckout.tsx` — ส่ง `shippingMethod: "standard"`
- `src/lib/shop.ts` — `ORDER_STATUS_META`/`ORDER_STATUS_ICONS` เพิ่ม shipped/delivered (additive)

**Docs:**
- `docs/IMPLEMENTATION_AUDIT_2026-08-15.md` (สร้างใหม่) · `docs/FINAL_IMPLEMENTATION_REPORT.md` (ไฟล์นี้)
- README.md / docs/GAP_ANALYSIS.md / docs/CUSTOMER_MEMORY.md — อัปเดตจำนวน test

## 3. database migration ที่เพิ่ม

**ไม่มี — 0 migration ใหม่** งานทั้งหมดใช้คอลัมน์/ตารางที่มีอยู่แล้ว:
- `sellers.status` / `sellers.approved_at` (migration 009) — approval gate
- `orders.parent_order_id` / `orders.shipping_method` (base + 005) — center order list / shipping method
- `inventory.reorder_level`, `platform_settings`, `rateLimits` (Convex) — ใช้เดิมทั้งหมด
- ห้ามเพิ่มตารางซ้ำ / source of truth ซ้ำ (กฎเดิมยังยึด: Neon = commerce, Convex = intelligence/auth)

## 4. API/backend ที่เพิ่ม

| Action | ไฟล์ | Authorization | ใช้โดย |
|---|---|---|---|
| `centerAdmin.marketOverviewAction` | centerAdmin.ts | requireCenter (+ staff: VIEW_ORDERS) | Center ภาพรวม KPI (GMV, orders, products, customers, sellers จาก Neon) |
| `centerAdmin.ordersListAction` | centerAdmin.ts | requireCenter (+ staff: VIEW_ORDERS) | Center แท็บออเดอร์ (sub-orders + items + shop name) |
| `centerAdmin.updateOrderStatusAction` | centerAdmin.ts | requireCenter (+ staff: MANAGE_ORDERS) | Center เปลี่ยนสถานะออเดอร์ (ผ่าน state machine + audit + event) |

ฟังก์ชันเดิมที่เปลี่ยน signature: `getDueSubscriptions(db, date, sellerId?)`, `checkout({ shippingMethod })`, `checkoutAction({ shippingMethod })` — client ตัวเดียวที่เรียก (ShopCheckout) อัปเดตแล้ว

## 5. event ที่เพิ่ม

**ไม่มี event type ใหม่** — ใช้ event ที่มีอยู่: `OrderStatusChanged` (center admin), `ProductUpdated`, `VelRepeatOrderCreated/Skipped`, `PaymentConfirmed`, `InventoryChanged` ตามเดิม การแก้เป็นฝั่ง authorization/data-integrity ไม่ได้เพิ่ม vocabulary

## 6. customer intelligence ที่เพิ่ม

**ไม่มี logic ใหม่** — ระบบ CPNS (customerEvents → myMemory → recommend → due reminders) ทำงานเดิมครบ งานรอบนี้คือแก้ "ศูนย์กลางอ่านผิดแหล่ง" ให้ dashboard แสดงตัวเลขการค้าจริง (Neon) ส่วน goals/reorder intelligence ยังอ่าน Convex (บ้านจริงของมัน) — ไม่กระทบ personalization และ analytics ไม่ได้แตะ checkout/shopping flow

## 7. tests ที่เพิ่ม

**ไม่มี test ใหม่** — ชุดเดิม 58 ผ่านตลอดทุก phase (business rules, state machine, RBAC/security, validation, providers, velrepeat, customer-memory-core) การแก้รอบนี้เป็นการย้าย data source + gate ที่ไม่มี pure-logic ใหม่ทดสอบได้โดยไม่ต้อง integration DB

## 8. สิ่งที่ยังเหลือ (ต้องทำต่อ)

- **H7 — OTP API key hard-code ใน `src/convex/auth/emailOtp.ts`** (x-api-key อยู่ในซอร์ส) — ไฟล์นี้ README ประกาศ DO NOT MODIFY จึงยังไม่แตะ; ต้องย้ายเป็น env ผ่านฝั่ง platform/freebuff
- **VelRepeat auto-order ยังเป็น manual trigger** — ยังไม่มี Convex cron (`crons`) สำหรับ processDueSubscriptions + settlement
- **Payment/shipping จริง** — abstraction พร้อม (manual provider ใช้ได้) ยังไม่มี gateway/carrier + webhook
- **staff permission UI** — backend + permission catalog ครบ ยังไม่มีหน้าจัดการ permission รายคนใน velcenter
- **Coupon/promotion** — ตารางมีแล้ว ยังไม่เปิดใช้งาน
- **โฟลเดอร์ `velnox-mvp/` (สำเนาเก่าซ้ำทั้ง repo)** — แนะนำให้ลบ/ล้าง (ยังไม่ลบ กันพลาด)
- **Legacy dead code**: `src/convex/orders.ts` / `src/convex/subscriptions.ts` + ตาราง Convex `orders/orderItems/subscriptions/productViews` — ไม่มีหน้าไหนเรียกแล้ว (ตรวจแล้ว) เก็บไว้กันข้อมูลเก่าเสียหาย; แนะนำ deprecate + cleanup พร้อม migration

## 9. known limitations (MVP)

- Payment ทั้งหมดเป็นแบบ manual (COD/โอน/PromptPay รอ seller/center ยืนยัน) — ยังไม่มี e-wallet/card gateway อัตโนมัติ
- Shipping เป็น manual carrier + tracking ด้วยมือ
- Seller ต้องได้รับการอนุมัติจาก velcenter ก่อน publish (owner/admin เปิดร้าน auto-approve) — จงใจตาม spec
- ระบบเงินยังเป็น `NUMERIC(12,2)` (deliberate D4 — minor units เฉพาะระบบใหม่)
- `marketInsights`/recommendation เป็น deterministic rule-based (ตาม CPNS §18 — ไม่มี ML ใน MVP)

## 10. production risks

| ความเสี่ยง | ระดับ | หมายเหตุ / แนวทาง |
|---|---|---|
| OTP API key ในซอร์ส (H7) | กลาง | ย้ายเป็น env ก่อนเปิดจริง — ไฟล์ read-only ต้องจัดการผ่านแพลตฟอร์ม |
| ไม่มี cron — VelRepeat ต้องกด trigger เอง | กลาง | เพิ่ม `crons` ใน Convex ก่อนเปิดจริง |
| Payment manual — รอคนยืนยัน ยอดอาจค้าง | กลาง | ตั้ง SLA + notification + audit (มีแล้ว) |
| `sellerIncome`/`platformRevenueReport` ยังมี path คำนวณต่างกันบ้าง (finance.ts vs orders.ts) | ต่ำ | รอบนี้รวม commission/threshold แล้ว เหลือรายละเอียด shipping deduction = 0 |
| rate-limit cleanup ยังไม่มี cron ใหญ่ (cleanup เฉพาะ limiter ที่ถูกเรียก) | ต่ำ | เพิ่ม retention cron ได้ใน phase ถัดไป |
| Center ยังอ่าน `api.products.listAll` (Convex restocking) ในแท็บสินค้า/Intel | ต่ำ | เป็น deliberate — restocking list ของบริษัท ไม่ใช่ marketplace catalog |

---

### สรุป

- **critical issue ที่ระบุใน audit (H1–H6, H8, H9): แก้ครบแล้ว** — ตรวจผ่าน typecheck + tests + build ทุก phase
- **ยังไม่ถือว่า "เสร็จสมบูรณ์"** เนื่องจากยังมี H7 (OTP key), cron, payment/shipping gateway จริง ที่ต้องทำก่อน production launch ตามตาราง §8–§10
