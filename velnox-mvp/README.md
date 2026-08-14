# Velnox MVP

**Commerce that remembers you · จำแทนคุณ**

Velnox is not just a storefront — it is a business tool that **remembers** for the owner.
It learns purchase cycles, predicts when to restock, and turns that memory into action.
This repo is the **Version 1 MVP**: a goals dashboard + Smart Reorder for business owners.

> Built from the product docs in [`EnJirad/velnox`](https://github.com/EnJirad/velnox)
> (`KeyDataset/Main_objective.md`, `VELNOX_DESIGN_THEME.md`).

---

## ✨ Features (V1 scope)

| Feature | Description |
|---|---|
| **Landing page** | Velnox-themed landing (white/slate/navy + emerald accent), Thai copy, all CTAs flow into auth |
| **Auth** | Email OTP sign-in + anonymous guest access, protected routes, return-to flow |
| **แดชบอร์ดเป้าหมาย** (`/dashboard`) | Business goals: create/edit/delete targets (ยอดขาย / ออเดอร์ / ลูกค้าใหม่), log progress, auto status (สำเร็จ / เกินกำหนด / ตามแผน), KPI cards |
| **Smart Reorder** (`/reorder`) | Inventory CRUD, **learns real purchase cycles** (rolling average of days between reorders), auto reminders (ถึงเวลาสั่ง / ใกล้ถึงรอบ / สต็อกต่ำ), 1-click reorder, sale/stock deduction, purchase history |

The core loop — **Remember → Learn → Predict → Act** — is fully wired in v1:
purchase history (`purchases` table) feeds the learned cycle, the learned cycle drives reminders, and one click reorders.

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

Open the printed URL — sign in with email OTP (or "เข้าสู่ระบบแบบผู้เยี่ยมชม") and you land on the goals dashboard.

### Typecheck

```bash
bun tsc -b --noEmit
```

---

## 📁 Project Structure

```
velnox-mvp/
├── src/
│   ├── convex/              # Backend: schema, goals, products (queries/mutations/actions)
│   │   ├── schema.ts        #   tables: users, goals, products, purchases (+ auth tables)
│   │   ├── goals.ts         #   goals CRUD + progress mutations
│   │   ├── products.ts      #   products CRUD, recordPurchase (cycle learning), recordSale
│   │   └── _generated/      #   auto-generated Convex client (regenerate via `bun convex dev --once`)
│   ├── components/
│   │   ├── goals/           # GoalCard, GoalFormDialog, ProgressDialog
│   │   ├── reorder/         # ProductFormDialog, ReorderDialog, StockDialog
│   │   ├── AppHeader.tsx    # shared app nav (เป้าหมาย / Smart Reorder)
│   │   └── ui/              # shadcn/ui components
│   ├── lib/                 # goals.ts, reorder.ts (status logic), utils.ts
│   ├── pages/               # Landing, Auth, Dashboard, Reorder, NotFound
│   ├── hooks/               # use-auth, use-mobile
│   ├── main.tsx             # entry + router (/, /auth, /dashboard, /reorder)
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

- **VelRepeat** — proactive reminders (email/Line/SMS) before a product hits its reorder window
- **Command Center** — single-page business overview (goals + inventory + sales)
- **Velnox Intelligence** — predictions: next order date, usage trends, auto insights
- **Customer Memory** — remember each customer's purchase cycles (v2 scope)

---

## 📄 License

Private product build. Based on the public `EnJirad/velnox` product docs.
