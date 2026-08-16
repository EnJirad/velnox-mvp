# VELNOX — Environment (production reference)

Version: 1.0 · Phase 9 — รายละเอียดเต็ม: [`../ENVIRONMENT.md`](../ENVIRONMENT.md)

## Convex deployment env (backend/auth runtime — ต้องมีใน Convex prod env)

| ตัวแปร | ใช้ทำอะไร | จำเป็น |
|---|---|---|
| `DATABASE_URL` | Neon connection (prod DB) | ✅ |
| `SITE_URL` | Auth redirects | ✅ |
| `JWT_PRIVATE_KEY` | Convex Auth signing | ✅ |
| `JWKS` | Convex Auth public keys | ✅ |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | product image storage | ✅ |
| `FREEBUFF_EMAIL_API_KEY` | OTP sign-in email (velshop) — server-only key | ✅ |
| `STRIPE_SECRET_KEY` | ชำระเงินออนไลน์ (วิธี "online" — บัตร/PromptPay, hosted Checkout) — ถ้าไม่มี วิธีนี้ถูกซ่อน + fallback manual | เปิดฟีเจอร์เท่านั้น |
| `STRIPE_WEBHOOK_SECRET` | verify signature webhook `/stripe/webhook` (Stripe Dashboard ต้องตั้ง endpoint ชี้ `<convex-url>/stripe/webhook`) | เปิดฟีเจอร์เท่านั้น |
| `BOOTSTRAP_OWNER_SECRET` | รหัสเปิดใช้งานเจ้าของบริษัทครั้งเดียว (velcenter) — ≥16 ตัวอักษร, ใช้แล้วปิดถาวร (มี owner แล้วใช้ซ้ำไม่ได้) | ตั้งก่อนเปิด velcenter ครั้งแรก |

## Vercel env (frontend — ต่อ VITE_ เท่านั้น ไม่อย่างนั้นห้าม expose)

| ตัวแปร | ใช้ทำอะไร | จำเป็น |
|---|---|---|
| `VITE_CONVEX_URL` | Convex client URL | ✅ (หรือ convex auto-inject) |
| `VITE_SITE_BASENAME` | routing prefix ต่อ site (`/shop` `/seller` `/center`) | ✅ |
| `VITE_VELSHOP_URL` / `VITE_VELSELLER_URL` / `VITE_VELCENTER_URL` | cross-site redirect | ✅ |
| `VITE_SENTRY_DSN` | error monitoring (ไม่มี = no-op) | optional |
| `VITE_VLY_APP_ID` / `VITE_VLY_MONITORING_URL` | platform preview monitoring | platform-managed |

## กฎ (spec §6, §38, §51)

- Dev / preview / prod แยก env — **ห้าม dev DB ใน prod**
- Production credentials ห้ามใช้ใน dev (sandbox/test key แยก)
- ห้าม commit `.env*` — อยู่ใน `.gitignore`; ตั้งค่าผ่าน Keys/API keys UI
- ห้าม expose secret ผ่าน `VITE_*` (มีแค่ค่าที่ client ควรเห็น)
