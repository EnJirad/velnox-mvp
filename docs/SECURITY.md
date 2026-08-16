# SECURITY — Velnox Security Model

Version: 1.0 · Phase 7

---

## 1. Authentication

- **Convex Auth** (Email OTP + Anonymous guest + **Password** สำหรับพนักงาน velcenter) — ระบบเดียวทั้ง 4 เว็บ (§55)
- OTP อายุ 15 นาที, 6 หลัก; Convex Auth มี built-in rate limiting สำหรับ sign-in/OTP
- **Password policy** (§9–§11): อย่างน้อย 8 ตัว, มีตัวอักษร + ตัวเลข; hash scrypt ใน `authAccounts` เท่านั้น — บริษัทไม่สามารถดูรหัสผ่านเดิมของใครได้ (`backend/passwords.ts`, `convex/employeeAuth.ts`)
- OTP email ใช้ `FREEBUFF_EMAIL_API_KEY` จาก Keys/API keys UI — **ห้าม hard-code key ในซอร์ส** (§69)
- Session จัดการโดย Convex (httpOnly cookie ฝั่ง backend) — **ไม่เก็บ token ใน localStorage** (§45)

## 2. Authorization Model (ทดสอบใน `tests/security.test.ts`)

ทุก write ผ่าน guard กลาง (`src/backend/identity.ts`):

| Guard | ใช้เมื่อ | ตรวจ |
|---|---|---|
| `requireIdentity` | customer writes | login + user row |
| `requireSeller` | seller writes | seller + shop ของตัวเอง |
| `requirePermission` | center writes | role + permission list |
| `requireCenter` | center reads | role = staff/admin/owner |

กฎ: **server เป็นผู้ตัดสินทุกอย่าง** — ไม่เชื่อ `userId`, `sellerId`, `price`, `role`, `commission` จาก client (§10)

### Test Matrix (§8)
| | CUSTOMER | SELLER | STAFF/ADMIN | OWNER |
|---|---|---|---|---|
| Shop browse / cart / checkout | ✅ | ✅ | — | — |
| Order ของตัวเอง | ✅ | ✅ (ของร้าน) | ตามสิทธิ์ | ✅ |
| Profile ของตัวเอง | ✅ | ✅ | ✅ | ✅ |
| Seller dashboard / product ของตัวเอง | ✗ | ✅ | ✗ | ✅ |
| VelCenter finance / settings | ✗ | ✗ | ตาม permission | ✅ |
| ข้อมูลคนอื่น / เงินบริษัท | ✗ | ✗ | ✗ (เกินสิทธิ์) | ✅ |

### IDOR protections (§9)
- Order: `orderDetail` ตรวจ `customer_user_id === user.id` — Customer A ดู order B ไม่ได้ (มี test)
- Product: `requireSellerProduct` ตรวจ chain Product → Shop → Seller
- Return/Notification/Wishlist/Cart: ทุก action ผูก user id ของ session
- Settings/Payout: `requirePermission` (owner/admin)

## 3. Input Validation (§11)

- zod schemas กลางใน `src/backend/validation.ts`:
  - email/phone รูปแบบ · quantity ≥ 1 (integer) · price ≥ 0 · SKU
  - **GPS**: lat ∈ [-90, 90], lng ∈ [-180, 180], ต้องเป็นคู่; default shipping address **ต้องมีพิกัด** (§21/§62)
- File upload (Cloudinary): ตรวจ MIME/extensions/ขนาด ≤ 5 MB ใน `saveProductImage` (backend re-validate — ไม่เชื่อ frontend) + signed upload params (§20/§36)

## 4. Money Security (§12/§13/§14)

- เงิน = NUMERIC(12,2) ใน Neon + `round2()` server-side — ไม่มี float arithmetic ในเงิน
- ราคา/ส่วนลด/ค่าจัดส่ง/commission **คำนวณใน backend เท่านั้น** (checkout อ่าน price จาก DB ใหม่ + FOR UPDATE — ราคาเปลี่ยน → แจ้ง "ราคาสินค้ามีการเปลี่ยนแปลง")
- Commission จาก `platform_settings` (default 3%) — **ไม่ hard-code**
- Return penalty: threshold 10% จาก settings — คำนวณส่วนเกิน server-side (`rules.ts` + tests)
- Ledger: append-only (แก้ = adjustment transaction) (§15/§30)

