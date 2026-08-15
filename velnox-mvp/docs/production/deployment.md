# VELNOX — Deployment (production reference)

Version: 1.0 · Phase 9 — รายละเอียดเต็ม: [`../DEPLOYMENT.md`](../DEPLOYMENT.md)

## Vercel projects (spec §4–5)

| Project | Root dir | Build | Output | Basename |
|---|---|---|---|---|
| velnox-main | `.` | `bun run build` | `dist` | — |
| velnox-shop | `.` | `bun run build` | `dist` (`velshop.html`) | `/shop` |
| velnox-seller | `.` | `bun run build` | `dist` (`velseller.html`) | `/seller` |
| velnox-center | `.` | `bun run build` | `dist` (`velcenter.html`) | `/center` |

- 3 เว็บอยู่ใน **repo เดียว** (Vite multi-entry) — แต่ละ Vercel project ชี้ root เดียวกันแล้ว serve entry ต่างกันผ่าน env `VITE_SITE_BASENAME`
- **Build ไม่ต้อง login Convex** — `_generated` commit ไว้ (§8); `bun run build` = `tsc -b && vite build`
- ห้าม deploy root ผิด directory (spec §38)

## Deploy sequence ที่ปลอดภัย (zero-downtime)

```
1. Neon migration (backward-compatible) → 2. Convex deploy → 3. Vercel (4 projects)
```

## Convex production (spec §7, §41)

- `npx convex deploy` — deployment env ต้องมี: `SITE_URL`, `JWT_PRIVATE_KEY`, `JWKS`, `DATABASE_URL`, `CLOUDINARY_*`
- ตรวจหลัง deploy: auth routes + `/health` + 1 action ทดสอบ
- Dev/preview/prod แยก deployment (ไม่ใช้ dev ใน prod)

## Env matrix: ดู `environment.md`
## Rollback: ดู `rollback.md`
