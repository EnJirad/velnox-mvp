# apps/center — VelCenter (center.velnox.com)

ศูนย์กลางธุรกิจภายในของ Velnox (spec §10) — **ไม่ใช่หน้าสาธารณะ**
เข้าถึงได้เฉพาะผู้ที่ auth + มี role/permission (owner / admin / staff + department scope)
— บังคับฝั่ง server ใน `src/convex/centerAdmin.ts` ทุก action

## จุดเชื่อม (mapping)

- Entry: `velcenter.html` (มี `<meta robots=noindex>` — ห้าม index)
- Bootstrap: `src/sites/velcenter/main.tsx` (`RequireRole role="center"`)
- Page: `src/pages/Center.tsx` — อ่านข้อมูลจริงจาก Neon ผ่าน `centerAdmin.ts` actions
  (marketOverview / ordersList / updateOrderStatus)
- RBAC: `src/backend/permissions.ts` + `src/backend/identity.ts`

## Build & Deploy (Vercel)

```bash
bun run build:center     # vite build --config vite.config.velcenter.ts
bun run dev:center
```

- Vercel project: `velnox-center` · Root `/` · Domain `center.velnox.com`
- ความปลอดภัย: auth → identity → company authorization → permission → audit log
  (ห้ามเปิด public self-registration)
