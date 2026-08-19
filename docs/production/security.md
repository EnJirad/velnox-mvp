# VELNOX — Security (production reference)

Version: 1.0 · Phase 9 — รายละเอียดเต็ม: [`../SECURITY.md`](../SECURITY.md)

## สรุปที่ทำแล้ว (Phase 5–8)

- Auth: Convex Auth OTP (httpOnly cookie, ไม่มี token ใน localStorage) + rate limit
- Authorization: guard กลาง (`requireIdentity/requireSeller/requirePermission/requireCenter`) — server ตัดสินทุกอย่าง
- IDOR: order/product/shop/address/cart/wishlist/notification ผูก ownership; seller ผ่าน chain Product→Shop→Seller
- Input validation: zod กลาง (GPS/price/quantity/email/phone); image upload re-validate MIME/size
- Money: backend คำนวณเท่านั้น (NUMERIC + round2); commission/return threshold จาก platform_settings
- Error: `AppError` codes กลาง — client เห็น safe message เท่านั้น
- Rate limit: checkout/cancel/review/return/subscribe + OTP
- Secrets: ไม่มี secret ใน git (ตรวจแล้ว); `.env*` ignored
- Audit: `audit_logs` append-only ครอบ action สำคัญ

## FINAL SECURITY REVIEW CHECKLIST (spec §84) — สถานะ

| รายการ | สถานะ |
|---|---|
| Secrets ไม่อยู่ใน Git | ✅ |
| Auth ทำงาน | ✅ (ตรวจ prod env หลัง deploy) |
| Authorization ทำงาน | ✅ (tests/security.test.ts) |
| IDOR ป้องกัน | ✅ (ตรวจโค้ด + SECURITY.md §2) |
| Rate limit | ✅ |
| Webhook security (signature/idempotent) | ⏳ ยังไม่มี webhook — ต้องทำพร้อม payment/carrier |
| Input validation | ✅ |
| XSS protection | 🟡 React escape โดย default; UGC (reviews/descriptions) render เป็น text — ห้าม dangerouslySetInnerHTML |
| CSRF | ✅ Convex Auth cookie handling (same-site) |
| Security headers | ⏳ Vercel headers config (CSP/X-Content-Type-Options/Referrer-Policy) — ตั้งใน vercel.json ตอน deploy |
| Logs ไม่มี secrets | ✅ (scan แล้ว) |

## หมายเหตุ VelCenter (spec §56)

- Center = ระบบ sensitive: ต้อง strong auth (Convex Auth) + RBAC (department permission) + audit — มีแล้ว
- MFA: ยังไม่มี — พิจารณาเพิ่มสำหรับ owner/admin (Phase 12 / auth provider)
- Admin account จริง: ห้าม admin@example.com/password ง่าย — สร้างบัญชี owner จริงก่อนเปิด (ดู production-architecture.md §5.11)
