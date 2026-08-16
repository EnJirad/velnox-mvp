# 📖 คู่มือติดตั้งและใช้งาน Velnox (velnox-mvp)

> Velnox — **Commerce that remembers you · จำแทนคุณ**
> โปรเจกต์นี้เป็น 1 codebase → 3 เว็บไซต์แยก deploy กัน (velshop / velseller / velcenter)
> แต่ใช้ **Convex backend + ฐานข้อมูลชุดเดียวกัน**

---

## 📑 สารบัญ

1. [ภาพรวม](#1-ภาพรวม)
2. [ความต้องการของระบบ](#2-ความต้องการของระบบ)
3. [การติดตั้งทีละขั้นตอน](#3-การติดตั้งทีละขั้นตอน)
4. [Environment Variables (ตัวแปรสภาพแวดล้อม)](#4-environment-variables)
5. [การใช้งาน](#5-การใช้งาน)
6. [การ Deploy ขึ้น Vercel (แยก 3 เว็บ)](#6-การ-deploy-ขึ้น-vercel-แยก-3-เว็บ)
7. [ปัญหาที่พบบ่อย (Troubleshooting)](#7-ปัญหาที่พบบ่อย)
8. [การ push ขึ้น GitHub](#8-การ-push-ขึ้น-github)

---

## 1. ภาพรวม

```
        ┌────────────────────────────────────────────────┐
        │   Convex Backend + ฐานข้อมูลเดียวกัน (deploy ครั้งเดียว)  │
        │   users · products · orders · subscriptions ·     │
        │   productViews (VelRepeat) · goals ...            │
        └────────────────────────────────────────────────┘
              ▲                    ▲                    ▲
      deploy คนละที่      deploy คนละที่      deploy คนละที่
        ┌──────────┐      ┌──────────┐      ┌──────────────┐
        │  velshop │      │ velseller│      │  velcenter   │
        │   ตลาด   │      │  พ่อค้า   │      │  บริษัทเท่านั้น │
        └──────────┘      └──────────┘      └──────────────┘
```

| เว็บ | Entry | ใครใช้ | ใช้ทำอะไร |
|---|---|---|---|
| **velshop** | `velshop.html` | ลูกค้า (ทุกคน) | ตลาดซื้อขายสไตล์ Shopee — ดูสินค้า, ตะกร้า, สั่งซื้อ, สั่งรายเดือน, ติดตามออเดอร์, ระบบแนะนำสินค้า (VelRepeat) |
| **velseller** | `velseller.html` | พ่อค้าที่เปิดร้านกับเรา | หลังบ้านของร้านตัวเอง — สินค้า, สต็อก, Smart Reorder, ออเดอร์ของตัวเอง, รายได้ + ค่าธรรมเนียม 3% |
| **velcenter** | `velcenter.html` | เฉพาะบริษัท (owner / admin / staff) | ภาพรวมทั้งบริษัท, ออเดอร์ทุกตลาด, Intelligence, จัดการพนักงาน + แยกสิทธิ์ตามยศ |

### Tech Stack

- **React 19 + TypeScript + Vite 7** (multi-page build: 4 entries — portal + 3 เว็บ)
- **Convex** — backend + database (deployment เดียวสำหรับทั้ง 3 เว็บ)
- **Convex Auth** — เข้าสู่ระบบด้วย Email OTP + ผู้เยี่ยมชม (anonymous)
- **Tailwind CSS v4 + shadcn/ui + Framer Motion**
- **Bun** — package manager (ใช้ `npm` ได้แต่แนะนำ Bun)

---

## 2. ความต้องการของระบบ

| สิ่งที่ต้องมี | เวอร์ชัน | หมายเหตุ |
|---|---|---|
| **Bun** | 1.2+ | เช็คด้วย `bun --version` — ติดตั้งจาก https://bun.sh |
| Node.js | 20.19+ หรือ 22.12+ | Vite 7 กำหนดขั้นต่ำ (ถ้าใช้ npm แทน bun) |
| บัญชี Convex | ฟรี | https://convex.dev — ใช้สร้าง deployment (database) |
| บัญชี Neon (PostgreSQL) | ฟรี | https://neon.tech — **Commerce Core / Source of Truth** (สินค้า ออเดอร์ เงิน สต็อก) |
| บัญชี Cloudinary | ฟรี | https://cloudinary.com — เก็บรูปสินค้า (upload ตรงจากเบราว์เซอร์ ไม่ผ่าน server) |
| บัญชี GitHub | — | เฉพาะตอน push ขึ้น git |
| บัญชี Vercel | ฟรี | https://vercel.com — ใช้ deploy หน้าเว็บ 3 อัน (ดูหัวข้อ 6) |

---

## 3. การติดตั้งทีละขั้นตอน

### ขั้นที่ 1 — ดาวน์โหลดโค้ด

```bash
git clone https://github.com/EnJirad/velnox-mvp.git
cd velnox-mvp
```

### ขั้นที่ 2 — ติดตั้ง dependencies

```bash
bun install
```

### ขั้นที่ 3 — สร้าง Convex deployment (ฐานข้อมูล)

สร้าง deployment ใหม่ที่ https://dashboard.convex.dev (หรือรันคำสั่งด้านล่างแล้วทำตาม prompt):

```bash
bunx convex dev --once
```

- ครั้งแรกจะให้ login ด้วยบัญชี Convex
- เลือก **create a new deployment** (หรือเลือก deployment ที่มีอยู่)
- คำสั่งนี้จะ push schema + สร้างไฟล์ codegen (`src/convex/_generated/*`) ให้อัตโนมัติ

> หมายเหตุ: ห้าม commit โฟลเดอร์ `src/convex/_generated/` — อยู่ใน `.gitignore` แล้ว
> คนที่ clone ใหม่ต้องรัน `bun convex dev --once` เพื่อสร้างไฟล์พวกนี้

### ขั้นที่ 4 — ตั้งค่า Environment Variables

สร้างไฟล์ `.env.local` ที่ root ของโปรเจกต์:

```bash
# ---------- Client (Vite) ----------
VITE_CONVEX_URL=https://<your-deployment>.convex.cloud   # URL ของ Convex deployment (จำเป็น!)
VITE_VELSHOP_URL=/velshop.html      # โดเมนจริงของ velshop (ตอน dev ใช้ค่า default ได้)
VITE_VELSELLER_URL=/velseller.html  # โดเมนจริงของ velseller
VITE_VELCENTER_URL=/velcenter.html  # โดเมนจริงของ velcenter
VITE_SITE_BASENAME=                 # ปล่อยว่าง (router อยู่ที่ /)
```

> 💡 ถ้าทำงานบน **Freebuff**: `VITE_CONVEX_URL` และคีย์ auth ของ Convex ถูกตั้งให้อัตโนมัติแล้ว
> ผ่าน UI ของ Keys/API keys — ไม่ต้องแก้ `.env` เอง

### ขั้นที่ 5 — ตั้งค่า Neon + Cloudinary (Commerce Core + รูปสินค้า)

Commerce Core (สินค้า/ออเดอร์/เงิน/สต็อก) อยู่ใน **Neon PostgreSQL** และรูปสินค้าอัปโหลดผ่าน
**Cloudinary** — ตั้งค่าใน Convex deployment env (Freebuff: วางในแท็บ Keys/API keys):

```bash
# ---------- Neon (Commerce Core / Source of Truth) ----------
bunx convex env set DATABASE_URL "postgresql://<user>:<password>@<host>.neon.tech/<db>?sslmode=require"

# ---------- Cloudinary (product image upload) ----------
bunx convex env set CLOUDINARY_CLOUD_NAME "<cloud-name>"
bunx convex env set CLOUDINARY_API_KEY "<api-key>"
bunx convex env set CLOUDINARY_API_SECRET "<api-secret>"
```

จากนั้นสร้างตารางทั้ง 14 (รันซ้ำได้ — เป็น idempotent):

```bash
DATABASE_URL="<neon-connection-string>" bun run db:migrate   # สร้างตาราง Commerce Core
DATABASE_URL="<neon-connection-string>" bun run db:smoke     # ตรวจว่าตารางครบ (optional)
```

> รูปสินค้าถ้าอยากเริ่มขายได้ทันที ต้องครบทั้ง 3 ค่า Cloudinary — ถ้ายังไม่ตั้ง ระบบจะยังทำงานได้
> แต่ฟีเจอร์อัปโหลดรูปจะแจ้งว่ายังไม่ได้ตั้งค่า

### ขั้นที่ 6 — รันโปรเจกต์

```bash
bun convex dev --once   # push schema + codegen (รันทุกครั้งที่ดึงโค้ดใหม่)
bun run dev             # เปิด dev server ที่ http://localhost:5173
```

เปิดดู:

| หน้า | URL |
|---|---|
| Landing / portal | `http://localhost:5173/` |
| velshop (หน้าร้าน) | `http://localhost:5173/velshop.html` |
| velseller (หลังบ้านพ่อค้า) | `http://localhost:5173/velseller.html` |
| velcenter (หลังบ้านบริษัท) | `http://localhost:5173/velcenter.html` |

### ขั้นที่ 7 — ตรวจสอบโค้ด

```bash
bun tsc -b --noEmit     # typecheck (ต้องผ่าน ไม่มี error)
bun run build           # build production (ได้ไฟล์แยก 4 entries ใน dist/)
```

---

## 4. Environment Variables

### Client (Vite — ใส่ใน `.env.local` หรือผ่าน UI ของแพลตฟอร์ม)

| ตัวแปร | จำเป็น? | คำอธิบาย |
|---|---|---|
| `VITE_CONVEX_URL` | ✅ | URL ของ Convex deployment (เช่น `https://happy-otter-123.convex.cloud`) |
| `VITE_VELSHOP_URL` | ❌ | URL จริงของเว็บ velshop — default `/velshop.html` |
| `VITE_VELSELLER_URL` | ❌ | URL จริงของเว็บ velseller — default `/velseller.html` |
| `VITE_VELCENTER_URL` | ❌ | URL จริงของเว็บ velcenter — default `/velcenter.html` |
| `VITE_SITE_BASENAME` | ❌ | Router basename — **ปล่อยว่าง** เมื่อ deploy ที่ root โดเมน (เช่น velshop.com) |

### Backend (Convex — ตั้งด้วย `bunx convex env set <ชื่อ> <ค่า>`)

| ตัวแปร | จำเป็น? | คำอธิบาย |
|---|---|---|
| `DATABASE_URL` | ✅ (Commerce) | Neon connection string — **Commerce Core** (สินค้า ออเดอร์ เงิน สต็อก ฯลฯ) |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | ✅ (อัปโหลดรูป) | Cloudinary — เก็บรูปสินค้า (upload ตรงจากเบราว์เซอร์ ผ่าน signed params) |
| `JWKS` | ✅ | คีย์ของ Convex Auth (สร้างอัตโนมัติใน Freebuff) |
| `JWT_PRIVATE_KEY` | ✅ | คีย์ JWT ของ Convex Auth (สร้างอัตโนมัติใน Freebuff) |
| `SITE_URL` | ❌ | โดเมนของเว็บ (ใช้สร้างลิงก์ในอีเมล) เช่น `http://localhost:5173` |
| `VLY_INTEGRATION_KEY` | ❌ | คีย์สำหรับ AI / Email / Payment integrations (ดู `integrations.md`) |

---

## 5. การใช้งาน

### 5.1 บทบาทและสิทธิ์

| ยศ (role) | เข้า velshop | เข้า velseller | เข้า velcenter | จัดการพนักงาน |
|---|---|---|---|---|
| **customer** (ลูกค้า) | ✅ ซื้อของได้ | ❌ | ❌ | ❌ |
| **seller** (พ่อค้า) | ✅ ซื้อได้ | ✅ หลังบ้านร้านตัวเอง | ❌ | ❌ |
| **staff** (พนักงาน) | ✅ | ❌ | ✅ ดูข้อมูลอย่างเดียว (view-only) | ❌ |
| **admin** (ผู้ดูแลฝ่าย) | ✅ | ✅ | ✅ เห็นข้อมูลธุรกิจทั้งหมด + จัดการออเดอร์ | ❌ |
| **owner** (เจ้าของบริษัท) | ✅ | ✅ | ✅ ทุกอย่าง | ✅ |

> ⚠️ **velcenter เข้าได้เฉพาะคนที่บริษัทให้สิทธิ์เท่านั้น** — ไม่มีระบบสมัครแอดมินเอง
> **คนแรกที่สมัครตอนยังไม่มีเจ้าของ จะได้เป็นเจ้าของ (owner) ถาวร** — หลังจากนั้นเจ้าของเป็นคนตั้งสิทธิ์ให้คนอื่น

### 5.2 การเข้าสู่ระบบ

- ไปที่ `/auth` บนเว็บใดก็ได้ (หรือกดปุ่ม "เข้าสู่ระบบ" บน landing)
- **Email OTP**: กรอกอีเมล → ระบบส่งรหัส 6 หลัก → กรอกรหัส → เข้าสู่ระบบ (สมัครอัตโนมัติถ้ายังไม่มีบัญชี)
- **ผู้เยี่ยมชม**: กด "เข้าสู่ระบบแบบผู้เยี่ยมชม" (ไม่ต้องมีอีเมล)
- ระบบจำบทบาทและพาไปยังเว็บที่ตรงกับบทบาทอัตโนมัติ (เช่น พ่อค้าล็อกอินที่ velshop → ไป velseller)

### 5.3 velshop — หน้าร้านสำหรับลูกค้า

1. **เรียกดูสินค้า** — ค้นหา / เลือกหมวดหมู่ / ดูสินค้ายอดนิยม
2. **สนใจสินค้า** — กดปุ่ม ❤️ "สนใจ" บนหน้ารายละเอียดสินค้า → Velnox จำไว้ว่าลูกค้าคนนี้ชอบอะไร (VelRepeat)
3. **สั่งซื้อ** — เพิ่มสินค้าเข้ารถเข็น → ไปหน้า checkout → ยืนยันออเดอร์
4. **สั่งรายเดือน** — กด "สั่งรายเดือน" เลือกรอบ (30/60/90 วัน) → ระบบจะสร้างออเดอร์ใหม่ให้อัตโนมัติเมื่อครบรอบ
5. **ติดตามออเดอร์** — หน้า "ออเดอร์ของฉัน" ดูสถานะ / ยกเลิก / สั่งซ้ำ 1 คลิก (จากประวัติที่ Velnox จำไว้)
6. **คำแนะนำเฉพาะตัว** — "แนะนำสำหรับคุณ" เลือกสินค้าให้จากคลิก + ประวัติสั่งซื้อของลูกค้าแต่ละคน

### 5.4 velseller — หลังบ้านสำหรับพ่อค้า

> เริ่มต้น: ไปที่ velseller → กด "เปิดร้านของฉัน" (เลื่อนบทบาทเป็น seller — MVP ยังเป็น self-serve)

1. **แดชบอร์ดเป้าหมาย** — ตั้งเป้าหมายยอดขาย สร้าง/แก้ไข/ลบ ดูความคืบหน้า
2. **สินค้าของฉัน** — เพิ่มสินค้าใหม่, แก้ไข, เปิด/ปิดการขาย, **อัปโหลดรูปสินค้า** (Cloudinary CDN: ตั้งรูปหลัก / จัดเรียง / ลบ — สูงสุด 10 รูป, 5 MB/รูป)
3. **Smart Reorder** — ระบบจำรอบการขายจริงของสินค้าแต่ละตัว เตือนเมื่อถึงเวลาเติมสต็อก + กดเติม 1 คลิก
4. **ออเดอร์ของร้าน** — เห็นเฉพาะออเดอร์ที่มีสินค้าของร้านตัวเอง + ออเดอร์รายเดือนของลูกค้า ("สร้างออเดอร์รอบครบกำหนด")
5. **รายได้** — คำนวณอัตโนมัติ:
   - ยอดขายรวม (ออเดอร์สำเร็จของร้านตัวเองเท่านั้น)
   - ยอดตีกลับ + อัตรา %
   - **ค่าธรรมเนียม 3% ต่อชิ้น** (นโยบาย Velnox)
   - ยอดรับจริง (หักค่าธรรมเนียม + หักค่าตีกลับเกินนโยบาย)
   - 📌 **นโยบายตีกลับ:** Velnox ครอบคลุมค่าตีกลับไม่เกิน **10%** ของยอดขาย — เกิน 10% ร้านรับผิดชอบส่วนต่าง (ระบบ flag เตือน)

### 5.5 velcenter — หลังบ้านบริษัท (เฉพาะผู้มีสิทธิ์)

1. **เป็นเจ้าของคนแรก** — ครั้งแรกที่เข้า velcenter (ตอนยังไม่มีเจ้าของ) จะเห็นปุ่ม "รับสิทธิ์เป็นเจ้าของบริษัท" → กดแล้วเป็น owner ถาวร
2. **ภาพรวม (owner/admin/staff)** — KPI ยอดขายรวมทุกตลาด, จำนวนออเดอร์, ยอดตีกลับ
3. **ออเดอร์ทุกตลาด** — ดูออเดอร์ทั้งหมดของบริษัท เปลี่ยนสถานะได้ (admin/owner)
4. **Intelligence** — คาดการณ์วันที่ลูกค้าจะสั่งครั้งถัดไป (จากรอบการสั่งจริง)
5. **สินค้า registry** — ดูสินค้าทั้งหมดในระบบ
6. **จัดการพนักงาน (owner เท่านั้น)** — ตั้งยศ + ฝ่าย (การตลาด/ฝ่ายขาย/ปฏิบัติการ/การเงิน/ทั่วไป) ให้พนักงาน
   - admin เห็นข้อมูลธุรกิจได้ทุกอย่าง แต่ **จัดการพนักงานไม่ได้**
   - staff ดูได้อย่างเดียว เปลี่ยนสถานะไม่ได้

---

## 6. การ Deploy ขึ้น Vercel (แยก 3 เว็บ)

### 6.0 สรุป: เอาไปรันที่ไหน

| ส่วน | ไปรันที่ไหน | ต้อง deploy เองไหม |
|---|---|---|
| **Frontend 3 เว็บ** (velshop / velseller / velcenter) | **Vercel** — ฟรี, auto-deploy จาก GitHub push, custom domain ฟรี | สร้าง 3 โปรเจกต์คนละอัน (ด้านล่าง) |
| **Backend + Realtime** (Convex) | **Convex (managed)** — push ผ่าน `npx convex deploy` ตอน build | ไม่ต้องรัน server เอง |
| **ฐานข้อมูล Commerce** (Neon PostgreSQL) | **Neon (managed)** — ตั้งค่าใน Convex deployment env | ไม่ต้อง deploy |
| **รูปสินค้า** (Cloudinary) | **Cloudinary (managed)** | ไม่ต้อง deploy |

> Vercel คือตัวเลือกหลักที่แนะนำ เพราะฟรี tier ครอบคลุมและ build command เดียว deploy ทั้ง Convex functions + หน้าเว็บ ทางเลือกอื่น (Netlify / Cloudflare Pages) ดูหัวข้อ **6.8**

### 6.1 โครงสร้างหลัง deploy

```
GitHub: EnJirad/velnox-mvp (repo เดียว)
   ├── Vercel Project "velshop"    → velshop.vercel.app   (ตลาด/ลูกค้า)
   ├── Vercel Project "velseller"  → velseller.vercel.app (หลังบ้านพ่อค้า)
   └── Vercel Project "velcenter"  → velcenter.vercel.app (หลังบ้านบริษัท)
              └── ทั้ง 3 ชี้ Convex production deployment ตัวเดียวกัน
                    └── Neon (Commerce Core) + Cloudinary (รูปสินค้า)
```

---

### 6.2 ขั้นที่ 1 — เตรียมฝั่ง Convex (ทำครั้งเดียว)

1. เปิด https://dashboard.convex.dev → เลือกโปรเจกต์ Velnox
2. สร้าง **production deployment** ถ้ายังไม่มี (Deployments → Create Production Deployment)
3. สร้าง **Production Deploy Key** เพื่อให้ Vercel push โค้ดขึ้น production ได้:
   - Deployment Settings → General → **Generate Production Deploy Key**
   - เปิดสิทธิ์ `deployment:deploy` → กด copy คีย์ไว้ (เอาไปใส่ Vercel ในขั้น 6.4)
4. ตั้ง env ให้ **production deployment** (Dashboard → deployment นั้น → Environment Variables หรือใช้คำสั่ง):

```bash
bunx convex env set DATABASE_URL "postgresql://<user>:<pass>@<host>.neon.tech/<db>?sslmode=require"
bunx convex env set CLOUDINARY_CLOUD_NAME "<cloud-name>"
bunx convex env set CLOUDINARY_API_KEY "<api-key>"
bunx convex env set CLOUDINARY_API_SECRET "<api-secret>"
bunx convex env set SITE_URL "https://velshop.vercel.app"   # ใช้สร้างลิงก์ในอีเมล
```

5. สร้างตาราง Neon (รันครั้งเดียว — รันซ้ำได้ idempotent):

```bash
DATABASE_URL="postgresql://<user>:<pass>@<host>.neon.tech/<db>?sslmode=require" bun run db:migrate
```

---

### 6.3 ขั้นที่ 2 — สร้าง 3 โปรเจกต์ใน Vercel

ไปที่ https://vercel.com/new → import repo `EnJirad/velnox-mvp` → ตั้งค่าตามตารางนี้ **3 ครั้ง** (ครั้งละ 1 โปรเจกต์):

| ตั้งค่า (Project Settings → General / Build & Development) | velshop | velseller | velcenter |
|---|---|---|---|
| Project Name | `velshop` | `velseller` | `velcenter` |
| Framework Preset | **Vite** | **Vite** | **Vite** |
| Root Directory | `./` | `./` | `./` |
| **Build Command** | `npx convex deploy --cmd-url-env-var-name VITE_CONVEX_URL --cmd 'bun run build'` | (เหมือนกัน) | (เหมือนกัน) |
| **Output Directory** | `dist` | `dist` | `dist` |
| Install Command | `bun install` | `bun install` | `bun install` |

> **Build command นี้ทำงาน 4 อย่าง**: ① สร้าง codegen `src/convex/_generated` ② push functions + schema ไป Convex production ③ ใส่ `VITE_CONVEX_URL` ให้อัตโนมัติตอน build ④ build หน้าเว็บลง `dist/`
> Vercel รองรับ `bun.lock` แบบ zero-config อยู่แล้ว แต่ตั้ง Install Command ไว้ชัดเจนปลอดภัยกว่า
> ถ้า Vercel หา `bun` ไม่เจอ ให้เปลี่ยน Build Command เป็น `npx convex deploy --cmd-url-env-var-name VITE_CONVEX_URL --cmd 'npm run build'`

---

### 6.4 ขั้นที่ 3 — Environment Variables (ตั้งเหมือนกันทั้ง 3 โปรเจกต์)

Vercel → Project → **Settings → Environment Variables**:

| ตัวแปร | ค่า | หมายเหตุ |
|---|---|---|
| `CONVEX_DEPLOY_KEY` | `<production deploy key จาก 6.2>` | ⚠️ ติ๊กเฉพาะ **Production** (uncheck Preview / Development) |
| `VITE_SITE_BASENAME` | *(ค่าว่าง)* | ให้ route ของทุกเว็บอยู่ที่ root โดเมน |
| `VITE_VELSHOP_URL` | `https://velshop.vercel.app` | ลิงก์ข้ามเว็บ (เปลี่ยนเป็น domain จริงหลังตั้ง custom domain) |
| `VITE_VELSELLER_URL` | `https://velseller.vercel.app` | |
| `VITE_VELCENTER_URL` | `https://velcenter.vercel.app` | |

> ✅ **ไม่ต้องตั้ง `VITE_CONVEX_URL`** — `convex deploy` inject ให้เองตอน build ผ่าน `--cmd-url-env-var-name VITE_CONVEX_URL`
> ❌ **ไม่ต้องตั้งใน Vercel**: `DATABASE_URL`, `CLOUDINARY_*`, `SITE_URL` — อยู่ใน Convex deployment env แล้ว (ขั้น 6.2)

---

### 6.5 ขั้นที่ 4 — ให้ root URL เปิดหน้าเว็บที่ถูกต้อง (ต่อโปรเจกต์)

`dist/` มี 4 entries (`index.html` = portal, `velshop.html`, `velseller.html`, `velcenter.html`) — ถ้าไม่ตั้งอะไร Vercel จะเสิร์ฟ `index.html` (landing) ที่ `/` ดังนั้น **ต่อโปรเจกต์** ต้องเพิ่ม **Rewrite** ให้ `/` และทุก route ของเว็บนั้นชี้ไปที่ entry ของตัวเอง:

Vercel → Project → **Settings → Rewrites & Redirects** → Rewrites → **Add**:

| โปรเจกต์ | Source | Destination |
|---|---|---|
| velshop | `/(.*)` | `/velshop.html` |
| velseller | `/(.*)` | `/velseller.html` |
| velcenter | `/(.*)` | `/velcenter.html` |

> Vercel **ตรวจไฟล์จริงก่อน rewrite** → asset (JS/CSS/รูป) โหลดปกติ ส่วน route ของ SPA (`/shop`, `/auth`, `/shop/checkout`, ...) fallback ไปที่ entry ของเว็บนั้น
> **ข้ามขั้นนี้ได้ (MVP):** เข้าผ่าน `https://velshop.vercel.app/velshop.html` ก็ใช้งานได้ครบ — ระบบหา basename ให้อัตโนมัติ (แค่ URL ไม่สวย)

---

### 6.6 ขั้นที่ 5 — Deploy และตรวจสอบ

1. กด **Deploy** → Vercel รัน: `bun install` → `npx convex deploy ...` (codegen + push functions/schema ไป Convex production) → `bun run build` → วาง `dist/` ขึ้น edge
2. หลังจากนี้ **push ขึ้น GitHub ทุกครั้ง → ทั้ง 3 เว็บ + Convex functions อัปเดตอัตโนมัติ** (ไม่ต้อง deploy มือ)
3. ตรวจ:
   - `https://velshop.vercel.app` → หน้าตลาด (ดูสินค้า/สั่งซื้อ)
   - `https://velseller.vercel.app` → หลังบ้านพ่อค้า (เปิดร้าน/สินค้า/รายได้)
   - `https://velcenter.vercel.app` → หลังบ้านบริษัท (ล็อกอิน → รับสิทธิ์ owner คนแรก)
4. (optional) **Custom domain**: Project → Settings → Domains → เพิ่ม `velshop.com` → ตั้ง DNS ตามที่ Vercel ให้ (A record `76.76.21.21` หรือ CNAME) แล้วแก้ `VITE_VEL*_URL` ใน Vercel env ให้เป็น domain จริง

---

### 6.7 ตารางสรุป: ตัวแปรต้องตั้งที่ไหน

| ตัวแปร | Vercel (frontend) | Convex deployment env (backend) |
|---|---|---|
| `CONVEX_DEPLOY_KEY` | ✅ (Production เท่านั้น) | — |
| `VITE_CONVEX_URL` | อัตโนมัติจาก build command | — |
| `VITE_SITE_BASENAME` / `VITE_VEL*_URL` | ✅ | — |
| `DATABASE_URL` (Neon) | — | ✅ |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | — | ✅ |
| `SITE_URL` | — | ✅ |

---

### 6.8 ทางเลือกอื่น (Netlify / Cloudflare Pages)

หลักการเดียวกัน: deploy `dist/` ทั้งโฟลเดอร์ + rewrite ทุก route ไป entry ของเว็บนั้น + env เหมือนเดิม (ต้องตั้ง `CONVEX_DEPLOY_KEY` ใน env ของแพลตฟอร์มด้วย — `convex deploy` ทำงานได้ทุกที่):

| Platform | Build command | Output | Rewrite (ต่อเว็บ — ตัวอย่าง velshop) |
|---|---|---|---|
| **Netlify** | `npx convex deploy --cmd-url-env-var-name VITE_CONVEX_URL --cmd 'bun run build'` | `dist` | ไฟล์ `_redirects`: `/* /velshop.html 200` |
| **Cloudflare Pages** | เหมือนกัน | `dist` | ไฟล์ `_redirects`: `/* /velshop.html 200` |

> Vercel ยังคงเป็นตัวเลือกที่แนะนำสุด เพราะ `convex deploy` inject `VITE_CONVEX_URL` ให้อัตโนมัติ และมี Convex Preview Deployments ให้ทดสอบก่อน merge

---

## 7. ปัญหาที่พบบ่อย

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| หน้าว่าง หรือขึ้น `Did you forget to run convex dev?` | ยังไม่ได้ push schema / codegen → รัน `bun convex dev --once` |
| เปิดร้าน / เพิ่มสินค้าแล้ว error เกี่ยวกับตาราง (เช่น `relation "sellers" does not exist`) | ยังไม่ได้สร้างตาราง Neon → รัน `DATABASE_URL="..." bun run db:migrate` |
| อัปโหลดรูปสินค้าไม่ได้ (ขึ้น `Image storage is not configured`) | ยังไม่ได้ตั้ง Cloudinary env ครบทั้ง 3 ตัวใน Keys/API keys |
| Typecheck error เกี่ยวกับ `_generated` | ไฟล์ codegen เก่า/หาย → รัน `bun convex dev --once` (ห้ามแก้ `_generated` ด้วยมือ) |
| ล็อกอินแล้วพาไปผิดที่ / ตก 404 | ตรวจ `VITE_*_URL` — การข้ามเว็บใช้การโหลดหน้าใหม่ทั้งหน้า (ต้องเป็น URL จริง) |
| คลิกไปเว็บอื่นแล้ว 404 | กำลัง preview ใน repo เดียวกันต้องใช้ path default (`/velshop.html` ฯลฯ) — deploy จริงต้องตั้ง `VITE_*_URL` |
| กดส่ง OTP แล้วไม่ได้รับอีเมล | ตรวจ backend env `SITE_URL` + ตั้งค่า email provider ของ Convex Auth (ดู `src/convex/auth/emailOtp.ts` — ห้ามแก้ไฟล์นี้) |
| เปิด root โดเมนแล้วเจอหน้า portal (landing) แทนเว็บของตัวเอง | ยังไม่ได้ตั้ง Rewrite ใน 6.5 — ให้ `/(.*)` → `/velshop.html` (หรือ entry ของเว็บนั้น) |
| route ลึก (เช่น `/shop`) 404 หลัง deploy | Rewrite `/(.*)` ยังไม่ได้ตั้ง หรือตั้งผิด entry |
| Build บน Vercel fail ตอน codegen / push Convex | ตรวจ `CONVEX_DEPLOY_KEY` ตั้งครบ และ Environment ต้องติ๊ก **Production** (uncheck Preview/Development) |
| ล็อกอิน / OTP ผิดปกติหลังย้ายโดเมน | ตรวจ Convex dashboard → CORS / Allowed Origins ให้เพิ่ม domain ใหม่ + `SITE_URL` ใน deployment env |
| อยากเริ่มฐานข้อมูลใหม่ | สร้าง Convex deployment ใหม่แล้วเปลี่ยน `VITE_CONVEX_URL` |

---

## 8. การ push ขึ้น GitHub

> หมายเหตุ: ภายในสภาพแวดล้อม Freebuff คำสั่ง git ถูกปิด (`Git and GitHub commands are blocked`)
> ต้องรันคำสั่ง push ด้วยตัวเองใน terminal ของเครื่อง (หรือหลัง export โค้ดออกมา)

Repo นี้ตั้ง remote ไว้แล้ว → `https://github.com/EnJirad/velnox-mvp.git` (branch `main`)

```bash
# 1. ดูสถานะไฟล์ที่แก้
git status

# 2. เพิ่มไฟล์ทั้งหมด (ไฟล์ที่ .gitignore ไว้จะถูกข้ามอัตโนมัติ)
git add -A

# 3. Commit
git commit -m "feat: Velnox MVP — 3 websites (velshop/velseller/velcenter) on one Convex backend"

# 4. Push ขึ้น GitHub (ครั้งแรกเพิ่ม -u เพื่อจำ branch)
git push -u github main
```

ถ้ายังไม่เคยตั้ง remote:

```bash
git remote add github https://github.com/EnJirad/velnox-mvp.git
git push -u github main
```

> ✅ สิ่งที่ควร commit: โค้ดทั้งหมด + `INSTALL_AND_USAGE.md` + `docs/`
> ❌ ไม่ commit: `node_modules/`, `dist/`, `convex/_generated/`, `.env*` (อยู่ใน `.gitignore` แล้ว)

---

## 📄 เอกสารอื่น ๆ

- `README.md` — สรุปสถาปัตยกรรม monorepo 4 apps + การ deploy
- `apps/README.md` — รายละเอียดแต่ละ app (VelShop / VelSeller / VelCenter / Corporate)
- `integrations.md` — คู่มือ AI / Email / Payment integrations (VLY)
- `docs/FINAL_ARCHITECTURE_REPORT.md` — รายงานการย้ายโครงสร้างฉบับสุดท้าย
