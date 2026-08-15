# PHASE-7-REPORT — Velnox Production Readiness Report

Version: 1.0 · Phase 7 · Date: 2026-08-15

> รายงานสรุปตาม spec §65 — สถานะจริงของแต่ละด้าน + known issues + blockers
> ⚠️ ยังไม่ประกาศ "Production Ready" — ดู §11 Production Blockers / ข้อต้องทำก่อนเปิด

---

## 1. Architecture Status

- ✅ 4 เว็บ (Main/VelShop/VelSeller/VelCenter) แชร์: Convex deployment เดียว · Neon เดียว · Auth เดียว · UI/backend/convex กลาง
- ✅ Frontend เรียกผ่าน Convex node actions เท่านั้น — ไม่มี business logic ซ้ำใน UI
- ✅ Neon = commerce source of truth · Convex = intelligence/realtime (ไม่ duplicate)
- ⚠️ โครงสร้างไม่ใช่ monorepo apps/ (decision บันทึกใน AUDIT §1 — ไม่ refactor ใน Phase 7)

## 2. Build Status

- ✅ `bun run build` (= `tsc -b && vite build`) ผ่าน — **ไม่มี convex dev/codegen ใน build** (§36/§40)
- ✅ `bunx convex dev --once` + `bunx tsc -b --noEmit` ผ่าน
- ✅ Build ไม่ต้อง interactive login

## 3. Test Status

- ✅ **48 unit tests ผ่าน** (`bun test`): commission 3% (§60) · return penalty 10% threshold (§61) · GPS (§62) · order state machine (§18) · IDOR/security matrix (§63) · shipping/payment provider contracts · VelRepeat scheduling
- ✅ lint config มี (eslint) — ไม่ได้รัน full lint ครบทุกไฟล์ในรอบนี้ (ระบุเป็นงานก่อนเปิด)
- ⏳ E2E browser test: แผน + scenario ครบ (`docs/E2E-TESTING.md`) — ยังไม่ได้รันจริงกับ browser (ไม่มี Playwright)

## 4. Security Status

- ✅ Auth: Email OTP + guest (Convex Auth) · session httpOnly · ไม่มี token ใน localStorage
- ✅ Authorization: backend guards + test matrix (customer/seller/staff/admin/owner)
- ✅ IDOR: tests + ownership checks ทุก action
- ✅ Validation: zod กลาง — GPS range/pair, quantity ≥ 1, price ≥ 0, file upload (MIME/size)
- ✅ Rate limiting (ใหม่): checkout/review/return/subscribe/cancel — fixed window ฝั่ง Convex
- ✅ Audit log: ครอบ action สำคัญ (เพิ่ม order status/cancel/checkout/return/shop location ใน Phase 6–7)
- ✅ Error: codes กลาง + ไม่ leak stack trace/secret
- ✅ **Dependency advisories**: critical @auth/core แก้แล้ว (0.41.3) · react-router CSRF แก้แล้ว (7.18.2)
- ⚠️ เหลือ dev/build-time advisories (eslint→js-yaml/brace-expansion · vite→postcss/nanoid · @ai-sdk low) — ไม่เข้า production bundle
- ⚠️ KNOWN: OTP relay `x-api-key` ใน emailOtp.ts (platform template, read-only) — ดู SECURITY.md §10

## 5. Deployment Status

- ✅ 4 เว็บ build/deploy แยกได้ (Vercel) — วิธีใน `docs/DEPLOYMENT.md`
- ✅ Convex production deploy: `npx convex deploy --cmd 'bun run build' --prod`
- ✅ Rollback procedure + preview/PR environment + smoke test plan
- ⏳ ยังไม่ได้ตั้ง domain จริง (velnox.com ฯลฯ) / SSL / production monitoring — ต้องทำที่ hosting platform

## 6. Database Status

- ✅ Schema + migrations idempotent · indexes ครบ · constraints ครบ (status/price/stock/GPS/unique)
- ✅ Transaction-safe checkout + inventory reserve + idempotency_key (§17/§51)
- ✅ Backup/recovery strategy เอกสารแล้ว (`docs/DATABASE-RECOVERY.md`)
- ⏳ ยังไม่เปิด/ตรวจ PITR retention + scheduled dump (ต้องตั้งที่ Neon console)

## 7. Convex Status

- ✅ `convex dev --once` ผ่าน · production build ไม่ต้อง login
- ✅ Health endpoint `GET /health` (ใหม่) · rate limit tables (ใหม่)
- ✅ 3 frontends ใช้ deployment เดียว — ผู้ใช้ login ครั้งเดียวใช้ได้ทุกเว็บ (§55)

## 8. Authentication Status

- ✅ Register/Login/Logout/Session/Protected routes — ใช้ได้ (ใช้อยู่จริงใน VelShop)
- ✅ Role guards backend (seller/staff/admin/owner)
- ⏳ OTP email relay ขึ้นอยู่กับ platform service (freebuff) — ต้อง verify ส่งถึงจริงก่อนเปิด

## 9. Known Issues

1. Dev-time dependency advisories (ไม่กระทบ bundle) — อัปเดตเมื่อ eslint/vite major ปลอดภัย
2. Product variants — ตารางพร้อม, ยังไม่มี service/UI (VelSeller)
3. Products ยังไม่ลิงก์ `category_id` — /shop/categories นับ 0 จริงจนกว่า seller form ตั้งค่า
4. Payment/Carrier เป็น manual provider — abstraction พร้อม, gateway จริง Phase 9/10
5. ไม่มี IP-level rate limit บน auth endpoints (Convex Auth มี built-in; app limiter ครอบ write actions)
6. E2E ยังเป็น manual (ไม่มี Playwright)
7. OTP relay key ใน template (read-only) — ตามแพลตฟอร์ม

## 10. Remaining TODO (ก่อน/หลังเปิด)

- [ ] ตั้ง domain + SSL + Vercel projects จริง (4 เว็บ)
- [ ] ตั้ง Neon PITR/snapshot + scheduled dump + ทดสอบ restore
- [ ] ตั้ง monitoring/alerting (Convex dashboard, Vercel Analytics, Neon insights)
- [ ] E2E browser test (Playwright หรือ manual ตาม E2E-TESTING.md)
- [ ] เลือก payment gateway (Omise/Stripe — Gravity Index) + carrier API
- [ ] seller form: variants + category_id + shop location UI (MapPicker)
- [ ] OTP flow verify จริง + rate limit auth ฝั่ง IP

## 11. Production Blockers (§66)

**ไม่มี blocker ระดับ critical ที่พบในโค้ด/บิลด์** หลังแก้ advisory แล้ว:
- ✅ Auth ไม่ broken · Authorization ไม่ broken · ไม่มี payment duplication (idempotency + payment_status guard)
- ✅ Inventory race protected (FOR UPDATE + reserve) · ไม่มี secret ใหม่ใน git · financial math ตรวจแล้ว (tests)

**แต่ยังไม่ประกาศ Production Ready** เพราะยังต้องทำ (ไม่ใช่โค้ดบั๊ก แต่เป็นขั้นตอนเปิดจริง):
1. E2E browser test ยังไม่รันจริง
2. Domain/SSL/production monitoring ยังไม่ตั้ง
3. Payment gateway จริงยังไม่ได้เลือก/ต่อ (manual provider ใช้ได้ แต่ไม่มี charge จริง)
4. Carrier API ยังไม่ต่อ (manual tracking ใช้ได้)

→ เมื่อทำข้อ 1–4 + smoke test ผ่าน = Production Ready (อัปเดตเอกสารนี้)
