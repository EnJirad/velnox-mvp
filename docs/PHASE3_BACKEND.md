# Velnox — PHASE 3: Backend & Database Foundation

> วันที่: 14 ส.ค. 2026 · อ่านก่อน: `docs/ARCHITECTURE.md` (Phase 1) + `docs/PHASE2_DATABASE.md` (Phase 2)
> Deliverable: `src/backend/*` (foundation + services) + `src/convex/{customer,sellerOps,centerAdmin}.ts` + `tests/` (30 tests) + `bun test` ผ่าน

---

## 1. สถาปัตยกรรมที่ใช้ (ตามที่อนุมัติใน Phase 1)

```
VelShop / VelSeller / VelCenter
        │  Convex client (typed RPC — frontend ไม่แตะ DB ตรง)
        ▼
Blackend = Convex node actions (src/convex/*)   ← auth + authorization + orchestration
        │  เรียก
        ▼
src/backend/* (Neon data access + business logic)  ← Source of Truth ของเงิน/สินค้า/ออเดอร์
        │
        ▼
Neon PostgreSQL (Commerce Core) 36 ตาราง (Phase 2)
```

- **ห้ามเชื่อ frontend**: ทุก mutation เริ่มด้วย `requireIdentity → requireRoles/requireSeller/requirePermission → ownership check → zod validate → business rule` (spec §33, §38)
- เงินคำนวณใน backend เท่านั้น (spec §49, §58) — `rules.ts` + `finance.ts`
- Rule ทางธุรกิจ (commission 3%, shipping 10%, return threshold 10%) อ่านจาก `platform_settings` — **ไม่ hard-code** (spec §23/§25/§32)

## 2. ความขัดแย้งกับ Spec — รายงานก่อนแก้ (§64.9)

| # | Spec | ของเดิม / การตัดสินใจ | สถานะ |
|---|---|---|---|
| C1 | §1 โครงสร้าง `velshop/` `blackend/` `packages/` แยกโฟลเดอร์ | repo เดียว + `src/` (3 Vite entries) + `src/backend/` + `src/convex/` — อนุมัติแล้วใน Phase 1 (D3/D2) | ✅ |
| C2 | §2 "Convex เป็น primary DB" | **Neon = Commerce Core, Convex = auth + intelligence** — อนุมัติแล้ว (D1) | ✅ |
| C3 | §3 env `JWT_PRIVATE_KEY` / `JWKS` | Convex Auth จัดการ session ให้ (JWT ภายใน) — ไม่ต้องตั้ง key เอง | ✅ |
| C4 | §50 เงิน minor units (satang) | `NUMERIC(12,2)` + `round2` ที่ backend — บันทึกใน D4, เปลี่ยนใน Phase 10 ได้ | 🟡 |
| C5 | §18 สถานะ order enum เดียว 13 ค่า | 3 แกนแยก (status/payment_status/shipping_status) + state machine ต่อแกน — อนุมัติแล้ว (C6 Phase 2) | ✅ |
| C6 | §30 SellerPayout ใช้ periodStart/End + paidAt | ตาราง Phase 2 ใช้ requested_at/processed_at + method/destination — พอเพียงสำหรับ v1 | 🟡 |
| C7 | §59 tests ครอบคลุม auth/payment/refund ฯลฯ | รอบนี้เป็น **unit tests สำหรับ pure logic** (commission/penalty/GPS/state machine/permissions) — integration กับ Neon จริง = Phase 11 | 🟡 กำหนดใน Phase 11 |
| C8 | §55 build = `tsc -b && vite build` (ไม่เรียก convex codegen) | **ทำตาม spec แล้ว** — `package.json` build ไม่มี codegen; Vercel ใช้ `npx convex deploy --cmd 'bun run build'` (deploy สร้าง `_generated` ก่อน build) | ✅ |
| C9 | Legacy `sellerIncome()` ใน `orders.ts` ยังใช้ constant 3%/10% | ฟังก์ชันเดิมของ v1 (UI ใช้อยู่) — **คงไว้**, ระบบใหม่ (`rules.ts`/`finance.ts`) อ่านจาก platform_settings; รวมเป็น ledger เดียวใน Phase 10 | 🟡 Phase 10 |

