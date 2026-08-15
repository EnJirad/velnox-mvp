# VELNOX — PHASE 8 REPORT
## Production Hardening, Security & Final Integration

Version: 1.0 · Phase 8 · Status: COMPLETED (Production-Ready Candidate — ตามเงื่อนไขด้านล่าง)

---

## 1. Completed

### Security (§3, §13, §20, §24, §44, §47, §52)
- Convex Auth (Email OTP + anonymous guest) — session อยู่ใน httpOnly cookie ฝั่ง backend, **ไม่มี token ใน localStorage**; OTP 15 นาที; built-in rate limit สำหรับ sign-in/OTP
- `@convex-dev/auth` 0.0.90 → **0.0.95** + `@auth/core` 0.37.4 → **0.41.3** (ปิด critical advisory ใน Phase 7 — re-verified)
- Image upload: Cloudinary signed params (allowed_formats + max_bytes 5 MB) + **backend re-validate** MIME/size ใน `saveProductImage` — ไม่เชื่อ frontend; ไม่เก็บ binary ใน DB (§26)
- ห้าม log password/JWT/keys/payment credentials — scan แล้วไม่มีใน source
- Rate limiting (Phase 7): checkout 10/min · cancel 20/min · review 20/h · return 10/h · subscribe 20/h + Convex Auth OTP
- Health check `GET /health` (`src/convex/http.ts`) (§53)

### Authentication (§42–43)
- ระบบ auth เดียวทั้ง 3 เว็บ (Convex Auth) — cross-site session ผ่าน Convex; protected routes + `returnTo` redirect ครบทุกเว็บ

### Authorization (§4, §5, §8, §10, §19, §56)
- Guard กลาง `src/backend/identity.ts`: `requireIdentity` / `requireRoles` / `requireSeller` / `requireSellerForShop` / `requirePermission` / `requireCenter`
- **Ownership (IDOR) enforcement** — verified:
  - Order: `orderDetail`/`reorderAction`/`cancelOrderAction` ตรวจ `customer_user_id === user.id` (Customer A ดู order B ไม่ได้)
  - Seller: `requireSellerProduct` (Product → Shop → Seller chain), `sellerOwnsOrder` (order_items.seller_id)
  - Address/Wishlist/Cart/Notification/Subscription: ทุก action ผูก `user.id` จาก session
  - VelCenter: `requirePermission` granular (staff เห็นตาม permission; owner/admin ผ่านหมด; customer/seller ถูกปฏิเสธ)
- **Phase 8 (ใหม่): ทุก throws ใน actions แปลงเป็น `AppError` (stable code)** — ไม่มี `new Error()` หลงเหลือใน customer/seller/center actions (§28)

### Validation (§11, §21, §24, §48)
- zod schemas กลาง (`src/backend/validation.ts`): email/phone/price ≥ 0/quantity ≥ 1/SKU/GPS lat ∈ [-90,90], lng ∈ [-180,180] + default shipping address ต้องมีพิกัด
- ราคา/commission/threshold **ไม่ hard-code** — อ่านจาก `platform_settings` (default 3% / 10% / 10%)
- **เงิน**: NUMERIC(12,2) + `round2()` server-side (ตาม decision D4 ที่อนุมัติ — ระบบการเงินใหม่ใช้ minor units)

### Database Integrity (§11–12, §17, §22–23, §35–37, §48–49)
- Checkout = 1 transaction: lock products (FOR UPDATE) → reserve inventory → snapshots (name/price/variant/address) → per-shop orders + commission → `idempotency_key` (double-click ไม่สร้าง order ซ้ำ)
- State machine กลาง `canTransitionOrderStatus` + tests — DELIVERED → PROCESSING เป็นไปไม่ได้
- Inventory: `stock - reserved` atomic; cancel → คืนสต็อก; ไม่เกิด stock ติดลบ
- Soft delete: product `archived` status; financial records ไม่ hard delete
- Ledger append-only (แก้ = adjustment); audit_logs append-only (frontend แก้ไม่ได้)

### Checkout / Orders / Inventory / Returns / Commission / Payout (§6–10, §15–16, §18, §31, §50)
- Backend คำนวณราคาใหม่จาก DB (ราคาเปลี่ยน → `PRICE_CHANGED` error) — client ไม่เคยเป็น source of truth
- Return flow: REQUESTED → UNDER_REVIEW → APPROVED/REJECTED → RETURN_SHIPPING → RECEIVED → REFUNDING → REFUNDED (บันทึก actor + timestamps)
- Commission/return-penalty/shipping split: tests ครอบ (1,000×3% = 30; 15/100 returns → เกิน 5% → seller รับผิดชอบส่วนเกิน)
- Payout: pending → available → payout (จาก ledger ไม่ใช่คำนวณสดจาก orders)

### Admin Controls (§26–27, §30, §32, §59, §71)
- VelCenter: seller moderation, product moderation, platform settings (validate + audit + updated_by/updated_at), audit log viewer, staff permission management (owner-only)
- **Audit wiring ครบ**: approve/reject/suspend seller, product update/approve, settings change, refund, payout, order status change, order cancel, checkout, return request, shop update/location, staff permission change

