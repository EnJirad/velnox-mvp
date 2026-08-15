# Velnox — GAP Analysis (Spec Phase 1 vs โค้ดปัจจุบัน)

> เปรียบเทียบ **PHASE 1 SYSTEM ARCHITECTURE SPECIFICATION** กับสถานะจริงของ repo (โค้ดที่ทำงานได้จริง)
> วันที่ประเมิน: 14 ส.ค. 2026
> สถานะ: `✅ มีแล้ว` / `🟡 มีบางส่วน` / `❌ ยังไม่มี`

---

## 1. โครงสร้างโปรเจกต์

| Spec (ข้อ 3, 42) | สถานะปัจจุบัน | สถานะ | หมายเหตุ |
|---|---|---|---|
| monorepo: `velshop/` `velseller/` `velcenter/` `blackend/` `packages/` `docs/` | โครงสร้างเดียว: Vite multi-entry (`velshop.html`/`velseller.html`/`velcenter.html`) + `src/backend/` + `src/convex/` + `db/` + `docs/` | 🟡 | **Deliberate decision** — เอกสารใน `docs/ARCHITECTURE.md` §2. โค้ดแชร์กัน 1 ชุด deploy แยก 3 เว็บ ประหยัดกว่ามาก และ backend ไม่ต้องเป็น HTTP server แยก (Convex เป็น backend) |
| `packages/shared`, `packages/types`, `packages/validation`, `packages/constants` | `src/lib/` + `src/backend/types.ts` (types + helpers กลาง) | 🟡 | แยก folder เดียวกันได้ถ้าต้องการจริง แต่ขนาดตอนนี้ยังไม่คุ้ม |
| `convex/schema.ts`, `convex/auth.ts`, `convex.config.ts`, `_generated/` | `src/convex/schema.ts`, `src/convex/auth.ts`, `convex.json` + codegen | ✅ | |
| `docs/` | `docs/ARCHITECTURE.md`, `docs/GAP_ANALYSIS.md`, `docs/PHASE_PLAN.md` (ไฟล์นี้) | ✅ | ใหม่ในรอบนี้ |

---

## 2. ฐานข้อมูล (ข้อ 40, 41, 58, 59)

| Spec | สถานะปัจจุบัน | สถานะ | หมายเหตุ |
|---|---|---|---|
| Convex เป็น primary DB + Neon Commerce Core | **Neon = Commerce Core (14 ตาราง)**, Convex = auth + intelligence + realtime + legacy storefront | ✅ | ตาม `docs/ARCHITECTURE.md` — จัดสรรหน้าที่ชัดเจน (ดีกว่า spec ด้วยซ้ำ: เงิน/สินค้า/ออเดอร์อยู่ใน relational DB) |
| users / sellers / shops / products / product_images / inventory / addresses / orders / order_items / payments / refunds / commissions / settlements / subscriptions | ครบทั้ง 14 ใน `db/schema.sql` | ✅ | Neon schema จริงพร้อม index/trigger/sequence |
| categories (hierarchy) | `products.category` เป็น TEXT enum 6 หมวด | ❌ | ต้องสร้างตาราง `categories` (parent/child, image, sort, active) |
| productVariants (SKU/price/stock/image ต่อ variant) | ไม่มี | ❌ | Phase 2 |
| carts / cartItems | ไม่มี (checkout สร้าง order ตรงได้) | ❌ | Phase 5 — ต้องมี cart ก่อน checkout หลายร้าน |
| wishlists | มี `interests`/`productViews` ใน Convex (VelRepeat) | 🟡 | เป็น "สนใจ" เพื่อแนะนำสินค้า ยังไม่ใช่ wishlist เก็บรายการ |
| reviews | ไม่มี | ❌ | Phase 5/6 |
| shipments / trackingEvents | `orders.tracking_number` + `shipping_status` (TEXT) | 🟡 | ยังไม่มี abstraction ShippingProvider / event timeline |
| notifications | ไม่มี | ❌ | Phase 10 |
| platformSettings | ไม่มี — commission 3% เป็น default ที่ `shops.commission_rate`, 10% ที่ `sellers.refund_policy_limit` | 🟡 | ต้องย้ายไปตาราง `platform_settings` (ข้อ 23/25/34/35) |
| sellerPayouts / sellerBalances | มี `settlements` (period summary) | 🟡 | ยังไม่มี ledger รายการย่อย/ยอดคงค้างต่อ seller |
| auditLogs | ไม่มี | ❌ | ข้อ 47 — ต้องมีตาราง audit_logs |
| **เงินเป็น integer minor units (satang)** | `NUMERIC(12,2)` | 🟡 | ตรงหลักการ "ไม่คำนวณเงินด้วย float" แต่ไม่ใช่ minor units ตามตัวอักษร — เลือก NUMERIC(12,2) เป็น deliberate decision (ดู ARCHITECTURE.md §5.4) |
| stock ตรวจที่ backend | `inventory.quantity` + `reserved_quantity` + validate ใน `orders.ts` | ✅ | |
| order snapshot | `order_items` snapshot (ชื่อ/หน่วย/ราคา/commission) + `orders.address_snapshot` JSONB | ✅ | ยังไม่ snapshot variant/discount ต่อรายการ → เสริมใน Phase 2 |
| ห้ามข้อมูลหลักซ้ำสองระบบ | **`subscriptions` ซ้ำกันทั้ง Neon และ Convex** (Convex ตัวเก่าจาก storefront เดิม) | 🟡 | ต้องทำ data migration: Convex subscriptions → Neon subscriptions และให้ Convex อ่านจาก Neon (Phase 10 VelRepeat) |

