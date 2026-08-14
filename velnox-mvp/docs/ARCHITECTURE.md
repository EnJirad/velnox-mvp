# Velnox — Phase 1: Architecture (ฉบับใช้งานจริง)

> เวอร์ชัน 1.0 · Phase: Architecture · วันที่: 2026-08-14
> อ้างอิง: `VELNOX_PHASE1_SPEC` (System Architecture Specification v1.0) · `ARCHITECTURE_V3_MIGRATION.md` (สถาปัตยกรรมเดิม)
> เอกสารนี้คือ **Deliverable ของ Phase 1** — อนุมัติสถาปัตยกรรมแล้วจึงเริ่ม Phase 2 ตามข้อ 64/66 ของ spec

---

## 1. สรุปผู้บริหาร

Spec Phase 1 ต้องการสถาปัตยกรรม 3 Frontend + 1 Backend (Blackend) + Shared packages + DB กลาง

**สถานะปัจจุบันของ repo (`velnox-mvp`):** ระบบหลักทำงานแล้ว 70% ของ spec — 3 เว็บแยก deploy ได้จริง (multi-page Vite), Convex backend + Neon Commerce Core, auth OTP, ตะกร้า/สั่งซื้อ/ออเดอร์ snapshot, VelRepeat subscriptions, ระบบรายได้พ่อค้า (ค่าธรรมเนียม 3% + นโยบายตีกลับ 10%), velcenter RBAC แยกยศ

**สิ่งที่ Phase 1 นี้ตัดสินใจ:** เก็บสถาปัตยกรรม v3 ที่ทำงานอยู่เป็นฐาน (Neon = Commerce Core, Convex = App DB + Intelligence) แล้วเพิ่มส่วนที่ spec ต้องการเข้าไปแบบเป็น Phase — **ไม่ rewrite ระบบที่ทำงานได้** (ตามข้อ 64: ห้ามสร้างระบบทั้งหมดในครั้งเดียว)

**ส่วนที่ยังขาดจาก spec (ต้องสร้างต่อใน Phase 2+):** GPS บน address, categories แบบ hierarchy, product variants, ระบบ returns เต็มรูปแบบ, financial ledger, audit log, notifications, platform settings, seller moderation, product moderation, shipping/payment provider abstraction, monorepo split

---

## 2. สถาปัตยกรรมเป้าหมาย

```
                    ┌─────────────────────┐
                    │      VelShop        │   → Vercel (velshop.vercel.app)
                    │     Customer App    │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │                     │
                    │      BLACKEND       │   = Convex (actions/mutations)
                    │  Business Logic     │     + src/backend/* (Neon data access)
                    │  Auth / Authz       │     + Provider abstractions (Shipping/Payment)
                    │  Order / Payment    │
                    │  Commission / Ledger│
                    └───────┬─────┬───────┘
                            │     │
                ┌───────────┘     └────────────┐
        ┌───────▼────────┐             ┌───────▼────────┐
        │   VelSeller    │             │   VelCenter    │
        │  → Vercel      │             │  → Vercel      │
        └────────────────┘             └────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
  Neon PostgreSQL      Convex Database      Cloudinary
  Commerce Core        App DB + Realtime     รูปสินค้า (binary ไม่อยู่ใน DB)
  Source of Truth      Intelligence + Auth
```

| ชั้น | เทคโนโลยี | บทบาท |
|---|---|---|
| Frontend 3 เว็บ | Vite + React (3 entries) | UI ล้วน — ไม่แตะ DB ตรง (ข้อ 43) |
| **Blackend** | Convex actions/mutations + `src/backend/*` | Business Logic ทั้งหมด = source of truth (ข้อ 44) |
| Commerce Core | **Neon PostgreSQL** | เงิน/สินค้า/ออเดอร์/สต็อก/ค่าธรรมเนียม (D1) |
| App DB | **Convex** | users/auth, behavior, realtime, notifications, audit log |
| Storage | **Cloudinary** | ไฟล์รูป (ข้อ 45 — ไม่เก็บ binary ใน DB) |
| External | Shipping / Payment / Map providers | abstraction layer (Phase 8/9/5) |