## 3. Foundation (ใหม่ใน `src/backend/`)

| ไฟล์ | หน้าที่ |
|---|---|
| `errors.ts` | Error codes กลาง: AUTH_REQUIRED / FORBIDDEN / NOT_FOUND / INVALID_INPUT / OUT_OF_STOCK / PRICE_CHANGED / INSUFFICIENT_STOCK / INVALID_STATUS_TRANSITION / ADDRESS_GPS_REQUIRED ฯลฯ (spec §38) |
| `validation.ts` | zod schema กลาง: GPS (±90/±180, คู่กัน, **default address ต้องมีพิกัด** — §62), phone, email, price, quantity, rating 1–5, cart/checkout/return/review input (spec §37, §53) |
| `rules.ts` | Business rules + **pure calculation**: `calcPlatformFee` (3%), `calcReturnRatePercent`, `calcSellerReturnCost` (เกิน threshold 10% = seller รับ), `calcSellerNet`, `calcPlatformRevenue` — อ่านค่า config จาก `platform_settings` |
| `platformSettings.ts` | key/value settings (get/set, seeded default) — admin แก้ได้จาก VelCenter |
| `permissions.ts` | Permission catalog 13 รายการ (VIEW_USERS…MANAGE_PLATFORM_SETTINGS — §47) + `hasPermission`/`requirePermission` (owner/admin มีทุกสิทธิ์) |
| `audit.ts` | เขียน `audit_logs` (actor, action, entity, before/after, ip, userAgent — §47) |
| `identity.ts` | Guards กลาง: `requireIdentity` (สร้าง Neon user row อัตโนมัติจาก Convex auth), `requireRoles`, `requireSeller`, `requireSellerForShop`, `requirePermission`, `requireCenter` — ใช้ในทุก node action |

## 4. Services (ต่อ entity ใหม่ของ Phase 2)

| ไฟล์ | ฟีเจอร์ |
|---|---|
| `addresses.ts` | CRUD + soft delete + **GPS required สำหรับ default address** + `requireShippingAddress` (checkout ใช้) |
| `categories.ts` | Hierarchical tree (parent/child, active, sort) |
| `carts.ts` | Cart: เพิ่ม/ลบ/อัปเดตจำนวน/รวมกลุ่มร้าน + price snapshot + stock check |
| `checkout.ts` | **Checkout multi-seller atomic** (§39–42): 1 transaction — validate user/address/GPS → lock product (FOR UPDATE) → reserve stock (กัน oversell) → split ตามร้าน → parent order + per-shop orders + items snapshot + commissions + payment → release cart |
| `wishlists.ts` | เพิ่ม/ลบ/ดู wishlist |
| `reviews.ts` | Review 1–5 + **ตรวจ verified purchase** (ต้องมี order จริง) |
| `shipments.ts` + tracking | Shipment + tracking events timeline |
| `returns.ts` | Return lifecycle เต็ม (requested→…→refunded) + return rate/penalty จาก `rules.ts` |
| `notifications.ts` | In-app notifications (8 ประเภท) |
| `finance.ts` | **Ledger** (source of truth เงิน), seller report (gross/commission/return/net/pending), platform revenue, payouts, balances |

## 5. Convex node actions (API ของ 3 เว็บ)

| ไฟล์ | ให้ใครใช้ | ฟีเจอร์หลัก |
|---|---|---|
| `src/convex/customer.ts` | VelShop | addresses (+GPS), cart, wishlist, checkout, reviews, notifications, my orders |
| `src/convex/sellerOps.ts` | VelSeller | shipments + tracking, returns, seller finance report, payout request |
| `src/convex/centerAdmin.ts` | VelCenter | platform settings, seller approve/suspend, product moderation, orders overview, revenue dashboard, audit logs, staff profiles |

