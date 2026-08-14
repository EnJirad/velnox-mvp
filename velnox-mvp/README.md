# Velnox MVP

**Commerce that remembers you · จำแทนคุณ**

Velnox is not just a storefront — it is a business tool that **remembers** for the owner.
It learns purchase cycles, predicts when to restock, and turns that memory into action.

This repo is the **V1 MVP**: three websites (**velshop · velseller · velcenter**) that share
**one backend and one database**.

> Built from the product docs in [`EnJirad/velnox`](https://github.com/EnJirad/velnox)
> (`KeyDataset/Main_objective.md`, `VELNOX_DESIGN_THEME.md`).

---

## 🌐 The 3 websites (same backend, same database)

```
        ┌─────────────────────────────────────────┐
        │   Convex Backend + ฐานข้อมูลเดียวกัน      │
        │   users · products · orders · goals ... │
        └─────────────────────────────────────────┘
              ▲              ▲              ▲
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │  velshop │   │ velseller│   │ velcenter│
        │  หน้าร้าน │   │  เจ้าของ  │   │ ศูนย์กลาง │
        │  (ลูกค้า) │   │  (ร้าน)   │   │  (ผู้ดูแล)│
        └──────────┘   └──────────┘   └──────────┘
```

| Site | Route | Who | What |
|---|---|---|---|
| **velshop** | `/shop` | ลูกค้า | Browse published products, cart, place orders, track order status, **Customer Memory** ("Velnox จำคุณได้" — reorder reminders from your own history) |
| **velseller** | `/seller/*` | เจ้าของร้าน (seller/admin) | Goals dashboard, Smart Reorder (learned purchase cycles), manage customer orders |
| **velcenter** | `/center` | ผู้ดูแล (admin) | Business overview + KPIs, Velnox Intelligence (next-order predictions), user roles, product publishing, store settings |

**Roles:** `customer` (default) · `seller` · `admin` — one shared account system.
In the MVP a signed-in user can self-serve "open your shop" (become seller) and
"become admin" (production would gate these behind approval).

---

## ✨ Features (V1 scope)

- **Landing page** — Velnox-themed (white/slate/navy + emerald accent), Thai copy, 3-site ecosystem section
- **Auth** — email OTP + anonymous guest, protected routes, role-aware post-login redirect
- **velshop** — product grid with search/category filters, cart drawer (localStorage), checkout form, "ออเดอร์ของฉัน" with live status
  - **Customer Memory (v1)** — "Velnox จำคุณได้": the shop learns which products each customer orders regularly (from their own order history) and shows them a "สั่งซื้ออีกครั้ง" reorder strip on the storefront, ranked by order frequency
- **velseller**
  - **แดชบอร์ดเป้าหมาย**: goals CRUD, progress logging, auto status (สำเร็จ / เกินกำหนด / ตามแผน)
  - **Smart Reorder**: inventory CRUD, **learns real purchase cycles** (rolling average of days between reorders), auto reminders (ถึงเวลาสั่ง / ใกล้ถึงรอบ / สต็อกต่ำ), 1-click reorder, sale/stock deduction, purchase history
  - **ออเดอร์**: all customer orders with status management (ยืนยัน / เสร็จสิ้น / ยกเลิก)
- **velcenter**
  - **ภาพรวม**: revenue (completed orders), order counts, goals, inventory health, customers
  - **Intelligence**: per-product predicted next order date from learned cycles
  - **ผู้ใช้**: role management
  - **สินค้า**: publish/unpublish toggles
  - **ตั้งค่าร้าน**: shop name, tagline, phone, address, announcement (shown on velshop)

The core loop — **Remember → Learn → Predict → Act** — is fully wired in v1:
purchase history feeds the learned cycle, the learned cycle drives reorder reminders,
and orders flow from velshop into velseller/velcenter.

---

## 🛠 Tech Stack

- [React 18](https://react.dev) + [TypeScript](https://www.typescriptlang.org) + [Vite](https://vite.dev)
- [Convex](https://convex.dev) — backend + database (queries/mutations/actions, reactive subscriptions)
- [Convex Auth](https://labs.convex.dev/auth) — email OTP + anonymous
- [Tailwind CSS](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com) + [Framer Motion](https://motion.dev)
- [Bun](https://bun.sh) — package manager & scripts

**Theme** (per `VELNOX_DESIGN_THEME.md`): white/slate/navy base (~80%), emerald `#10B981` accent (~5%),
Inter + Noto Sans Thai, radius 10–14px, soft shadows, dark premium sections.

---

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh/docs/installation) ≥ 1.1
- A Convex deployment (free tier is fine) — or run locally

### 1. Install

```bash
bun install
```

### 2. Set your Convex URL

Create `.env.local` in the project root (or use your platform's env/keys UI):

```
VITE_CONVEX_URL=https://<your-deployment>.convex.cloud
```

> You can create a deployment with `bunx convex dev` and copy the URL it prints.

### 3. Run the backend (codegen + push schema)

```bash
bun convex dev --once
```

### 4. Start the dev server

```bash
bun run dev
```

Open the printed URL — sign in with email OTP (or "เข้าสู่ระบบแบบผู้เยี่ยมชม").
Customers land on `/shop`; after "เปิดร้านค้า" you get `/seller/*`, then "สมัครเป็นผู้ดูแล" unlocks `/center`.

### Typecheck

```bash
bun tsc -b --noEmit
```

---

## 📁 Project Structure

```
velnox-mvp/
├── src/
│   ├── convex/              # Backend: schema, goals, products, orders, center
│   │   ├── schema.ts        #   tables: users, goals, products, purchases, orders, orderItems, storeSettings
│   │   ├── products.ts      #   products CRUD, listPublished (storefront), recordPurchase (cycle learning)
│   │   ├── orders.ts        #   placeOrder, myOrders, allOrders, updateStatus (restock on cancel)
│   │   ├── center.ts        #   overview KPIs, storeSettings get/update
│   │   ├── users.ts         #   currentUser, becomeSeller/becomeAdmin, listUsers/setRole (admin)
│   │   └── _generated/      #   auto-generated Convex client (regenerate via `bun convex dev --once`)
│   ├── components/
│   │   ├── shop/            # ShopHeader, CartDrawer
│   │   ├── goals/           # GoalCard, GoalFormDialog, ProgressDialog
│   │   ├── reorder/         # ProductFormDialog, ReorderDialog, StockDialog
│   │   ├── AppHeader.tsx    # velseller header (goals / reorder / orders)
│   │   ├── SiteSwitcher.tsx # switch between velshop / velseller / velcenter
│   │   ├── RequireRole.tsx  # role gate (seller or admin) with self-serve promotion
│   │   ├── UserMenu.tsx     # shared user dropdown
│   │   └── ui/              # shadcn/ui components
│   ├── lib/                 # goals.ts, reorder.ts (status logic), shop.ts, cart.tsx (cart context)
│   ├── pages/               # Landing, Auth, ShopHome, ShopCheckout, MyOrders,
│   │                        #   Dashboard (seller goals), Reorder (seller), SellerOrders, Center, NotFound
│   ├── hooks/               # use-auth, use-mobile
│   ├── main.tsx             # entry + router (/, /auth, /shop, /seller/*, /center + legacy redirects)
│   └── index.css            # Velnox theme tokens (palette, fonts, radius)
├── public/
├── index.html
├── vite.config.ts
├── convex.json
├── package.json
└── tsconfig*.json
```

---

## 🗺 Next Steps (per `Main_objective.md` roadmap)

- **Customer Memory v2** — learn each customer's *personal* purchase cycle per product (from gaps between their orders) and predict "ถึงเวลาสั่งอีกแล้ว" per customer, not just frequency
- **VelRepeat** — proactive reminders (email/Line/SMS) before a product hits its reorder window
- **Payment** — online checkout on velshop (e.g. Stripe/PromptPay)
- **Velnox Intelligence v2** — sales trend charts, usage-rate forecasts, auto insights

---

## 📄 License

Private product build. Based on the public `EnJirad/velnox` product docs.
