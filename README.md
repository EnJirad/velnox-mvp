# Velnox — Commerce that remembers you (จำแทนคุณ)

Velnox is a Thai commerce platform. It is a **Bun-workspace monorepo** with
**four independent Vite + React 19 + TypeScript web apps** sharing **one Convex
backend** and **one Neon (PostgreSQL) commerce core**.

## Architecture

```
velnox-mvp/
├── apps/
│   ├── shop/        → VelShop     shop.velnox.com     customer storefront
│   ├── seller/      → VelSeller   seller.velnox.com    seller platform
│   ├── center/      → VelCenter   center.velnox.com    internal operator platform
│   └── corporate/   → Velnox Corp velnox.com           public corporate website
├── packages/
│   └── shared/      → @velnox/shared — shared UI kit, hooks, libs, Auth/NotFound pages, theme
├── backend/         → shared Neon commerce core (business rules, server-side)
├── convex/          → shared Convex backend (one deployment for all 4 apps)
├── db/              → shared schema + migrations
├── docs/            → architecture, environment, deployment docs
└── tests/           → shared unit tests (bun test)
```

- Each app is a **standalone Vite project** (`apps/<app>` with its own
  `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `public/`),
  independently deployable to Vercel with **Root Directory = `apps/<app>`**.
- Apps never import each other's source; cross-app navigation uses the
  production domains (`SITE_URLS` in `@velnox/shared/lib/sites`).
- Authorization is enforced **server-side** (Convex + `backend/permissions.ts`);
  frontend route guards (`RequireAuth` / `RequireRole`) are UX only.

## Tech stack

Vite · React 19 · React Router v7 (`react-router`) · TypeScript · Tailwind v4 ·
shadcn/ui · lucide-react · Convex + Convex Auth · Neon (PostgreSQL) · Bun

## Setup

```bash
bun install          # repo root (Bun workspaces)
bun run dev:shop     # → http://localhost:5173  (also: dev:seller, dev:center, dev:corporate)
```

## Verify

```bash
bun run typecheck    # tsc -b --noEmit across apps + shared + backend/convex/db/tests
bun test             # shared unit tests
cd apps/shop && bun run build   # each app builds independently (dist/)
```

## Environment variables

Client (Vite, public only): `VITE_CONVEX_URL` (**required**, same deployment
for all apps), `VITE_VELSHOP_URL` / `VITE_VELSELLER_URL` / `VITE_VELCENTER_URL`
/ `VITE_CORPORATE_URL` (cross-site links, default = production domains),
`VITE_SITE_BASENAME` (empty for standalone domain deploy). See
[`docs/ENVIRONMENT.md`](./docs/ENVIRONMENT.md) and each app's README.

Backend secrets (`DATABASE_URL`, `CLOUDINARY_*`, `JWT_PRIVATE_KEY`, `SITE_URL`,
…) are **Convex deployment env vars** — set them in the Keys/API keys UI,
never in a Vite `.env`.

## Deploy (Vercel — 4 projects from one repo)

| Vercel project | Root Directory | Build | Output |
|---|---|---|---|
| velnox-shop | `apps/shop` | `bun run build` | `dist` |
| velnox-seller | `apps/seller` | `bun run build` | `dist` |
| velnox-center | `apps/center` | `bun run build` | `dist` |
| velnox-corporate | `apps/corporate` | `bun run build` | `dist` |

## Docs

- [`INSTALL_AND_USAGE.md`](./INSTALL_AND_USAGE.md) — คู่มือติดตั้งและใช้งาน (ภาษาไทย)
- [`apps/README.md`](./apps/README.md) — the four apps and Vercel setup
- [`docs/ENVIRONMENT.md`](./docs/ENVIRONMENT.md) — environment variables
- [`docs/FINAL_ARCHITECTURE_REPORT.md`](./docs/FINAL_ARCHITECTURE_REPORT.md) — final migration report