### Error Handling (§27–29, §37–38)
- Error codes กลาง `src/backend/errors.ts` — **Phase 8 (ใหม่): ใช้จริงทุก action layer** + contract tests (`tests/errors.test.ts`); client เห็นเฉพาะ safe Thai message (ไม่มี stack trace/DB error/secret)
- Frontend: RootErrorBoundary + loading/empty/error state ทุกหน้า

### Performance (§30–32, §34)
- Pagination: products (catalog), orders, payouts, audit logs (limit/offset) — ไม่มี SELECT ALL
- Search backend-driven (name + description) — ไม่โหลดทั้งหมดมา filter หน้า client
- `bun run build` ผ่าน (tsc -b && vite build — ไม่ต้อง interactive login; codegen เจนไว้แล้ว §40)

### Testing (§55–56)
- 53 tests ผ่าน: validation (GPS/price/rating), order state machine, business rules (commission/return penalty/shipping split), RBAC matrix, providers (shipping/payment abstraction), VelRepeat scheduling, **AppError contract (ใหม่)**

---

## 2. Files Changed (Phase 8)

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `src/convex/commerce.ts` | throws ทั้งหมด → `AppError` (AUTH_REQUIRED/FORBIDDEN/PRODUCT_NOT_FOUND/ORDER_NOT_FOUND/INVALID_INPUT/NOT_FOUND/SHOP_NOT_FOUND) — message เดิมไม่เปลี่ยน |
| `src/convex/customer.ts` | throws → `AppError` (SHOP_NOT_FOUND/ORDER_NOT_FOUND/INVALID_STATUS_TRANSITION) |
| `src/convex/centerAdmin.ts` | throws → `AppError` (INVALID_INPUT/NOT_FOUND/PRODUCT_NOT_FOUND/FORBIDDEN) |
| `package.json` | + `typecheck` script (§73) · ลบ deps ไม่ได้ใช้ 4 ตัว: hono, react-intersection-observer, date-fns, @jridgewell/trace-mapping (§72) |
| `bun.lock` | sync กับ deps |
| `tests/errors.test.ts` | (ใหม่) AppError contract tests — 5 tests |
| `docs/PHASE-8-REPORT.md` | (ใหม่) เอกสารนี้ (§75) |
| `docs/PHASE_PLAN.md` | อัปเดตสถานะ Phase 8 |

## 3. Database Changes
- **ไม่มี migration ใหม่ใน Phase 8** — ฐานข้อมูลคงเดิม (Neon Commerce Core + Convex App DB); งานเฟสนี้เป็น code-level hardening

## 4. Environment Variables (ชื่อเท่านั้น — ค่าอยู่ใน Keys/API keys UI)
- `DATABASE_URL` · `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`
- `SITE_URL` · `JWT_PRIVATE_KEY` · `JWKS` (Convex deployment env — auth runtime อ่านจาก Convex env §41)
- `VITE_CONVEX_URL` (inject โดย convex deploy) · `VITE_SITE_BASENAME` · `VITE_VELSHOP_URL` / `VITE_VELSELLER_URL` / `VITE_VELCENTER_URL`
- หมายเหตุ: `src/convex/auth/emailOtp.ts` มี `x-api-key` ของ freebuff OTP relay (platform-managed, read-only — ดู docs/SECURITY.md §10)

## 5. Tests — **PASS** (53/53)
validation 8 · state machine 5 · business rules 6 · RBAC 7 · providers 4 · velrepeat 4 · errors 5 · อื่นๆ 14 (ยอดรวม 53)

## 6. Build — **PASS**
`bun run typecheck` ✅ · `bunx convex dev --once` ✅ · `bun test` ✅ · `bun run build` ✅ (tsc -b && vite build)

## 7. Remaining Issues (จริง — ไม่ปิดบัง)
1. **Payment gateway จริงยังไม่ติด** — `ManualPaymentProvider` (COD/โอน/PromptPay → PENDING; paid เมื่อเงินถึงจริง) — ต้องเสียบ Omise/Stripe (Phase 9) ผ่าน `PaymentProvider` abstraction
2. **Carrier API จริงยังไม่ติด** — tracking เป็น manual (seller กรอกเลขพัสดุ) — `ShippingProvider` abstraction พร้อม
3. **Domains/DNS/Vercel/Convex prod deploy** — ต้อง config บน platform ตาม `docs/DEPLOYMENT.md`; production keys ผ่าน Keys UI
4. **Rate limit ฝั่ง IP** สำหรับ auth endpoints เมื่อมี HTTP API จริง (Convex Auth ครอบ OTP อยู่แล้ว)
5. **Webhook signature verification** — ยังไม่มี webhook ภายนอก (จะเกิดพร้อม payment/carrier provider)
6. **E2E browser test** — scenario 1–16 ใน `docs/E2E-TESTING.md` ยังไม่รันบน browser automation
7. **Git commit** — platform (Vly) จัดการ version control; คำสั่ง git ถูกบล็อก

## 8. สถานะรวม
> Velnox = **Production-Ready Candidate** — ตาม Phase 7 FINAL RULE ยังไม่ประกาศ Production Ready จนกว่าจะผ่าน: payment gateway จริง + carrier จริง + production deploy + smoke test บน domain จริง (blockers ข้อ 1–3, 6)