---

## 3. โครงสร้าง source (เป้าหมาย)

โครงสร้างปัจจุบัน (ทำงานได้ — ใช้ต่อ) และเป้าหมาย (Phase 12 — monorepo split):

```
ปัจจุบัน (Phase 1)                              เป้าหมาย (Phase 12)
velnox-mvp/                                    velnox-mvp/
├── index.html / velshop.html /                ├── apps/
│   velseller.html / velcenter.html            │   ├── velshop/
├── src/                                       │   ├── velseller/
│   ├── sites/velshop|velseller|velcenter/     │   └── velcenter/
│   ├── pages/ · components/ · lib/            ├── blackend/
│   ├── convex/   ← Blackend logic             ├── convex/          ← Convex (root)
│   └── backend/  ← Neon data access           ├── packages/
├── db/ (schema.sql, migrate, smoke)           │   ├── shared/ · types/
├── docs/ ← เอกสารนี้                          │   ├── validation/ · constants/
└── packages/ (Phase 12)                       └── docs/
```

**Decision (D3):** ยัง**ไม่**แยก source เป็น monorepo ใน Phase 1 — การแยก deploy 3 เว็บทำได้แล้วผ่าน 3 Vite entries → 3 Vercel projects (ดู `INSTALL_AND_USAGE.md` §6) การแยก source tree เป็น refactor เสี่ยงสูง กำหนดเป็น **Phase 12 (Production Deployment)** หลังฟีเจอร์ครบ — ทำตอนนี้จะพังของที่ทำงานได้โดยไม่เพิ่มความสามารถใหม่

---

## 4. Data ownership (ข้อ 41)

| ข้อมูล | เจ้าของ | จัดเก็บที่ | ตารางปัจจุบัน |
|---|---|---|---|
| Profile, Addresses, Orders | User | Neon | `users`, `addresses`, `orders` |
| Store, Products, Inventory | Seller | Neon | `sellers`, `shops`, `products`, `product_images`, `inventory` |
| เงินทุกอย่าง (payments/commission/refund/settlement) | Platform | Neon | `payments`, `refunds`, `commissions`, `settlements` (+ `ledger_entries` ใหม่ Phase 10) |
| Platform settings, moderation, reports, audit | Platform | Neon (config) + Convex (audit) | `platform_settings` ใหม่ Phase 7 · `auditLogs` ใหม่ Phase 3 |
| Auth, role, department | Platform | Convex | `users` (Convex auth) |
| Behavior: views/interests/recommendation | Customer | Convex | `productViews`, `interests`, `businessEvents` |
| Notifications, reviews, wishlists, follow | — | Convex (พฤติกรรม/เรียลไทม์) | ใหม่ Phase 3/5/8 |

> หลักการข้อ 66: **ห้ามมี source of truth ซ้ำ** — Convex อ่านข้อมูล Neon ผ่าน business events (`businessEvents`) สำหรับ realtime/intelligence เท่านั้น ไม่ใช่เจ้าของข้อมูล commerce

---

## 6. การตัดสินใจทางสถาปัตยกรรม (Deliberate Decisions — ข้อ 66)

> ตาม spec §66: การเบี่ยงเบนจาก spec ต้องบันทึกและได้รับอนุมัติ เอกสารนี้คือบันทึกนั้น

### D1 — ฐานข้อมูลหลัก: Neon = Commerce Core (แทน "Convex เป็น primary DB" ใน spec §2/§40)

- **Spec ต้องการ:** Convex เป็น primary application database และเก็บตาราง commerce ไว้ใน Convex (§40)
- **ของเดิม (v3 — อนุมัติแล้ว):** Neon = Source of Truth ของธุรกิจ, Convex = Intelligence + Realtime; "ห้ามสร้างข้อมูลหลักซ้ำสองระบบ"
- **Decision:** คง v3 — ตาราง commerce ทั้ง 14 (users→subscriptions) อยู่ใน `db/schema.sql` (Neon) แล้วและมี data ใช้งานจริง ส่วน Convex เก็บ auth/users/behavior/notification/audit **เหตุผล:** ระบบเงิน/ออเดอร์ต้องมี relational integrity + transaction + SQL ที่แข็งแรง (Neon); ย้ายไป Convex = rewrite ทั้งระบบโดยไม่มีประโยชน์เพิ่ม ต้องย้อนกลับไปดู spec §2 diagram ที่วาง Blackend ไว้ระหว่าง Frontend กับ Database — บทบาทนี้ Convex ทำอยู่แล้ว
- **ผลกระทบ:** ตารางใน spec §40 ถูกแมปเป็น: commerce entities → Neon, app/intelligence entities → Convex (ดู §5) — spec ยังเป็นจริงทุกข้อในแง่ความสามารถ