---

## 3. Backend / Business Logic (ข้อ 39, 43, 44, 55, 56, 57, 64)

| Spec | สถานะปัจจุบัน | สถานะ | หมายเหตุ |
|---|---|---|---|
| Backend เป็น source of truth (order/payment/inventory/pricing/commission/return) | `src/backend/*` (TS ทำงานบน Convex runtime) + Convex actions/mutations | ✅ | Frontend เรียกผ่าน Convex อย่างเดียว ไม่แตะ Neon ตรง |
| Shipping abstraction (`ShippingProvider`) | ไม่มี — `shipping_method`/`tracking_number` เป็น TEXT | ❌ | Phase 8 |
| Payment abstraction (`PaymentProvider`) | `payments.method` enum (cod/transfer/card/promptpay/wallet) + `external_ref` | 🟡 | ยังไม่มี webhook/verify/refund flow จริง — Phase 9 |
| Financial ledger | มี `commissions` (ต่อรายการ) + `settlements` (ต่อรอบ) | 🟡 | ยังไม่มี journal แบบ audit ทุกรายการ — Phase 10 |
| Commission 3% / return 10% ต้องไม่ hard-code | ค่าเป็น default ในตาราง (ต่อ shop / ต่อ seller) แต่ยังไม่มี platform_settings | 🟡 | Phase 7 — ย้ายเป็น config กลาง |
| Error handling / validation ทุก function | มี inline validation + error กลับเป็นภาษาไทย | 🟡 | ยังไม่มี zod schema กลาง (มี zod ใน deps) — Phase 3 |
| Audit ทุก action สำคัญ | ไม่มี | ❌ | Phase 10 |
| Notification (in-app/email) | Convex Auth ส่ง OTP email ได้ | 🟡 | ยังไม่มีระบบ notification ของธุรกิจ (ออเดอร์/ตีกลับ/ยอด) |

---

## 4. Auth / RBAC (ข้อ 36, 37, 38, 4.1.1)