## 5. Order Integrity (§16/§48/§49)

- State machine กลาง (`canTransitionOrderStatus` + test) — DELIVERED → PROCESSING เป็นไปไม่ได้
- Checkout = 1 transaction: lock products → reserve inventory → snapshots (name/price/variant/address) → per-shop orders + commission → idempotency_key (double-click ไม่สร้าง order ซ้ำ §51)
- Inventory: `stock - reserved` atomic; cancel order → คืนสต็อก

## 6. Rate Limiting (§25) — ใหม่ใน Phase 7

- `src/convex/rateLimit.ts` + `rateLimits` table (Convex) — fixed window ต่อ (name, key)
- ครอบ: checkout 10/min · cancel_order 20/min · review 20/h · return 10/h · subscribe 20/h
- Convex Auth ครอบ OTP/sign-in อยู่แล้ว
- TODO: rate limit ฝั่ง IP สำหรับ auth endpoints เมื่อมี HTTP API จริง

## 7. Audit Log (§24/§39)

- `audit_logs` append-only — frontend แก้ไม่ได้ (มีแค่ backend insert)
- ครอบ: seller approve · product update/approve · settings change · refund · payout · **order status change · order cancel · checkout · return request · shop update/location** (เพิ่มใน Phase 6–7)
- VelCenter ดูผ่าน `listAuditLogs` (admin/owner)

## 8. Error Handling (§26/§37)

- Error codes กลาง (`src/backend/errors.ts`): AUTH_REQUIRED / FORBIDDEN / NOT_FOUND / INVALID_INPUT / OUT_OF_STOCK / INSUFFICIENT_STOCK / ADDRESS_GPS_REQUIRED / ...
- Client เห็นแค่ message ที่ปลอดภัย — **ไม่มี stack trace / DB error / secret**
- Frontend มี Error Boundary ระดับ root (`RootErrorBoundary`) + loading/empty/error state ทุกหน้า (§27/§28/§29)

## 9. Logging & Privacy (§22/§23)

- ห้าม log: password, JWT, keys, payment credentials — ตรวจสอบแล้วไม่มีใน code
- `console.error` เฉพาะ catch blocks (ไม่ leak payload)
- **Privacy**: customer ไม่เห็น seller email/phone/ที่อยู่ส่วนตัว (shop page แสดงแค่ข้อมูลที่อนุญาต); GPS เป็นข้อมูล private (§84/§85)

## 10. Secrets (§35/§55) — KNOWN ISSUE

- `.gitignore`: `.env.local`, `node_modules`, `dist`, `_generated` ✅
- **KNOWN**: `src/convex/auth/emailOtp.ts` มี `x-api-key` ของ freebuff OTP relay ฝังในไฟล์ template (platform-managed, read-only) — จำเป็นสำหรับ OTP flow ผ่าน platform; ไม่ใช่ secret ของเราเอง แต่ถ้า platform rotate key ต้องอัปเดตตามเอกสารของ platform
- ตรวจสอบแล้ว: ไม่มี private key / payment key / DB credential ใน source
- ถ้าเคย commit secret ขึ้น git history → **rotate ทันที**

## 11. CORS / HTTPS (§43/§44)

- ไม่มี HTTP backend แยก (ทั้ง 4 เว็บคุย Convex โดยตรง — server-side calls จาก node actions ไม่มี CORS issue)
- Convex จัด HTTPS + CORS ให้สำหรับ http actions (auth routes) ตาม deployment
- ถ้าเพิ่ม API server กลางในอนาคต: CORS whitelist = `velnox.com`, `shop/seller/center.velnox.com` เท่านั้น — **ห้าม `*` ใน production**
- Webhook (Phase 9/10): ต้อง verify signature + validate payload + idempotent + retry safely (§52)