### D2 — Blackend: ไม่สร้าง Node server แยก (ตอนนี้)

- **Spec ต้องการ:** backend/ แยกโฟลเดอร์ + hosting แยก (api.velnox.com)
- **Decision:** Blackend = **Convex actions/mutations** (API + business logic + auth) + `src/backend/*` (Neon data access) — Convex ให้ hosting, auth, validation, background jobs (cron), webhook (`src/convex/http.ts`) ครบอยู่แล้ว การสร้าง Node server แยก = business logic ซ้ำ 2 ที่ + ต้องดูแล server เอง — เก็บเป็นตัวเลือก Phase 12 หากต้องการ API สาธารณะ/third-party
- **ผลกระทบ:** `VITE_API_URL` (spec §53) ไม่ต้องใช้ตอนนี้ — frontend เรียก Convex โดยตรง (ผ่าน Convex client ที่เป็น typed API อยู่แล้ว)

### D3 — Frontend: คง multi-entry Vite (monorepo split ใน Phase 12)

ดู §3 — 3 เว็บแยก deploy ได้แล้วผ่าน 3 entries + 3 Vercel projects (`INSTALL_AND_USAGE.md` §6)

### D4 — เงิน: minor units (satang) เฉพาะระบบการเงินใหม่; ของเดิมคง NUMERIC(12,2)

- **Spec §58:** เก็บเงินเป็น integer minor units (100.50 THB → 10050 satang)
- **ปัจจุบัน:** Neon ใช้ `NUMERIC(12,2)`, Convex ใช้ `number`
- **Decision:** ระบบการเงินใหม่ที่สร้างใน Phase 10 (ledger, payouts, penalties) ใช้ **minor units (integer)** เป็นมาตรฐาน; ตารางเดิมคง `NUMERIC(12,2)` ไว้ (data อยู่แล้ว) + migration path บันทึกใน Phase 10; หน้าจอแปลงหน่วยที่ backend เสมอ (ห้ามคำนวณเงินใน frontend — ข้อ 58)

### D5 — GPS บังคับบน shipping address (ใหม่ ตาม spec §7/§27/§54)

- **ปัจจุบัน:** `addresses` ไม่มี lat/lng, ไม่มี map picker
- **Decision:** รับ requirement เต็มรูปแบบ: เพิ่ม `latitude`/`longitude` ในตาราง `addresses` (Neon) + `address_snapshot` ของ order + seller address; map picker (MapLibre/Leaflet + free tile — ไม่ต้องใช้ API key หรือใช้ Google Maps ถ้ามี key) รองรับ 3 วิธีตาม spec: current location / select on map / drag marker; validation ที่ backend: **ห้ามบันทึก shipping address ที่ไม่มีพิกัด** (ยกเว้น address เก่า → migration กำหนดใน Phase 2)
- **แผน:** Phase 2 (schema) → Phase 5 (velshop checkout) → Phase 6 (seller location)

### D6 — Auth: คง Email OTP (ไม่เพิ่ม password ใน v1.1)

- **Spec §4.1.1:** register/login/logout/recovery ด้วย email + password
- **Decision:** Convex Auth Email OTP ครอบคลุม register/login/logout/recovery (OTP คือ recovery ในตัว) + guest browsing + session — ปลอดภัยกว่า password และไม่ต้องเก็บ hash; เพิ่ม password ภายหลังได้โดยไม่กระทบ (Convex Auth รองรับหลาย provider) — เปิดใน Phase 4/12 ตามความต้องการ

