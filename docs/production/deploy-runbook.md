# VELNOX — Production Deployment Runbook (spec §45–51, §68–70)

Version: 1.0 · Phase 12 — ใช้ตอน launch จริง (ต้องทำบน platform + เจ้าของ)

## 1. PRE-FLIGHT (ก่อนเริ่ม)

```bash
bun run predeploy        # typecheck + 55 tests + build (ต้องผ่าน 3 อย่าง)
# git status สะอาด + release tag (spec §47)
# backup ก่อน launch (spec §48): Neon backup + env backup (secure) — ห้าม commit secret
```

## 2. DEPLOYMENT ORDER (spec §45) — ห้ามสลับ

| STEP | อะไร | ตรวจหลังเสร็จ |
|---|---|---|
| 1 | **Production Database** — Neon prod: migration รัน + `db:smoke` + `db:consistency` ผ่าน | tables ครบ, consistency 0 issue |
| 2 | **Convex Backend** — `npx convex deploy` (prod deployment) | functions ready, `/health` → ok |
| 3 | **Authentication** — env: `SITE_URL` (prod domain), `JWT_PRIVATE_KEY`, `JWKS` + OTP relay | login/OTP ผ่านบน prod |
| 4 | **Storage** — `CLOUDINARY_*` prod env | upload signature ใช้ได้ |
| 5 | **VelShop** — Vercel project (env: `VITE_CONVEX_URL` → prod deployment, `VITE_SITE_BASENAME=""`, `VITE_VEL*_URL`) | เปิดเว็บ/login/product ผ่าน |
| 6 | **VelSeller** — Vercel project | login + dashboard ผ่าน |
| 7 | **VelCenter** — Vercel project | login (owner) + dashboard ผ่าน |
| 8 | **Main Velnox** — Vercel project (landing + links) | เปิด/ลิงก์ถูก |
| 9 | **DNS** — velnox.com + shop/seller/center.velnox.com → Vercel | HTTPS + redirect ถูก (spec §29) |
| 10 | **E2E** — smoke test (ข้อ 3) + `db:consistency` | ผ่านทั้งหมด |

> ระหว่าง STEP 1–8: feature freeze (spec §46) — เฉพาะ bug/security/deploy fix

## 3. PRODUCTION SMOKE TEST (spec §51) — หลัง deploy ทุกครั้ง

```
1. เปิด 4 เว็บ (200, HTTPS)
2. login (customer) + OTP
3. API/action ทดสอบ (catalog, product detail)
4. db query (smoke + consistency)
5. สร้าง test product (seller) → เห็นใน shop
6. สร้าง test order (วงเงินต่ำ, ระบุเป็น TEST)
7. verify payment (manual provider: PENDING → paid)
8. verify seller income + commission
9. verify center dashboard + audit log
critical flow fail → ROLLBACK (docs/production/rollback.md)
```

## 4. FIRST PRODUCTION ORDER (spec §68)

หลังเปิด: สร้าง order จริงจำนวนน้อย → ตรวจทุกขั้น (customer → cart → checkout → payment → order → seller → shipping → delivery → revenue → company commission) + ข้อมูลตรงในทุกระบบ (ledger/commissions/seller_balances)

## 5. POST-LAUNCH MONITORING (spec §70)

| ระยะ | ตรวจ |
|---|---|
| 1 ชม. | errors (Sentry), error rate |
| 6 ชม. | orders/payments, failed checkout |
| 24 ชม. | **financial reconciliation** (`db:consistency` + GMV = orders) |
| 7 วัน | GMV, orders, returns, refunds, seller revenue, company revenue, system errors |

## 6. กฎ

- ห้ามแก้ database production โดยตรง — ทุกแก้ไขผ่านระบบ + audit (spec §69)
- Production credentials/DB/Convex/Vercel/DNS จำกัดเฉพาะผู้มีสิทธิ์ (spec §53)
- Test data แยกจาก production data (spec §52)
