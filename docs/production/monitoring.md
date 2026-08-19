# VELNOX — Monitoring & Alerting (spec §46–47)

Version: 1.0 · Phase 9

## 1. Error tracking — Sentry (frontend + boundary)

- SDK: `@sentry/react` (ติดตั้งแล้ว)
- เปิดใช้งานเมื่อมี `VITE_SENTRY_DSN` ใน Keys/API keys UI — **ไม่มี DSN = no-op** (แอปทำงานปกติ)
- จุด capture:
  - `RootErrorBoundary.componentDidCatch` → `captureError()` (ทุกเว็บ — root `src/main.tsx`, vel shop/seller/center entries)
  - `window error / unhandledrejection` — platform Vly instrumentation มีอยู่แล้ว; Sentry ต่อได้เพิ่มเติมผ่าน `Sentry.init` integrations
- `sendDefaultPii: false` — ไม่ส่ง PII; environment = production/development อัตโนมัติ
- Env: `VITE_SENTRY_DSN` (Sentry project → Client Keys (DSN))

> การ capture error จาก Convex actions (server-side): เพิ่ม `Sentry.captureException` ใน action wrapper/catch ได้ในเฟสถัดไป — หรือใช้ Convex observability (deployment metrics) ที่มีใน dashboard

## 2. Health & uptime

- `GET <convex-url>/health` → `{ "status": "ok" }` (มีแล้วใน `src/convex/http.ts`)
- ตั้ง uptime check (UptimeRobot / Vercel monitoring) กับ 4 URLs (main + 3 เว็บ) + `/health`

## 3. Metrics ที่ต้องติดตาม (spec §46)

| กลุ่ม | Metric | แหล่ง |
|---|---|---|
| Error rate | frontend JS errors, API/action failures | Sentry |
| Latency | action/query latency | Convex dashboard (functions) |
| Database health | connection errors, slow queries | Neon dashboard + `db:consistency` |
| Auth | login/OTP failures spike | Convex auth logs + rate-limit hits |
| Payment | failed payments (เมื่อมี gateway) | payments table status=failed |
| Order | order creation failure, checkout errors | business events (`intelligence.recordBusinessEvent`) |

## 4. Alerts (spec §47) — ตั้งเมื่อ platform พร้อม

| Alert | Threshold (ตัวอย่าง) | ช่องทาง |
|---|---|---|
| Payment failure spike | ≥ 5 failed/min ติดต่อ 5 นาที | Sentry alert → email/Slack |
| Database failure | `/health` fail ≥ 3 ครั้ง | uptime provider |
| Backend downtime | Convex deployment unhealthy | Convex dashboard |
| Auth failure spike | OTP verify fail อัตราสูงผิดปกติ | Sentry |
| Order creation failure | `OrderCreated` event หาย/error | cron check + Sentry |
| Webhook failure | retry เกิน N ครั้ง | webhook provider (เมื่อมี) |
| Error rate | > 2% ของ sessions | Sentry |

## 5. Logging (spec §48–49)

- ห้าม log: password, JWT, keys, payment credentials — ตรวจแล้ว (Phase 7)
- structured fields: `requestId` (เมื่อมี HTTP API จริง) / `userId` / `orderId` / `sellerId` — ใช้ Convex function args + business events เป็น trace ได้วันนี้
- ทุก action สำคัญมี `audit_logs` (actor/action/entity) — source of truth สำหรับ trace ธุรกรรม

## 6. TODO (ต้องทำบน platform ก่อน go-live)

- [ ] สร้าง Sentry project → เอา DSN ใส่ Keys UI (`VITE_SENTRY_DSN`)
- [ ] ตั้ง uptime check `/health` + 3 หน้าเว็บ
- [ ] ตั้ง alert ตามตาราง §4
- [ ] เชื่อม notification (email/Slack) ใน Sentry
