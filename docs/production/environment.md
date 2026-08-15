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
