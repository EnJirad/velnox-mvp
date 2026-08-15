# PHASE 11 RESULT — PRODUCTION HARDENING + SECURITY + DEPLOYMENT READINESS

Version: 1.0 · Phase 11

> วิธีทำงาน (§70): อ่าน architecture/schema/backend ของจริงก่อน → หา root cause → แก้เฉพาะจุด → test → build → ตรวจ regression
> ไม่ rewrite, ไม่สร้างของซ้ำ, ไม่ mock

---

### SECURITY — **PASS**
Secret scan สะอาด (ไม่มี JWT/PRIVATE_KEY/API key ใน source) · error codes กลาง (AppError) · rate limit · upload signed + re-validate · **XSS**: React escape โดย default + ไม่มี dangerouslySetInnerHTML · security headers ไฟล์ `vercel.json` ใหม่ (§50)

### AUTH — **PASS**
Convex Auth OTP (httpOnly cookie, ไม่มี token ใน localStorage) · env (SITE_URL/JWT_PRIVATE_KEY/JWKS) ระบุใน `docs/authentication.md` + `docs/production/environment.md` — ต้องตั้งใน Convex prod env ตอน deploy (§62) · **หมายเหตุ: `.env.example` ถูก platform บล็อก (sensitive files) — template อยู่ใน `docs/ENVIRONMENT.md` แทน**

### DATABASE — **PASS**
Neon = source of truth เดียว · constraints/unique/FK/snapshot/ledger append-only · indexes ครบ (§31) · `db:smoke` + `db:consistency` (reconciliation) · ไม่มี DB แยก

### API — **PASS**
ทุก action: auth → authorization → ownership → zod validation → rate limit → audit (write สำคัญ) · error response ไม่ leak stack trace/secret · **ลบ legacy `placeOrder` (commerce.ts) ที่รับ `shippingFee` จาก client + `address: v.any()` (§7/§69)** — ไม่มี caller

### FINANCIAL — **PASS**
Backend คำนวณทุกบาท (client ส่งแค่ productId+quantity+addressId+paymentMethod) · commission snapshot (test §39.10) · return penalty server-side · ledger append-only · reconciliation script

### ORDER — **PASS**
State machine (canTransitionOrderStatus + tests) · idempotency_key · multi-seller split · snapshot (name/price/address/commission) · **ลบ order path คู่ขนาน legacy (`convex/orders.ts placeOrder` — เขียน Convex tables ตรง ๆ, bypass Neon ledger/commission/idempotency/audit)** (§69.13 duplicate business logic)

### INVENTORY — **PASS**
atomic reserve (FOR UPDATE) · stock ห้ามติดลบ (CHECK constraint + backend) · cancel → คืน stock

### PERFORMANCE — **PASS**
pagination (products/orders/payouts/audit logs) · backend-driven search · lazy loading + code splitting · aggregated reports (sellerIncome/platformRevenueReport) · **หมายเหตุ**: dashboard ยังมี legacy Convex-table queries (`api.orders.allOrders` ใน Center.tsx) — ดู Remaining

### DEPLOYMENT — **PASS (prep)**
build ไม่ต้อง login Convex (`_generated` commit) · `vercel.json` (headers + HTTPS ผ่าน Vercel) · docs: `docs/production/` ครบ (rollback/backup/monitoring/incident-response) · **deploy จริงยังไม่ทำ** — ต้องบน platform

### PRODUCTION READINESS — **NOT READY**
ยังขาด (รายการ §68 ที่ ⏳): payment gateway จริง · carrier จริง · Vercel projects + domains/SSL · Convex prod deploy + env · E2E browser · legal pages · admin account จริง · backup restore test · CI/CD · staging · MFA

---

## ปัญหาที่พบ / root cause / ไฟล์ที่แก้

| ปัญหา | Root cause | ไฟล์ที่แก้ | สิ่งที่แก้ |
|---|---|---|---|
| 2 เส้นทางสั่งซื้อคู่ขนาน — legacy `placeOrder` เขียน Convex tables ตรง ๆ (bypass Neon ledger/commission/idempotency/audit) | code เดิมจากก่อน migration Neon | `src/convex/orders.ts` | ลบ legacy `placeOrder` mutation (เก็บ note ว่า order creation อยู่ที่ Commerce Core เท่านั้น) |
| `placeOrder` action รับ `shippingFee` จาก client + `address: v.any()` (§7) | action เดิมก่อน checkoutAction | `src/convex/commerce.ts` | ลบ action (ไม่มี caller) + note |
| Product actions ไม่มี audit log (§22 ต้องการ SELLER_CREATED_PRODUCT / UPDATED / APPROVED) | audit เพิ่มเฉพาะ Phase 6–7 บางจุด | `src/convex/commerce.ts` | เพิ่ม `audit()` ใน createProductAction (SELLER_CREATED_PRODUCT) · updateProductAction (SELLER_UPDATED_PRODUCT, before/after) · setProductStatusAction (SELLER_UPDATED_PRODUCT_STATUS) · deleteProductAction (SELLER_ARCHIVED_PRODUCT); `requireSellerProduct` คืน `user` ให้ audit ได้ |
| ไม่มี security headers config | ยังไม่ deploy | `vercel.json` (ใหม่) | CSP · X-Content-Type-Options · X-Frame-Options · Referrer-Policy · Permissions-Policy · HSTS |
| `.env.example` | platform บล็อก sensitive files | — | template อยู่ใน `docs/ENVIRONMENT.md` (ระบุใน report นี้) |

## test ที่รัน
`bunx convex dev --once` ✅ · `bun run typecheck` ✅ · `bun test` (55/55) ✅ · `bun run build` ✅

## build result — **PASS**
tsc -b && vite build — ไม่ต้อง login Convex CLI

## deployment result — ยังไม่ได้ deploy จริง (ต้องบน platform: Vercel 4 projects + Convex prod + env)

## สิ่งที่ยังต้องทำ (จริง)
1. Payment gateway จริง (Omise/Stripe — Gravity พร้อม) + webhook signature
2. Carrier API จริง (ShippingProvider พร้อม)
3. Vercel projects + domains/SSL + ตรวจ CSP จริงหลัง deploy (Sentry จะรายงาน violation)
4. Convex prod deploy + env ครบ (SITE_URL/JWT_PRIVATE_KEY/JWKS/DATABASE_URL/Cloudinary/Sentry DSN)
5. E2E browser (Playwright — `docs/E2E-TESTING.md` 16 scenarios)
6. Legal pages · 7. Admin account จริง · 8. Backup restore test · 9. CI/CD · 10. Staging · 11. MFA (VelCenter)
12. **ล้าง legacy Convex-table dashboard ต่อ**: `Center.tsx` ยังใช้ `api.orders.allOrders/updateStatus/sellerIncome` (Convex tables) — ย้ายไป centerAdmin/Neon เพื่อ single source of truth (งาน Phase 12 — ไม่ทำตอนนี้เพื่อไม่รื้อที่ทำงานอยู่)
