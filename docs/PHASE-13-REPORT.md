# PHASE 13 REPORT — Production Hardening, Security, Reliability & Final Integration

Version: 1.0 · Phase 13

---

## 1. What was audited

- **Authentication/Authorization** (PART 1–2): Convex Auth (OTP, httpOnly cookie) · guards กลาง `requireIdentity/requireRoles/requireSeller/requireSellerForShop/requirePermission/requireCenter` (`src/backend/identity.ts`) · ownership ทุก resource (order/address/cart/wishlist/notification = session user; seller = chain Product→Shop→Seller; center = granular permission) · tests `tests/security.test.ts`
- **API/actions** (PART 2, 12): ทุก convex action ตรวจ auth → authorization → ownership → zod → rate limit · **scan `v.any()`**: เหลือ 3 จุดที่สมเหตุผล (platform setting value — validate ที่ `updateSetting`; business event payload — metadata ไม่ใช่เงิน)
- **Input validation** (PART 3): `src/backend/validation.ts` (GPS/price/quantity/email/phone) · **พบช่องว่างจริง**: percentage keys ยอมรับ > 100; product price ไม่มี guard ไม่ติดลบ
- **Order/Inventory** (PART 4–5): state machine + idempotency_key + snapshot + atomic stock (FOR UPDATE) — ผ่าน
- **Commission/Return/Logistics** (PART 6–8): จาก platform_settings (ไม่ hardcode) + snapshot ตอนสั่ง (test §39.10)
- **Financial ledger** (PART 9): append-only, reconciliation script `db:consistency`
- **Address/GPS** (PART 10): lat/lng บังคับ + validate; MapPicker (current/map/drag)
- **Image upload** (PART 11): Cloudinary signed (allowed_formats jpg/jpeg/png/webp/avif/gif + max 5 MB) + backend re-validate — **ข้อจำกัด**: ตรวจ file signature (magic bytes) ไม่ได้เพราะ browser upload ตรงถึง Cloudinary — Cloudinary เป็นตัวบังคับ format ฝั่ง server (mitigated)
- **Rate limiting** (PART 12): มี checkout/cancel/return/review/subscribe + OTP (Convex Auth) — **เพิ่ม**: product_create 30/h, image_upload 60/h
- **Error/Logging/Audit** (PART 13–15): AppError codes กลาง (ไม่มี stack trace/secret ออก client) · audit ครอบ action สำคัญ (รวม product create/update/status/archive — เพิ่มใน Phase 11)
- **Frontend security** (PART 16): RequireAuth + returnTo + backend block (ไม่ซ่อนแค่ปุ่ม)
- **3 Apps** (PART 17–19): ตรวจครบตาม checklist
- **Build/Test/Git** (PART 28–29): typecheck + 58 tests + build ผ่าน; ไม่มี secret ใน git

## 2. What was fixed

| # | ปัญหา | Root cause | แก้ |
|---|---|---|---|
| 1 | **Percentage keys ยอมรับค่า > 100** — commission 150% เข้าได้ → คำนวณเงินพัง (PART 3) | `validateValue` ตรวจแค่ ≥ 0 | `platformSettings.ts`: `PERCENT_KEYS` (commission/shipping/threshold/tax) clamp **0–100**; export `validateValue` (test ครอบ) |
| 2 | **Product price ติดลบได้** — `createProduct`/`updateProduct` ไม่มี guard (DB ก็ไม่มี CHECK บน column) | ตรวจไม่ครบ | `products.ts`: `validatePrice` ใช้ `priceSchema` (≥ 0) ก่อน INSERT/UPDATE → `AppError INVALID_INPUT` |
| 3 | **ไม่มี rate limit สำหรับ product creation/upload** (PART 12) | เพิ่มเฉพาะกลุ่ม checkout | `commerce.ts`: `product_create` 30/h + `image_upload` 60/h (ต่อ seller) |

## 3. Security issues found

