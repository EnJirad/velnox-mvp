# PHASE 12 RESULT — PRODUCTION DEPLOYMENT & LAUNCH

Version: 1.0 · Phase 12

> สถานะจริง: เฟสนี้ต้อง deploy บน platform (Vercel/Convex/DNS) ด้วย credentials ของเจ้าของ — ผมเตรียมทุกอย่างให้ deploy แบบ turnkey ได้แล้ว (predeploy gate, SEO, runbook) แต่ **ยังไม่ได้ deploy จริง** → รายงานสถานะตามจริง ไม่ประกาศ LIVE

---

## DEPLOYMENT

| ส่วน | URL | Status |
|---|---|---|
| Main | `https://velnox.com` | 🟡 PREPARED — ยังไม่ deploy (ต้อง Vercel project + DNS) |
| VelShop | `https://shop.velnox.com` | 🟡 PREPARED — ยังไม่ deploy |
| VelSeller | `https://seller.velnox.com` | 🟡 PREPARED — ยังไม่ deploy |
| VelCenter | `https://center.velnox.com` | 🟡 PREPARED — ยังไม่ deploy |
| Backend | Convex prod deployment | 🟡 PREPARED — ยังไม่ `convex deploy` |

## AUTH
Customer: **PASS** (code+tests) · Seller: **PASS** · Employee: **PASS** · Admin: **PASS**
(ต้องยืนยันบน prod env: SITE_URL/JWT_PRIVATE_KEY/JWKS — §11–13; **key ต้อง stable ห้ามสลับหลัง launch**)

## DATABASE
Production: **PASS (prep)** — Neon prod แยกจาก dev, migration backward-compatible, `db:smoke` + `db:consistency` พร้อม — ต้องรันจริงตอน STEP 1 (§45)

## PAYMENT
**PASS (manual provider)** — gateway จริงยังไม่ติด (Phase 9.5/13) · webhook signature ยังไม่มี · PENDING จนกว่าเงินถึงจริง (ไม่ fake)

## ORDER
**PASS** — state machine + idempotency + snapshot + single path (checkoutAction — ลบ legacy ไปแล้ว Phase 11)

## INVENTORY
**PASS** — atomic reserve + ไม่ติดลบ + cancel คืน stock

## FINANCIAL
**PASS** — ledger append-only + commission snapshot + reconciliation script (GMV = orders, commissions = ledger)

## SECURITY
**PASS** — headers (`vercel.json`), noindex แยก site, error codes, rate limit, IDOR/ownership ครอบ, secrets scan สะอาด

## MONITORING
**PASS (prep)** — Sentry ต่อแล้ว (no-op ไม่มี DSN) + `/health` + alert plan (`docs/production/monitoring.md`) — ต้องใส่ DSN + ตั้ง alert

## E2E
**PASS (unit/integration 55 tests)** — browser E2E ยังไม่รัน (ต้อง Playwright + prod)

## PRODUCTION
**NOT READY** — ยังต้อง: deploy ตาม runbook (`docs/production/deploy-runbook.md`), payment gateway จริง, E2E browser, legal pages, admin account จริง, backup restore test

---

## สิ่งที่ทำในเฟสนี้ (เตรียมให้ launch turnkey)

| งาน | ไฟล์ |
|---|---|
| **SEO/noindex** (§56–57): seller + center = `<meta robots noindex>`; shop/main index ได้ | `velseller.html` · `velcenter.html` |
| robots.txt + sitemap template (ยืนยัน domain ก่อน launch) | `public/robots.txt` · `public/sitemap.xml` |
| **pre-deploy gate**: `bun run predeploy` = typecheck + 55 tests + build | `package.json` |
| **Deployment runbook**: ลำดับ 10 STEP (§45) + backup ก่อน launch (§48) + smoke test (§51) + first production order (§68) + post-launch monitoring 1ชม/6ชม/24ชม/7วัน (§70) + feature freeze (§46) + production access control (§53) | `docs/production/deploy-runbook.md` |

## Verification
`bun run predeploy` (typecheck ✅ · 55 tests ✅ · build ✅) · ซิงก์ velnox-mvp/ ครบ

## Remaining (ต้องเจ้าของ + platform)
1. ทำตาม runbook STEP 1–10 ตามลำดับ — payment gateway กับ carrier เป็น blockers ใหญ่สุดก่อน launch จริง
2. ตั้ง prod env ครบ (Keys UI): DATABASE_URL, Cloudinary, SITE_URL, JWT_PRIVATE_KEY, JWKS, VITE_SENTRY_DSN
3. สร้าง admin account จริง + legal pages + backup restore test
4. E2E browser (Playwright) + closed beta (soft launch — spec §50)