---

## 7. ฐานข้อมูล — สถาปัตยกรรมเป้าหมาย (รายละเอียด Phase 2)

### 7.1 Neon (Commerce Core) — มีแล้ว 14 ตาราง

`db/schema.sql` — users, sellers, shops, products, product_images, inventory, addresses, orders, order_items, payments, refunds, commissions, settlements, subscriptions

### 7.2 Neon — ตารางใหม่ที่ต้องเพิ่ม (Phase 2 เป็นหลัก)

| ตาราง | มาจาก spec | เนื้อหาหลัก |
|---|---|---|
| `categories` | §9 | parent_id (hierarchy), name, slug, image, description, active, sort_order |
| `product_variants` | §20 | product_id, sku, options (color/size/...), price, stock, image, weight, dimensions |
| `shipments` | §14/§55 | order_id, provider, tracking_number, carrier, status, label_url |
| `tracking_events` | §14 | shipment_id, status, location, timestamp, metadata |
| `returns` | §15 | order_item_id(s), reason, evidence (urls), status flow, seller_responsibility, platform_responsibility |
| `ledger_entries` | §57 | order_id, type (gross/commission/shipping/refund/penalty/payout), amount_minor, direction, balance_after, ref |
| `platform_settings` | §23/§34/§35 | platform_commission (3), shipping_company_percentage (10), return_threshold (10%), auto_approve_*, payment_methods, currency, tax |
| `seller_balances` / `seller_payouts` | §17.1/§33 | available_balance, pending_payout, payout history |

### 7.3 Convex (App DB) — ตารางใหม่ที่ต้องเพิ่ม

| ตาราง | มาจาก spec | เนื้อหาหลัก |
|---|---|---|
| `auditLogs` | §47 | actor, action (ADMIN_APPROVED_SELLER...), target, metadata, ip, timestamp |
| `notifications` | §46 | userId, type, title, body, link, read, createdAt |
| `reviews` | §8/§10 | product_id, order_item_id, rating, comment, images, status |
| `wishlists` | §8 | user_id, product_id (Neon id), created_at |
| `storeFollows` | §10 | user_id, seller/shop id, created_at |

> ผู้ใช้/order/สินค้า ยังคงอ้าง Neon id เป็น `v.string()` (ตาม pattern `interests` ที่มีอยู่แล้ว)

---

## 8. Blackend — สถาปัตยกรรม layer

```
Frontend (React)
   │  Convex client (typed RPC — ไม่มี REST กลาง)
   ▼
Blackend = Convex
   ├── src/convex/auth.ts           → auth + session (Convex Auth)
   ├── src/convex/*.ts              → queries/mutations/actions (business logic)
   │     ├── commerce.ts            → seller/shop/commission logic (requireSeller ฯลฯ)
   │     ├── orders.ts · products.ts → order/checkout/product flow
   │     ├── center.ts              → velcenter RBAC + KPIs
   │     ├── subscriptions.ts       → VelRepeat
   │     └── intelligence.ts        → prediction/recommendation
   ├── src/convex/http.ts           → webhook endpoint (external services)
   ├── src/backend/*.ts             → Neon data access (ใช้ @neondatabase/serverless)
   │     ├── db.ts                  → pool/query helper
   │     ├── orders.ts · products.ts · payments.ts · sellers.ts · storage.ts
   │     └── providers/ (Phase 8/9) → ShippingProvider, PaymentProvider interfaces
   └── crons (Convex scheduled)     → VelRepeat auto-order, settlement, due checks
```

### Provider abstraction (ข้อ 55–56) — blueprint

```ts
// packages/validation หรือ src/backend/providers/types.ts (Phase 12 → packages/)
export interface ShippingProvider {
  createShipment(input: ShipmentInput): Promise<ShipmentResult>;
  getShipment(trackingNo: string): Promise<ShipmentStatus>;
  trackShipment(trackingNo: string): Promise<TrackingEvent[]>;
  cancelShipment(trackingNo: string): Promise<void>;
  calculateRate(from: GeoPoint, to: GeoPoint, weight: number): Promise<Money>;
}

export interface PaymentProvider {
  createPayment(order: OrderRef): Promise<PaymentIntent>;
  verifyPayment(ref: string): Promise<PaymentStatus>;
  refundPayment(ref: string, amountMinor: number): Promise<RefundResult>;
}
```