| Spec | สถานะปัจจุบัน | สถานะ | หมายเหตุ |
|---|---|---|---|
| Register / Login / Logout / Guest | Convex Auth: email OTP + guest | ✅ | |
| Password recovery / เปลี่ยนอีเมล / profile | OTP-based (ไม่ต้อง password) — เปลี่ยนชื่อ/รูปได้ | 🟡 | เปลี่ยนอีเมล/เบอร์ตาม security rules ยังไม่มี — Phase 4 |
| RBAC: CUSTOMER SELLER STAFF ADMIN SUPER_ADMIN | roles: `customer seller staff admin owner` | 🟡 | ใช้ `owner` แทน `super_admin` (deliberate — ตรงบริบทบริษัทเดียว) — เช็คในทุก mutation ผ่าน `requireSeller()` / role check | ✅ | |
| กันข้ามเจ้าของข้อมูล (Seller A แก้ Product B ไม่ได้) | ตรวจ ownership ใน backend ทุกจุด | ✅ | |
| velcenter เฉพาะผู้มีสิทธิ์ + แยกสิทธิ์ตามยศ/ฝ่าย | role + department (marketing/sales/operations/finance/general) | ✅ | |

---

## 5. VelShop (ข้อ 8–16, 54)

| Spec | สถานะปัจจุบัน | สถานะ | หมายเหตุ |
|---|---|---|---|
| Browse/search/filter/sort/detail/view images | มีหน้า storefront ดูสินค้า (Convex legacy + Neon registry) | 🟡 | search/filter ยังเรียบง่าย — Phase 5 |
| Category hierarchy | ยังเป็น enum | ❌ | Phase 5 |
| Store page (logo/rating/products/follow) | มี `shops` table + หน้า MyShop ฝั่ง seller | 🟡 | ฝั่ง customer ยังไม่มี storefront ต่อ seller + rating/follow — Phase 5 |
| Cart หลายสินค้า/หลายร้าน/variant/stock validation | ไม่มี cart | ❌ | Phase 5 |
| Checkout validate อีกครั้งที่ backend | สร้าง order ผ่าน backend มี idempotency + stock check | 🟡 | ต้องต่อ cart → split ตาม seller → checkout flow — Phase 5 |
| Multi-seller order (parent + per-seller) | `order_items` มี `seller_id`/`shop_id` ต่อรายการ — รองรับแยกได้ | 🟡 | ยังไม่มี parent order + สถานะต่อ seller order — Phase 5 |
| Order lifecycle เต็ม (PENDING_PAYMENT…COMPLETED / CANCELLED/REFUNDED/RETURN_*) | status: pending/confirmed/shipped/delivered/completed/cancelled + payment_status + shipping_status | 🟡 | ขยาย enum + tracking timeline — Phase 5/8 |
| Return/Refund lifecycle | `refunds` (requested/approved/processed/rejected) + policy 10% | 🟡 | ขยายเป็น RETURN_REQUESTED → REFUNDED พร้อม evidence images — Phase 8 |
| VelRepeat (frequency/qty/next date/status) | `subscriptions` (Neon + Convex) + หน้า "สั่งรายเดือน" | 🟡 | มีรอบ 30/60/90 วัน — ต้องรวม source of truth เป็น Neon เดียว + cron สั่งอัตโนมัติ — Phase 10 |
| Address + GPS (3 วิธี: ตำแหน่งปัจจุบัน/เลือกแผนที่/ลาก marker) | `addresses` ไม่มี lat/long | ❌ | Phase 5 — ต้องเพิ่มคอลัมน์ GPS + map picker (`VITE_MAP_API_KEY`) |
| ห้ามบันทึก shipping address ไร้ GPS | ยังไม่บังคับ | ❌ | Phase 5 |

---

## 6. VelSeller (ข้อ 17–27)

