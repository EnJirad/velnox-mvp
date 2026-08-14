# Velnox MVP

**Commerce that remembers you · จำแทนคุณ**

Velnox is not just a storefront — it is a business tool that **remembers** for the owner.
It learns purchase cycles, predicts when to restock, remembers what each customer
clicks and buys, and turns that memory into action.

> Built from the product docs in [`EnJirad/velnox`](https://github.com/EnJirad/velnox)
> (`KeyDataset/Main_objective.md`, `VELNOX_DESIGN_THEME.md`).

---

## 🌐 3 websites · deploy SEPARATELY · same backend + database

**เน้นย้ำ: ทั้ง 3 เว็บไซต์ทำงานคนละที่กัน (deploy แยกคนละโดเมน)** — แต่ละเว็บเป็น entry
อิสระของตัวเอง (velshop.html / velseller.html / velcenter.html) ใช้ **Convex backend
และฐานข้อมูลชุดเดียว** ไม่มีเว็บไหนฝังอยู่ในอีกเว็บ

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

| Site | Entry | Who | What |
|---|---|---|---|
| **velshop** | `velshop.html` | ลูกค้า (ทุกคน) | ตลาดซื้อขายสไตล์ Shopee: ดูสินค้า, ตะกร้า, สั่งซื้อ, **สั่งรายเดือน**, ติดตามออเดอร์, Customer Memory + VelRepeat recommendation |
| **velseller** | `velseller.html` | พ่อค้าที่เปิดร้านกับเรา (seller/admin/owner) | หลังบ้านของร้านตัวเอง: สินค้า, สต็อก, Smart Reorder, ออเดอร์ของตัวเอง, **รายได้ + ค่าธรรมเนียม 3%** |
| **velcenter** | `velcenter.html` | เฉพาะบริษัท (owner / admin / staff) | ภาพรวมทั้งบริษัท, ออเดอร์ทุกตลาด, Intelligence, **จัดการพนักงาน + แยกสิทธิ์ตามยศ** |

**Cross-site links** ใช้ `src/lib/sites.ts` — ชี้ URL จริงของแต่ละเว็บได้ผ่าน
`VITE_VELSHOP_URL` / `VITE_VELSELLER_URL` / `VITE_VELCENTER_URL`
(ใน repo นี้ค่า default คือ `/velshop.html` ฯลฯ เพื่อให้ preview ทำงานได้)
`VITE_SITE_BASENAME` ควบคุม router basename — เวลาขึ้น domain จริง (เช่น velshop.com)
ตั้งเป็นค่าว่าง แล้ว route จะอยู่ที่ `/`

---

## 🧑‍💼 velcenter: แยกสิทธิ์ตามยศ (company-only)

velcenter เข้าถึงได้เฉพาะผู้ที่เจ้าของบริษัทกำหนดสิทธิ์ **ไม่มีระบบสมัครแอดมินเอง**
(คนแรกที่สมัครตอนยังไม่มีเจ้าของ จะได้เป็นเจ้าของ — หลังจากนั้นปิดถาวร)

| ยศ | สิทธิ์ |
|---|---|
| **owner** (เจ้าของบริษัท) | เห็นทุกอย่าง + **จัดการพนักงาน** (ตั้งยศ + ฝ่าย) + ตั้งค่าร้าน |
| **admin** (ผู้ดูแลฝ่าย) | เห็นข้อมูลธุรกิจทั้งหมด + จัดการออเดอร์, ตั้งค่าร้าน (ฝ่าย general) — **จัดการพนักงานไม่ได้** (เช่น แอดมินฝ่ายการตลาด เห็นยอดทั้งหมดแต่แตะพนักงานไม่ได้) |
| **staff** (พนักงาน) | ดูตัวเลขธุรกิจ (ภาพรวม / ออเดอร์ / Intelligence / สินค้า) **แบบ view-only** — เปลี่ยนสถานะไม่ได้ |
| **seller** / **customer** | เข้า velcenter ไม่ได้ |

ฝ่าย (department): การตลาด · ฝ่ายขาย · ปฏิบัติการ · การเงิน · ทั่วไป
— ฐานข้อมูลรองรับการ scope ข้อมูลตามฝ่ายใน v2 แล้ว

---

## 💰 velseller: รายได้ + นโยบายค่าธรรมเนียม

หน้า **รายได้** คำนวณให้พ่อค้าอัตโนมัติจากออเดอร์ของตัวเองเท่านั้น:

- **ยอดขายรวม** — ออเดอร์ที่เสร็จสิ้น (เฉพาะสินค้าของร้านนี้)
- **ยอดตีกลับ + อัตรา %** — ออเดอร์ที่ยกเลิก
- **ค่าธรรมเนียม 3% ต่อชิ้น** — ตามนโยบาย Velnox
- **ยอดรับจริง** — หลังหักค่าธรรมเนียม และหักค่าตีกลับเกินนโยบาย

> **นโยบายการตีกลับ:** Velnox ครอบคลุมค่าตีกลับ **ไม่เกิน 10%** ของยอดขาย
> หากอัตราตีกลับเกิน 10% ร้านค้ารับผิดชอบส่วนต่าง (ระบบ flag เตือนเมื่อเกิน)

พ่อค้าแต่ละร้านเห็น **เฉพาะสินค้า/ออเดอร์/รายได้ของตัวเอง** — ออเดอร์ที่ร้านอื่นขาย
จะถูกกรองออก และเปิด-ปิดประกาศขายสินค้าของตัวเองได้จาก Smart Reorder

---

## 🧠 VelRepeat: จำพฤติกรรมลูกค้าแต่ละคน

ตาราง `productViews` เก็บ **ทุกคลิก "สนใจ" ของลูกค้าแต่ละคน** (แยกตาม user)

- หน้าสินค้ามีปุ่ม ❤️ "สนใจ" → บันทึกคลิกให้ Velnox
- **แนะนำสำหรับคุณ** บน velshop — เลือกสินค้าให้ลูกค้าจากคลิก + ประวัติสั่งของตัวเอง
- **สินค้ายอดนิยม** — ผู้ที่ไม่ล็อกอินเห็นสินค้าที่คนทั้งตลาดคลิกเยอะสุด
- ต่อยอดอนาคต: "เว็บเลือกสินค้าให้คุณ" อัตโนมัติ — ยิ่งมีข้อมูล ยิ่งแม่นยำ

**Customer Memory:** สินค้าที่ลูกค้าสั่งประจำ (จากประวัติออเดอร์จริง) + ปุ่มสั่งซื้อซ้ำ 1 คลิก

---

## 🗓 velshop: สั่งรายเดือน (subscription)

- ลูกค้ากด "สั่งรายเดือน" บนสินค้า → เลือกรอบ (30/60/90 วัน) + จำนวน
- ตาราง `subscriptions` เก็บรอบถัดไปอัตโนมัติ — ดู/ยกเลิกได้ที่ "ออเดอร์ของฉัน"
- velseller มีปุ่ม "สร้างออเดอร์รอบครบกำหนด" → ระบบแปลง subscription ที่ครบรอบ
  เป็นออเดอร์จริง (ตัดสต็อก + อัปเดตรอบถัดไป) — เวอร์ชันเต็มเป็น scheduled job (VelRepeat)

---

## ✨ Features (V1)

- **Landing / portal** — Velnox-themed (white/slate/navy + emerald), Thai copy, 3-site ecosystem
- **Auth** — email OTP + anonymous, role-aware redirect
- **velshop** — product grid + search/category, cart (localStorage), checkout, ออเดอร์ของฉัน,
  สั่งรายเดือน, "Velnox จำคุณได้" (regular items), "แนะนำสำหรับคุณ" (VelRepeat), สินค้ายอดนิยม
- **velseller**
  - แดชบอร์ดเป้าหมาย (CRUD + progress + auto status)
  - **สินค้า + รูปสินค้า** (สร้าง/แก้ไข/เปิด-ปิดขาย + อัปโหลดรูปผ่าน Cloudinary CDN: ตั้งรูปหลัก/จัดเรียง/ลบ)
  - Smart Reorder (learns real purchase cycles, reminders, 1-click reorder, publish/unpublish)
  - ออเดอร์ของร้านตัวเอง + การสั่งรายเดือนของลูกค้า
  - **รายได้** (3% commission + return policy 10%)
- **velcenter**
  - ภาพรวม KPIs, ออเดอร์ทุกตลาด, Intelligence (predicted next order dates)
  - สินค้า registry (view), **พนักงาน + สิทธิ์ตามยศ (owner only)**, ตั้งค่าร้าน

---

## 🛠 Tech Stack

- React + TypeScript + Vite (multi-page: 4 entries — portal + 3 sites)
- Convex — backend + database (one deployment for all 3 sites)
- **Neon PostgreSQL — Commerce Core / Source of Truth** (sellers, shops, products, product_images, inventory, orders, order_items, payments, refunds, commissions, settlements, subscriptions — schema ใน `db/schema.sql`)
- **Cloudinary** — product image upload (signed upload ตรงจากเบราว์เซอร์; Neon เก็บ metadata เท่านั้น)
- Convex Auth — email OTP + anonymous
- Tailwind CSS + shadcn/ui + Framer Motion, Bun

**Theme** (per `VELNOX_DESIGN_THEME.md`): white/slate/navy base (~80%),
emerald `#10B981` accent (~5%), Inter + Noto Sans Thai, radius 10–14px, soft cards.

---

## 🚀 Getting Started

```bash
bun install
# set VITE_CONVEX_URL (or use the platform env UI)
bun convex dev --once     # push schema + codegen

# Neon Commerce Core (สินค้า/ออเดอร์/เงิน/สต็อก) — ต้องมี DATABASE_URL
DATABASE_URL="postgresql://...neon.tech/..." bun run db:migrate   # สร้าง 14 ตาราง (idempotent)
DATABASE_URL="postgresql://...neon.tech/..." bun run db:smoke     # ตรวจว่าตารางครบ

# รูปสินค้า (Cloudinary) — ตั้งใน Keys/API keys / convex env:
#   CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET

bun run dev               # portal at /, sites at /velshop.html etc.
bun tsc -b --noEmit       # typecheck
```

> คู่มือเต็ม (ภาษาไทย): `INSTALL_AND_USAGE.md` · แผน migration: `ARCHITECTURE_V3_MIGRATION.md`

**Deploy 3 เว็บแยก:** นำ `velshop.html` / `velseller.html` / `velcenter.html`
(พร้อม entry ที่ชี้ไป `src/sites/*/main.tsx`) ไป build เป็น 3 app แยกคนละโดเมน
โดยตั้ง `VITE_VELSHOP_URL`/`VITE_VELSELLER_URL`/`VITE_VELCENTER_URL` ไปที่โดเมนจริง
และ `VITE_SITE_BASENAME=""` — ทุกเว็บชี้ Convex deployment ตัวเดียวกัน

---

## 📁 Project Structure

```
├── index.html / velshop.html / velseller.html / velcenter.html   # 4 deployable entries
├── src/
│   ├── sites/            # velshop/ velseller/ velcenter/ — independent app routers
│   ├── convex/           # ONE backend: schema, users (roles), products, orders,
│   │                     #   subscriptions, center, goals
│   ├── pages/            # Landing, Auth, ShopHome, ShopCheckout, MyOrders,
│   │                     #   Dashboard, Reorder, SellerOrders, Income, Center, NotFound
│   ├── components/       # ui/ + shop/ goals/ reorder/ + AppHeader, SiteSwitcher, ...
│   ├── lib/              # sites.ts (deploy URLs), app-shell, cart, reorder, shop, goals
│   └── main.tsx          # portal entry (landing + auth + redirects to the 3 sites)
```

---

## 🗺 Next Steps

- **Customer Memory v2** — เรียนรู้รอบการสั่งรายบุคคลต่อสินค้า (จากระยะห่างระหว่างออเดอร์) คาดการณ์ "ถึงเวลาสั่งอีกแล้ว" เฉพาะคน
- **VelRepeat scheduled jobs** — สร้างออเดอร์รายเดือนอัตโนมัติ (cron) + แจ้งเตือน email/Line/SMS ก่อนสินค้าถึงรอบ
- **Payment** — ชำระเงินออนไลน์บน velshop (Stripe/PromptPay)
- **Velnox Intelligence v2** — กราฟยอดขาย เทรนด์, scope ข้อมูลตามฝ่าย (department) ใน velcenter
- **Approval flow** — เปิดร้าน/ตั้งพนักงานต้องผ่านการอนุมัติ (แทน self-serve MVP)

---

## 📄 License

Private product build. Based on the public `EnJirad/velnox` product docs.