- Phase 8: implement 1 shipping provider (เช่น Kerry/Flash/ไปรษณีย์ — เลือกตามบัญชีจริง)
- Phase 9: implement 1 payment provider (เช่น Omise/PromptPay/Stripe — เลือกตามบัญชีจริง)

### กฎบังคับ (ข้อ 38/44/59/60)

- ทุก mutation: **auth → authorization → ownership → validation → business rule** (ตรวจใน backend เท่านั้น)
- Stock ตรวจที่ backend ตอน checkout (reserved_quantity ใน `inventory`)
- Order ต้อง snapshot ชื่อ/ราคา/ตัวเลือก/ร้าน/ค่าขนส่ง (ทำแล้วใน `order_items` + `orders.address_snapshot`)
- เงินคำนวณที่ backend เท่านั้น (ห้าม frontend คำนวณยอดรวมสำคัญ — ข้อ 58)

---

## 9. การเงิน (ข้อ 22–25, 33–35, 57)

```
Order (gross)
  ├── Platform Commission   = gross × platformSettings.platform_commission (default 3%)
  ├── Shipping Fee          = shipping × platformSettings.shipping_company_percentage (default 10%)
  ├── Return / Refund       = ตาม refunds
  ├── Return Penalty        = ถ้า return rate > 10% → ส่วนเกินหักจาก seller (ข้อ 24–25)
  └── Seller Net Revenue    = gross − commission − shipping − refund − penalty
```

- **ห้าม hard-code:** ค่า commission/percent/threshold ต้องอ่านจาก `platform_settings` (Neon) ไม่ใช่ constant ในโค้ด (ข้อ 23/34) — ปัจจุบัน `commission_rate` เก็บต่อ shop แล้ว, `refund_policy_limit` เก็บต่อ seller แล้ว; `platform_settings` ใหม่ใน Phase 7
- **Ledger (Phase 10):** ทุกธุรกรรมเขียน `ledger_entries` 1 บรรทัดต่อรายการ (audit ได้ทุกบาท — ข้อ 57)
- **Payout:** seller_balances/seller_payouts จาก ledger ไม่ใช่คำนวณสดจาก orders

---

## 10. RBAC (ข้อ 36–37)

| Role (spec) | Role (ระบบปัจจุบัน) | VelShop | VelSeller | VelCenter | หมายเหตุ |
|---|---|---|---|---|---|
| CUSTOMER | `customer` | ✅ | ❌ | ❌ | ข้อมูลตัวเองเท่านั้น |
| SELLER | `seller` | ✅ | ✅ ร้านตัวเอง | ❌ | เก็บ ownership แยก seller |
| STAFF | `staff` | ✅ | ❌ | ✅ view-only + ฝ่ายที่ได้สิทธิ์ | department scoping มีแล้ว |
| ADMIN | `admin` | ✅ | ✅ | ✅ ธุรกิจทั้งหมด แต่จัดการพนักงานไม่ได้ | |
| SUPER_ADMIN | `owner` | ✅ | ✅ | ✅ ทุกอย่าง + platform settings | spec §37: SUPER_ADMIN ควบคุม platform/security settings → ตรงกับ owner + ต้องได้สิทธิ์ platform_settings ใน Phase 7 |

---

## 11. Deployment + Environment (ข้อ 50–53)

| ส่วน | ที่ deploy | Domain แนะนำ (ข้อ 51) |
|---|---|---|
| VelShop | Vercel | shop.velnox.com |
| VelSeller | Vercel | seller.velnox.com |
| VelCenter | Vercel | center.velnox.com |
| Blackend | Convex Cloud (managed) | — (VITE_CONVEX_URL) |
| Neon | Neon Cloud | — (DATABASE_URL) |
| Cloudinary | Cloudinary | — |

Env matrix — ดู `INSTALL_AND_USAGE.md` §6.7 ครบถ้วน (Vercel vs Convex deployment env)