| Spec | สถานะปัจจุบัน | สถานะ | หมายเหตุ |
|---|---|---|---|
| Dashboard (ยอดขาย/ออเดอร์/สินค้า/รายได้/commission/ยอดรับจริง) | มีครบ + เป้าหมาย + Smart Reorder | ✅ | |
| Product CRUD + publish/unpublish + stock + price + รูป + หมวด | มีครบ (Cloudinary upload สูงสุด 10 รูป) | ✅ | หมวดยังเป็น enum — รอ categories |
| Product type (ONE_TIME/VELREPEAT/SERVICE/DIGITAL/PHYSICAL) | ไม่มี | ❌ | Phase 6 |
| Product variants | ไม่มี | ❌ | Phase 6 |
| Order management (accept/reject/pack/tracking/ship/return) | เห็นออเดอร์ร้านตัวเอง + เปลี่ยนสถานะ + สร้างรอบ VelRepeat | 🟡 | ขยายสถานะเต็ม + tracking — Phase 6 |
| Seller revenue: Gross − Commission − Shipping − Return = Net | มี ยอดขาย − ค่าธรรมเนียม 3% − ค่าตีกลับเกิน 10% | ✅ | |
| Return rate + penalty >10% | คำนวณอัตรา + flag เตือนเมื่อเกิน | 🟡 | ต้องหักส่วนเกินอัตโนมัติใน backend (ตอนนี้ flag) — Phase 10 |
| Store settings (logo/banner/นโยบาย/เวลาทำการ) | shops มี name/slug/desc/image/phone/address/announcement | 🟡 | เสริม banner/policies/operating hours — Phase 6 |
| Seller location GPS | `shops.address` TEXT ไม่มี lat/long | ❌ | Phase 6 |

---

## 7. VelCenter (ข้อ 28–35, 47)

| Spec | สถานะปัจจุบัน | สถานะ | หมายเหตุ |
|---|---|---|---|
| Dashboard GMV/orders/sellers/customers/products/commission/refunds/net | KPI ภาพรวม + ยอดขายทุกตลาด + ออเดอร์ทั้งหมด + Intelligence | 🟡 | ขยาย metric ตาม spec — Phase 7 |
| Seller management (approve/reject/suspend/detail) | มีบทบาท + เปิดร้าน self-serve | 🟡 | ยังไม่มี approve/suspend flow ฝั่ง admin — Phase 7 |
| Product moderation | ดูสินค้า registry ได้ | 🟡 | ยังไม่มี approve/hide — Phase 7 |
| Order management ทุกระบบ | มีออเดอร์ทุกตลาด + เปลี่ยนสถานะ (admin/owner) | ✅ | |
| Financial management (GMV/commission/shipping/seller revenue/refunds/penalty/company revenue/payouts) | มี commission/settlement เริ่มต้น | 🟡 | ต้องมีรายงานการเงินครบ + ledger — Phase 10 |
| Platform settings (commission/shipping %/return threshold/auto-approve/currency/tax) | ยังไม่มี | ❌ | Phase 7 |
| Audit log | ไม่มี | ❌ | Phase 10 |
| ฝ่าย (department) จำกัดการเข้าถึง module | มี department ใน users | ✅ | |

---

## 8. อื่น ๆ (ข้อ 45–54, 62–63)

| Spec | สถานะปัจจุบัน | สถานะ | หมายเหตุ |
|---|---|---|---|
| File upload (ไม่เก็บ binary ใน DB) | Cloudinary signed upload → `product_images` เก็บ URL/key เท่านั้น | ✅ | |
| Map system | ไม่มี | ❌ | Phase 5 |
| Env แยก dev/staging/prod | `.env.local` + Keys/API keys + docs | 🟡 | สร้าง deployment แยกได้ใน Convex — Phase 11/12 |
| Secret ไม่เข้า git | `.gitignore` ครอบ `.env*`, `_generated` | ✅ | |
| Responsive desktop/tablet/mobile | shadcn/ui + Tailwind responsive + mobile tab bar + การ์ดแบบแอปทุกหน้า | ✅ | |
| Tests | vitest: business rules · state machine · IDOR/security · providers · velrepeat · **customer memory core** — 58 ผ่าน (ตรวจจริง 2026-08-15) | ✅ | `src/lib/customer-memory-core.test.ts` + `tests/*` |
| CI/CD | docs Vercel ครบ (build command inject Convex URL + rewrite 3 เว็บ) | 🟡 | ยังไม่มี test ใน pipeline — Phase 11/12 |