- Percentage > 100 ใน platform settings (financial corruption risk) — **แก้แล้ว**
- Negative product price (money integrity) — **แก้แล้ว**
- Product create/upload ไม่มี rate limit (abuse) — **แก้แล้ว**

## 4. Security issues fixed

ทั้ง 3 ข้อข้างต้น — + tests ใหม่ 3 ตัว (58 ผ่าน)

## 5. Remaining issues

- **BLOCKED (external)**: payment gateway จริง (ต้องเลือก provider + keys — ใช้ Gravity Index ได้เลย), carrier API จริง, deploy จริง (Vercel/Convex/DNS ต้องเจ้าของ + platform), E2E browser (Playwright + prod), legal pages, admin account จริง, backup restore test, MFA VelCenter
- **File signature validation**: delegated ให้ Cloudinary (allowed_formats + 5MB) — ไม่ verify magic bytes ฝั่งเรา (architecture: browser upload ตรง) — mitigated, บันทึกเป็น known limitation
- **Legacy Convex-table dashboard**: `Center.tsx` ยังใช้ `api.orders.allOrders/updateStatus/sellerIncome` (Convex tables) — ย้ายเป็นงาน Phase 14 (ไม่รื้อตอนนี้)
- Public search ไม่มี rate limit (catalog เป็น action, LIMIT 24 + index) — ความเสี่ยงต่ำ; เพิ่ม per-IP ได้เมื่อมี HTTP gateway

## 6. Tests executed

`bun test` — **58 pass / 0 fail** (203 expects): validation (GPS/price/rating) · state machine · business rules (+snapshot, +percentage 0–100, +price guard) · RBAC · providers · velrepeat · errors

## 7. Build result

**PASS** — `bun run typecheck` ✅ · `bunx convex dev --once` ✅ · `bun run build` ✅ (tsc -b && vite build, ไม่ต้อง login Convex)

## 8. Environment variables required

ดู `docs/ENVIRONMENT.md` + `docs/production/environment.md` — ชื่อเท่านั้น: `DATABASE_URL` · `CLOUDINARY_CLOUD_NAME/_API_KEY/_API_SECRET` · `SITE_URL` · `JWT_PRIVATE_KEY` · `JWKS` · `VITE_CONVEX_URL` · `VITE_SITE_BASENAME` · `VITE_VELSHOP_URL/_VELSELLER_URL/_VELCENTER_URL` · `VITE_SENTRY_DSN` (optional) · (อนาคต) `PAYMENT_SECRET`/`SHIPPING_API_KEY`
> `.env.example` ถูก platform บล็อก — template อยู่ใน docs/ENVIRONMENT.md

## 9. Production deployment checklist

- [x] Build/typecheck/tests ผ่าน (58)
- [x] Security: no secrets in git · AppError codes · rate limit · IDOR/ownership · upload ปลอดภัย · audit ครบ
- [x] Financial: ledger + snapshot + reconciliation script · commission/return/threshold จาก settings (0–100)
- [ ] Deploy ตาม `docs/production/deploy-runbook.md` STEP 1–10 (platform)
- [ ] Payment gateway จริง (Gravity)
- [ ] Carrier จริง (Gravity)
- [ ] E2E browser (Playwright) · legal pages · admin account · backup restore test · MFA

## 10. Recommended PHASE 14

1. **Payment integration จริง** — ผ่าน `PaymentProvider` (Omise/PromptPay QR/Stripe — Gravity Index) + webhook (signature/idempotent) + refund จริง
2. **Carrier integration จริง** — ผ่าน `ShippingProvider` (Flash/Kerry/ไปรษณีย์) + auto-tracking webhook
3. **Migrate legacy Convex-table dashboard** (`Center.tsx`) ไป Neon/centerAdmin — single source of truth
4. **E2E browser suite** (Playwright) ตาม `docs/E2E-TESTING.md` 16 scenarios + CI (GitHub Actions: typecheck + test + deploy)
5. **Staging → soft launch** ตาม runbook (closed beta จำกัดวงเงิน) — แล้วจึง Production Ready