| ตัวแปร | Dev (.env.local) | Production (Vercel/Convex) |
|---|---|---|
| `VITE_CONVEX_URL` | dev deployment URL | inject อัตโนมัติโดย `convex deploy` |
| `VITE_SITE_BASENAME` | ว่าง | ว่าง |
| `VITE_VEL*_URL` | `/velX.html` | domain จริง |
| `DATABASE_URL` | Neon dev | Neon prod (Convex env) |
| `CLOUDINARY_*` | ✅ | ✅ (Convex env) |
| `SITE_URL` | localhost | domain จริง |
| `VITE_MAP_API_KEY` (spec §53) | — | ใช้เฉพาะถ้าเลือก Google Maps (D5 ใช้ MapLibre ฟรีได้) |

**ห้าม commit secrets** — `.env*`, `_generated` อยู่ใน `.gitignore` แล้ว (ข้อ 53)

---

## 12. แผน Phase (สรุป — รายละเอียดใน `PHASE_PLAN.md`)

| Phase | เนื้อหา | สถานะ |
|---|---|---|
| 1 | Architecture (เอกสารนี้) | ✅ อยู่ระหว่างอนุมัติ |
| 2 | Database — schema เพิ่ม (categories, variants, shipments, returns, ledger, platform_settings, GPS columns) | ⏳ ถัดไป |
| 3 | Backend — audit log, error handling, RBAC audit, provider interfaces | ⏳ |
| 4 | Authentication — เสริม profile/address/phone (OTP ต่อจากเดิม) | ⏳ |
| 5 | VelShop — GPS checkout, multi-seller parent order, reviews/wishlist/follow, category browse | ⏳ |
| 6 | VelSeller — variants/SKU/weight, store settings + location, order tracking update, dashboard KPIs | ⏳ |
| 7 | VelCenter — platform settings, seller moderation, product moderation, financial reports | ⏳ |
| 8 | Shipping — shipments/tracking events + 1 provider | ⏳ |
| 9 | Payment — payment provider integration + webhook | ⏳ |
| 10 | Financial — ledger, balances, payouts, penalties, minor units | ⏳ |
| 11 | Testing — unit/integration (backend functions + db:smoke) | ⏳ |
| 12 | Production — monorepo split, staging, deploy, custom domains | ⏳ |

---

## 13. เกณฑ์สำเร็จของ Phase 1 (ข้อ 65)

- [x] 3 Frontend applications แยก deploy ได้ (multi-entry Vite → 3 Vercel projects)
- [x] Backend (Blackend) แยกชัดเจน — Convex + `src/backend/*` + provider abstraction blueprint
- [x] Shared packages — กำหนด blueprint (`packages/` ใน Phase 12; validation ใช้ zod ในโค้ดแล้ว)
- [x] Database architecture ชัดเจน (Neon Commerce Core + Convex App DB + ตารางใหม่ blueprint)
- [x] Authentication architecture ชัดเจน (Convex Auth OTP + อนาคต password)
- [x] Authorization architecture ชัดเจน (RBAC matrix §10 + ownership rule §8)
- [x] Financial architecture ชัดเจน (ledger blueprint §9)
- [x] Shipping / Payment architecture ชัดเจน (provider interfaces §8)
- [x] GPS architecture ชัดเจน (D5 — 3 วิธี + backend validation)
- [x] Seller / Admin architecture ชัดเจน (VelSeller/VelCenter responsibilities + RBAC)

---

## 14. เอกสารอ้างอิง

- `docs/GAP_ANALYSIS.md` — spec ข้อต่อข้อ vs สถานะปัจจุบัน
- `docs/PHASE_PLAN.md` — แผน Phase 2–12 ละเอียดลง repo
- `INSTALL_AND_USAGE.md` — วิธีติดตั้ง/ใช้งาน/deploy (Vercel)
- `ARCHITECTURE_V3_MIGRATION.md` — สถาปัตยกรรม v3 เดิม + migration (ยังใช้เป็นฐาน)
- `db/schema.sql` — Neon Commerce Core (14 ตาราง)