ทุก action เรียก guard จาก `identity.ts` ก่อน → zod validate → service → audit (ถ้าเป็น action สำคัญ)

## 6. Tests — `bun test` (30 pass, vitest)

ตาม spec §59–63 — **unit tests สำหรับ pure logic** (ไม่ต้องใช้ DB):

| ไฟล์ | ครอบคลุม |
|---|---|
| `tests/businessRules.test.ts` | **§60** ราคา 1000 × commission 3% → platform 30, seller net 970 · **§61** return 8% ≤ 10% → ไม่ถูกลงโทษ; return 15% > 10% → seller รับ 5% ของ gross · shipping 10% split |
| `tests/validation.test.ts` | **§62** GPS: lat ±90 / lng ±180, ต้องเป็นคู่, default shipping address ต้องมีพิกัด; rating/price/phone |
| `tests/orderStateMachine.test.ts` | **§18** pending→confirmed→shipped→delivered→completed; ยกเลิกก่อน ship เท่านั้น; ข้าม step ไม่ได้ |
| `tests/security.test.ts` | **§63** owner/admin มีทุกสิทธิ์, staff เฉพาะที่ได้สิทธิ์, seller/customer ถูกปฏิเสธ (RBAC + department scoping) |

รัน: `bun test` (หรือ `bun run test`)

## 7. package.json / build (§55)

- `build: "tsc -b && vite build"` — **ไม่มี `convex codegen`** ใน production build (Vercel ไม่ต้อง auth Convex CLI)
  - Vercel flow: `npx convex deploy --cmd-url-env-var-name VITE_CONVEX_URL --cmd 'bun run build'` → deploy สร้าง `_generated` ก่อนรัน build (ดู `INSTALL_AND_USAGE.md` §6.3)
- เพิ่ม `test` / `test:watch` scripts + devDependency `vitest`
- `tests/` ถูก typecheck ด้วย `tsconfig.node.json`

## 8. Definition of Done — Phase 3 ✅

- [x] Foundation: errors / validation (zod) / business rules (ไม่ hard-code) / permissions / audit / identity guards
- [x] Address + GPS (บังคับ default + checkout)
- [x] Category / Cart / **Checkout multi-seller atomic** / Wishlist
- [x] Review (verified purchase) / Shipment + tracking / Return (lifecycle + penalty) / Notification
- [x] Platform settings / Financial (ledger, seller report, platform revenue, payouts)
- [x] Convex node actions: customer / sellerOps / centerAdmin — ทุกจุดมี auth + authz + ownership
- [x] Tests 30 ผ่าน (§60–63) · `bunx tsc -b --noEmit` ผ่าน · `bunx convex dev --once` codegen ผ่าน
- [x] build script ตาม §55 (ไม่มี codegen ใน build)

## 9. สิ่งที่ยังไม่ทำใน Phase 3 (ตาม §68 — ยังไม่ทำ UI ใหม่)

- UI ของฟีเจอร์ใหม่ (address/cart/checkout/review/…) → Phase 5 (VelShop), 6 (VelSeller), 7 (VelCenter)
- Payment provider จริง / Shipping provider จริง → Phase 8/9
- Ledger เต็มรูปแบบ + settlement อัตโนมัติ + VelRepeat cron → Phase 10
- Integration tests กับ Neon จริง + CI → Phase 11

## 10. ขั้นต่อไป

**PHASE 4 — Authentication & Profile** (ต่อจาก Convex Auth ที่มี): profile/email/phone management, RBAC guard ครบทุกจุด, sync convex_id ↔ users ให้แน่น → จากนั้น Phase 5 (VelShop: catalog + cart + checkout + GPS UI)
