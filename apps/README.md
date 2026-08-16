# Velnox Apps

Velnox ทำงานเป็นระบบนิเวศ 4 เว็บแอปพลิเคชันจาก **repo เดียว** (หนึ่ง Convex backend + หนึ่ง Neon database):

| App | บทบาท | Domain | Entry HTML | Build script | Vercel project |
|---|---|---|---|---|---|
| **corporate** | เว็บไซต์องค์กร Velnox Group | velnox.com | `corporate.html` → `src/sites/corporate/` | `bun run build:corporate` | velnox-corporate |
| **shop** | VelShop — หน้าร้านลูกค้า | shop.velnox.com | `velshop.html` → `src/sites/velshop/` | `bun run build:shop` | velnox-shop |
| **seller** | VelSeller — เครื่องมือร้านค้า | seller.velnox.com | `velseller.html` → `src/sites/velseller/` | `bun run build:seller` | velnox-seller |
| **center** | VelCenter — ศูนย์กลางบริษัท (noindex) | center.velnox.com | `velcenter.html` → `src/sites/velcenter/` | `bun run build:center` | velnox-center |

## ทำไม apps/* แต่ละโฟลเดอร์ถึงไม่มี source ของตัวเอง?

โปรเจกต์นี้เป็น **Vite multi-entry เดียว** ที่ build แยกได้ 4 app แล้วผ่าน HTML entry
ที่แยกกัน (`corporate.html` / `velshop.html` / `velseller.html` / `velcenter.html`)
และ per-app Vite config (`vite.config.<app>.ts`) — ดู `docs/RESTRUCTURE_INVENTORY.md` §16

การย้าย source จริงเข้า `apps/*/src` ทางกายภาพ:
- ต้องแก้ alias `@/*`, tsconfig ทั้งหมด, vite config, convex.json → เสี่ยงพังระบบที่ทำงานได้
- **ไม่เพิ่มความสามารถ** — deploy แยกได้อยู่แล้ว

โฟลเดอร์ `apps/*` จึงเป็น **contract/ชั้น mapping** สำหรับ deploy — ยกเว้น `apps/shop`
ซึ่งเป็น **Bun workspace app จริง** (มี `package.json` + `vite.config.ts` + `vercel.json`)
สำหรับ Vercel Project `velnox-shop` ที่ใช้ **Root Directory: `apps/shop`**
(`apps/shop/vite.config.ts` ชี้ `root` กลับไปที่ repo root เพื่อ build VelShop ตัวจริง
จาก shared source — ดู README ในโฟลเดอร์นั้น)

## Vercel — 4 projects จาก repo เดียว

- Git repository: เดียวกันทั้ง 4 projects
- **velnox-shop:** Root Directory `apps/shop` · Build `bun run build` · Output `dist`
- **velnox-seller / velnox-center / velnox-corporate:** Root Directory `/` + per-project
  Build Command `bun run build:seller` / `build:center` / `build:corporate` · Output `dist`
- **Install Command (ทุก project):** `bun install` (hoisted — Bun workspace ที่ root)
- **Env (ทุก project):** `VITE_CONVEX_URL` (Convex production URL) · `VITE_*_URL` → โดเมนจริง · `VITE_SITE_BASENAME=""`
  - Convex env (ไม่ใช่ Vercel): `DATABASE_URL`, `CLOUDINARY_*`, `JWT_PRIVATE_KEY`, `SITE_URL`
- **Security headers:** `vercel.json` — root ใช้กับ project ที่ Root `/`; `apps/shop/vercel.json`
  (CSP/HSTS/XFO... + rewrite ไป `velshop.html`) ใช้กับ velnox-shop
- VelCenter: อย่าลืมว่า `velcenter.html` มี `<meta robots=noindex>` (ห้าม index)
