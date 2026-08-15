# DEPLOYMENT — Velnox Deployment Guide

Version: 1.0 · Phase 7

> สรุปวิธี deploy ทั้ง 4 เว็บ + Convex + Neon + storage — build ต้องไม่ต้อง interactive login (§36/§40)

---

## 1. Architecture

```
velnox.com        → Main landing (index.html)
shop.velnox.com   → VelShop  (velshop.html)
seller.velnox.com → VelSeller (velseller.html)
center.velnox.com → VelCenter (velcenter.html)
                          │  ทั้งหมดชี้ Convex deployment เดียวกัน
                          ▼
                    Convex (node actions)
                          │
                          ▼
                    Neon PostgreSQL + Cloudinary
```

## 2. Build Command (ทุกเว็บเหมือนกัน)

```bash
bun install        # หรือ npm ci (มีทั้ง bun.lock และ package-lock.json)
bun run build      # = tsc -b && vite build  — ไม่มี convex codegen/dev
```

- `convex/_generated` ถูกสร้างโดย `npx convex deploy --cmd 'bun run build'` ก่อน build (ตามที่วางไว้ใน Phase 3) — **ไม่ต้อง login interactive**
- Local dev: `bunx convex dev --once` (non-interactive) แล้ว `bun run dev`

## 3. Vercel — 4 Projects (§37/§38)

สร้าง project แยก 4 ตัวชี้ repo เดียวกัน:

| Project | Root Directory | Build Command | Output Directory | Env |
|---|---|---|---|---|
| `velnox-main` | `/` | `bun run build` | `dist` | `VITE_CONVEX_URL` |
| `velnox-shop` | `/` | `bun run build` | `dist` | `VITE_CONVEX_URL` |
| `velnox-seller` | `/` | `bun run build` | `dist` | `VITE_CONVEX_URL` |
| `velnox-center` | `/` | `bun run build` | `dist` | `VITE_CONVEX_URL` |

- 4 project deploy จาก repo เดียวกัน (root เดียว) — ใช้ **monorepo-trigger ignore** หรือ deploy ตาม branch ต่างกันก็ได้; ที่สำคัญคือ env `VITE_CONVEX_URL` ชี้ deployment เดียวกัน
- ถ้าจะแยก root จริง (monorepo) — ยังเป็นงาน Phase อนาคต (ดู AUDIT §1)

## 4. Convex Deployment

```bash
# production deployment (จาก CI หรือ local ด้วย token)
npx convex deploy --cmd 'bun run build' --prod
```

- Convex env (Keys UI): `DATABASE_URL`, `CLOUDINARY_*` ตั้งที่ deployment นั้น
- Auth env (`JWT_PRIVATE_KEY`, `JWKS`) — Convex Auth จัดการให้ผ่าน deployment
- Deployment แยก dev/staging/prod ได้ใน project เดียวกัน (environments)

## 5. Database (Neon)

- Migration: `bun run db:migrate` (idempotent — schema.sql + migrations)
- **รัน migration ก่อน deploy code ที่ใช้คอลัมน์ใหม่** (§54 checklist)
- Backup/Recovery: ดู `docs/DATABASE-RECOVERY.md`

## 6. Preview / PR Environments (§42)

- Vercel preview auto-generate ต่อ PR (env จาก project — ควรชี้ staging Convex deployment)
- Convex preview: `npx convex dev` ฝั่ง CI หรือ deployment per branch — ทดสอบ frontend+backend+convex ไม่กระทบ production

## 7. Domains / DNS / SSL (§43)

- ตั้ง custom domains ใน Vercel project: `velnox.com`, `shop.velnox.com`, `seller.velnox.com`, `center.velnox.com`
- Vercel ให้ SSL/HTTPS อัตโนมัติ (Let's Encrypt)
- ถ้ามี API server แยก `api.velnox.com` ในอนาคต → ตั้ง CORS whitelist ตาม SECURITY.md §11

## 8. Rollback (§63)

1. Detect (monitoring + health check `GET <convex-url>/health`)
2. Stop rollout (Vercel: ใช้ production deployment ก่อนหน้า)
3. Rollback → Verify → Investigate → Fix → Redeploy
4. Convex: `npx convex deploy` version ก่อนหน้า (Convex รองรับ redeploy history)

## 9. Post-Deploy Smoke Test (§62)

เปิดทั้ง 4 เว็บ: homepage · login (OTP) · product/cart/checkout (staging data หรือ test seller) · center dashboard — ตาม `docs/E2E-TESTING.md`
