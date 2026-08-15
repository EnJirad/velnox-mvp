# Velnox Apps

Velnox ทำงานเป็นระบบนิเวศ 4 เว็บแอปพลิเคชันจาก **repo เดียว** (หนึ่ง Convex backend + หนึ่ง Neon database):

| App | บทบาท | Domain | Entry HTML | Build script | Vercel project |
|---|---|---|---|---|---|
| **corporate** | เว็บไซต์องค์กร Velnox Group | velnox.com | `corporate.html` → `src/sites/corporate/` | `bun run build:corporate` | velnox-corporate |
| **shop** | VelShop — หน้าร้านลูกค้า | shop.velnox.com | `velshop.html` → `src/sites/velshop/` | `bun run build:shop` | velnox-shop |
| **seller** | VelSeller — เครื่องมือร้านค้า | seller.velnox.com | `velseller.html` → `src/sites/velseller/` | `bun run build:seller` | velnox-seller |
| **center** | VelCenter — ศูนย์กลางบริษัท (noindex) | center.velnox.com | `velcenter.html` → `src/sites/velcenter/` | `bun run build:center` | velnox-center |

## ทำไม apps/* แต่ละโฟลเดอร์ถึงมีแค่ README?

โปรเจกต์นี้เป็น **Vite multi-entry เดียว** ที่ build แยกได้ 4 app แล้วผ่าน HTML entry
ที่แยกกัน (`corporate.html` / `velshop.html` / `velseller.html` / `velcenter.html`)
และ per-app Vite config (`vite.config.<app>.ts`) — ดู `docs/RESTRUCTURE_INVENTORY.md` §16

การย้าย source จริงเข้า `apps/*/src` ทางกายภาพ:
- ต้องแก้ alias `@/*`, tsconfig ทั้งหมด, vite config, convex.json → เสี่ยงพังระบบที่ทำงานได้
- **ไม่เพิ่มความสามารถ** — deploy แยกได้อยู่แล้ว

โฟลเดอร์ `apps/*` จึงเป็น **contract/ชั้น mapping** สำหรับ deploy (Vercel root `/`
+ per-project build command) — ถ้าอนาคตต้องแยก app จริง ให้ย้ายทีละ app ตาม
`docs/RESTRUCTURE_INVENTORY.md` §16

## Vercel — 4 projects จาก repo เดียว

- Git repository: เดียวกันทั้ง 4 projects
- **Root Directory:** `/` (ราก repo)
- **Build Command:** `bun run build:corporate` / `build:shop` / `build:seller` / `build:center`
- **Output Directory:** `dist`
- **Install Command:** `bun install`
- **Env (ทุก project):** `VITE_CONVEX_URL` (Convex production URL) · `VITE_VEL*_URL` → โดเมนจริง · `VITE_SITE_BASENAME=""`
  - Convex env (ไม่ใช่ Vercel): `DATABASE_URL`, `CLOUDINARY_*`, `JWT_PRIVATE_KEY`, `SITE_URL`
- **Security headers:** ใช้ `vercel.json` ที่ root (CSP/HSTS/XFO...) กับทุก project
- VelCenter: อย่าลืมว่า `velcenter.html` มี `<meta robots=noindex>` (ห้าม index)