---

## 9. Customer Memory & Personal Intelligence (CPNS) — สถานะปัจจุบัน ✅

> เอกสารฉบับเต็ม: **`docs/CUSTOMER_MEMORY.md`** · วิสัยทัศน์: **`docs/Velnox-CPNS.md`**

| Spec | สถานะปัจจุบัน | สถานะ | หมายเหตุ |
|---|---|---|---|
| ทุก Interaction คือข้อมูล — event vocabulary ครบ (spec §3) | `customerEvents` (Convex) + 16 event types (PRODUCT_VIEW…RECOMMENDATION_CLICK) | ✅ | `src/convex/memoryEvents.ts` |
| ของใคร ของมัน — data isolation ต่อคน (spec §4) | ทุก read ส่วนบุคคล scoped ด้วย userId จาก session + index ครอบ | ✅ | `myMemory`/`recommendForCustomer` เริ่มจาก `getUserIdentity()` |
| Guest → account identity merge (spec §5) | `mergeAnonymousToUser` + `<IdentityMerge />` — idempotent + dedup | ✅ | ใหม่ใน Phase 14 |
| Interest vs Purchase Intent แยกกัน (spec §9–10) | `interestScore` (weight×decay) แยกจาก `estimateIntent` (low/medium/high) | ✅ | `src/lib/customer-memory-core.ts` |
| Time decay — RECENT > OLD (spec §11) | exponential half-life ต่อ event type | ✅ | มี unit test ครึ่งชีวิต |
| Personalization + cold start (spec §13–14) | ShopHome: แนะนำสำหรับคุณ (พร้อมเหตุผล) / หมวดที่สนใจ / ซื้ออีกครั้ง / สินค้ายอดนิยมสำหรับแขก | ✅ | `src/pages/ShopHome.tsx` |
| Smart Reorder + Proactive (spec §16) | `dueReorderReminders` — “ถึงเวลาสั่งซื้อซ้ำแล้ว” เรียนรอบจากออเดอร์จริง | ✅ | |
| VelRepeat lifecycle (spec §17) | start/cancel events + subscriptions (pause/resume/cancel/แก้ไขรอบ) | ✅ | `VELREPEAT_CANCEL` ใหม่ใน Phase 14 |
| Privacy: ไม่เปิด raw behavior ใน admin UI | velcenter เห็น aggregate เท่านั้น (`marketInsights`) | ✅ | |
| Test ระบบ memory (spec §51) | weights/decay/intent/merge — ครอบในชุด 58 ผ่านรวม | ✅ | |

---

## สรุปโดยรวม

| กลุ่ม | ✅ มีแล้ว | 🟡 มีบางส่วน | ❌ ยังไม่มี |
|---|---|---|---|
| โครงสร้าง/สถาปัตยกรรม | 3 | 3 | 0 |
| ฐานข้อมูล | 6 | 5 | 5 |
| Backend/Business | 1 | 5 | 3 |
| Auth/RBAC | 4 | 2 | 0 |
| VelShop | 0 | 7 | 6 |
| VelSeller | 3 | 5 | 3 |
| VelCenter | 2 | 4 | 3 |
| อื่น ๆ | 3 | 2 | 2 |

**จุดแข็งที่มีอยู่แล้ว (ไม่ต้องทำใหม่):** Neon Commerce Core 14 ตาราง, commission/return policy ใน DB, RBAC + department, order snapshot + idempotency, Cloudinary upload, VelRepeat พื้นฐาน, 3 เว็บ deploy แยกจาก repo เดียว

**งานหลักที่รออยู่:** categories/variants, cart + checkout multi-seller, GPS + map, สถานะ order/return เต็ม, platform settings, ledger + audit, notification, VelRepeat รวม source of truth + cron, tests

> ดูแผนการทำทั้งหมดใน **`docs/PHASE_PLAN.md`**
