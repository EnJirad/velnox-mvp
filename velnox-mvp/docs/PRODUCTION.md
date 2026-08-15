# PRODUCTION — Velnox Production Readiness & Operations

Version: 1.0 · Phase 7

---

## 1. สิ่งที่ต้องพร้อมก่อนเปิดจริง (checklist §54)

### Build & Test
- [x] `bun run build` ผ่าน (tsc -b && vite build — ไม่ต้อง login Convex CLI)
- [x] `bunx convex dev --once` + `bunx tsc -b --noEmit` ผ่าน
- [x] Unit tests 48 ผ่าน (`bun test`) — business rules, state machine, security/IDOR, validation/GPS, providers, velrepeat
- [ ] E2E browser test ตาม `docs/E2E-TESTING.md` (manual ยังต้องทำจริงหลัง deploy)

### Auth & Security
- [x] Authentication ใช้งานได้ (Email OTP + guest)
- [x] Authorization matrix ถูกต้อง (backend guards + tests)
- [x] Critical dependency advisory แก้แล้ว (@auth/core 0.41.3, react-router 7.18.2)
- [x] Rate limiting สำหรับ write actions (checkout/review/return/subscribe/cancel)
- [x] Audit log ครอบ action สำคัญ
- [ ] Secret rotation policy: ตรวจ git history + rotate ถ้าเคย leak

### Database
- [x] Schema + migrations idempotent · indexes ครบ · constraints ครบ
- [x] Transaction-safe checkout (FOR UPDATE + reserve + idempotency)
- [x] Backup strategy → `docs/DATABASE-RECOVERY.md`
- [ ] เปิด/ตรวจ PITR retention บน Neon (ตามผู้ให้บริการ)

### Observability (§53)
- [x] Health endpoint: `GET <convex-url>/health` → `{"status":"ok"}`
- [ ] Monitoring (Vercel Analytics / Convex dashboard / Neon metrics): error rate, latency, failed payments/shipments, auth errors
- [ ] Alerting: ตั้งบน error threshold

### Deployment
- [x] Build ผ่านโดยไม่ interactive login
- [x] 4 เว็บ deploy แยกได้ (DEPLOYMENT.md)
- [ ] Domain + DNS + SSL ตาม DEPLOYMENT.md §7
- [ ] Post-deploy smoke test ตาม E2E-TESTING.md

## 2. Production Domains (§37/§43)

| Domain | App | หมายเหตุ |
|---|---|---|
| `velnox.com` | Main landing | ไม่มี business logic |
| `shop.velnox.com` | VelShop | customer |
| `seller.velnox.com` | VelSeller | merchant |
| `center.velnox.com` | VelCenter | company only (RBAC) |
| `api.velnox.com` | (อนาคต — ถ้ามี HTTP API แยก) | CORS whitelist เท่านั้น |

## 3. Environments (§52)

- **Development**: local + Freebuff preview — dev env
- **Staging**: PR/preview deployment + staging Convex + staging Neon branch — ทดสอบก่อน prod
- **Production**: prod Convex deployment + prod Neon — production env เท่านั้น
- ห้ามใช้ production secret ใน development

## 4. Monitoring & Health

- Health: `GET <convex-url>/health` — 200 + `{"status":"ok"}` (ไม่มี DB call — ไม่ง้อ database ในการ probe)
- ควร monitor: checkout error rate · payment fail · shipment fail · auth error · API latency (Convex dashboard) · DB slow query (Neon insights)

## 5. Rollback Procedure (§63)

ดู DEPLOYMENT.md §8 — Vercel deployment rollback + Convex redeploy ก่อนหน้า + migration backward-compatible (ห้าม drop column ที่ code เก่ายังใช้)

## 6. Known Production Blockers (จาก PHASE-7-REPORT)

ดู `docs/PHASE-7-REPORT.md` §11 — ปัจจุบัน **ไม่มี blocker ระดับ critical**; สิ่งที่ต้องทำก่อนเปิดคือ E2E browser test + domain/SSL + monitoring
