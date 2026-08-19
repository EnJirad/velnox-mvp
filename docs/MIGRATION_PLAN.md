# VELNOX — Real Monorepo Migration Plan

Date: 2026-08-16 · Scope: `EnJirad/velnox-mvp` → production monorepo with 4 independent Vite apps.

## 0. Source of truth (from code, not folder names)

The current repository is **one Vite multi-entry application** (React 19 + Vite 7 + TypeScript + Bun),
NOT a Next.js monorepo. There are 5 HTML entries, one shared `src/` tree, one shared Convex backend
(`src/convex/`) and one shared Neon backend (`src/backend/` + `db/`). The four real applications are
reached through `src/sites/<site>/main.tsx`:

| Entry HTML | Bootstrap | Application | Production domain |
|---|---|---|---|
| `velshop.html` | `src/sites/velshop/main.tsx` | VelShop (storefront) | https://shop.velnox.com |
| `velseller.html` | `src/sites/velseller/main.tsx` | VelSeller (seller platform) | https://seller.velnox.com |
| `velcenter.html` | `src/sites/velcenter/main.tsx` | VelCenter (operator platform) | https://center.velnox.com |
| `corporate.html` | `src/sites/corporate/main.tsx` | Velnox Corporate | https://velnox.com |
| `index.html` | `src/main.tsx` | **Portal / app launcher — REMOVE** (obsolete generic launcher, per spec §59–66) | — |

## 1. Classification

### SHOP → `apps/shop/src/`
- Pages: `ShopHome, ShopProducts, ShopCategories, ShopProductDetail, ShopDetail, ShopCart,
  ShopCheckout, MyOrders, ShopOrderDetail, ShopTracking, VelRepeatPage, ShopWishlist, ShopAddresses,
  ShopProfile, ShopNotifications` (16)
- Components: `components/shop/*` (CartDrawer, MapPicker, ProductDetailModal, ShopHeader, SubscriptionDialog)
- Lib: `lib/cart.tsx`, `lib/seo.ts`
- Entry: `sites/velshop/main.tsx` → `src/main.tsx`

### SELLER → `apps/seller/src/`
- Pages: `Dashboard` (renamed **`SellerGoals`** — legitimate seller operational page, spec §75), `MyShop,
  Reorder, SellerOrders, Income` (5)
- Entry: `sites/velseller/main.tsx` → `src/main.tsx`
- No app-private components/lib (all seller components are shared with Center — see below).

### CENTER → `apps/center/src/`
- Pages: `Center` (1)
- Entry: `sites/velcenter/main.tsx` → `src/main.tsx`

### CORPORATE → `apps/corporate/src/`
- Pages: `pages/corporate/*` (Contact, CorporateHome, CorporateLayout, StaticPage, content) (5)
- Entry: `sites/corporate/main.tsx` → `src/main.tsx`

### SHARED → `packages/shared/src/` (package `@velnox/shared`)
Used by ≥2 applications — kept as ONE cohesive package (spec §9: “create shared packages only where
justified”; splitting into 8 packages adds 8× config with no behavioral benefit for this codebase).
- `components/ui/*` (46 shadcn-style components) — generic UI kit
- `components/` top level: AppHeader, Logo, LogoDropdown, MobileTabBar, RequireAuth, RequireRole,
  SiteSwitcher, UserMenu — shared app shell/auth guards
- `components/goals/*`, `components/seller/*`, `components/reorder/*` — seller tooling ALSO used by
  VelCenter (`Center.tsx` imports goals + seller components; `lib/shop`/`lib/reorder` imported by Center)
- `lib/`: utils, sites, track, app-shell, monitoring, customer-memory-core, commerce, shop, reorder,
  goals, vly-integrations
- `hooks/`: use-auth, use-mobile
- `pages/Auth.tsx`, `pages/NotFound.tsx` (Auth used by all site entries; NotFound by all routers)
- `index.css` (global theme/Tailwind), `types/global.d.ts`, `assets/logo.svg`
- Tests: `lib/customer-memory-core.test.ts` → `tests/`

### BACKEND (shared infra, stays at root) → `backend/`, `convex/`, `db/`
- `src/backend/*` (Neon commerce core — orders/payments/inventory/finance/…) → `backend/`
- `src/convex/*` (Convex functions, auth, schema, memory) → `convex/` (convex.json path updated)
- `db/` stays (migrations/schema — **never reset**)
- Convex ↔ shared: `convex/memory.ts` + `convex/memoryEvents.ts` import
  `../lib/customer-memory-core` → path updated to `../packages/shared/src/lib/customer-memory-core`.

### TESTS → `tests/` (root, stays)
- `tests/*.test.ts` import `../src/backend/*` → `../backend/*`
- `src/lib/customer-memory-core.test.ts` moves into `tests/`, imports the shared package.

### REMOVED (only after new apps build)
- Portal entry: `index.html`, `src/main.tsx`, `src/pages/Landing.tsx`, `/dashboard` redirects
- Root HTML entries: `velshop.html`, `velseller.html`, `velcenter.html`, `corporate.html`
- Root multi-entry Vite configs: `vite.config.ts`, `vite.config.velshop.ts`, `vite.config.velseller.ts`,
  `vite.config.velcenter.ts`, `vite.config.corporate.ts` (replaced by per-app `apps/*/vite.config.ts`)
- Root `vercel.json` (obsolete multi-entry deploy contract; per-app `vercel.json` files replace it)
- Empty `src/` tree after extraction.

## 2. Import & alias strategy

- Apps: `@/*` → `<app>/src/*` (app-local code), `@velnox/shared/*` → `packages/shared/src/*`,
  `@convex/_generated/*` → `convex/_generated/*`.
- Shared package: `@velnox/shared/*` → `./src/*` (internal), `@convex/_generated/*` → root generated API.
- Mechanical rewrite in every moved file: `@/convex/_generated/…` → `@convex/_generated/…`;
  shared imports `@/lib|components|hooks|pages|types/…` → `@velnox/shared/…`; app-local imports unchanged.
- App-local references stay `@/…` (own src): e.g. shop pages ↔ `@/components/shop/*`, `@/lib/cart`,
  `@/lib/seo`.

## 3. Per-app configs

Each app gets: `index.html`, `vite.config.ts` (root = app dir; react + vly + tailwind plugins; aliases;
dedupe react), `tsconfig.json` (+ `tsconfig.app.json`, `tsconfig.node.json`), `package.json`
(`@velnox/shared: workspace:*` + app deps), `public/` (logo, manifest, robots), `README.md`, `vercel.json`
(headers + SPA rewrite to `/`). Root `tsconfig.json` references all apps + shared + node config so the
platform-wide `tsc -b` check covers every project. Convex stays one shared deployment.

## 4. Convex function validation

`catalogProductsAction` exists and is exported in `convex/commerce.ts`
(`src/convex/commerce.ts:319`), consumed via `api.commerce.catalogProductsAction`
(`src/pages/ShopProducts.tsx`). No placeholder will be created; after moving `convex/` the generated
API is regenerated with `bun convex dev --once` and the frontend import resolves through the
`@convex/_generated` alias to the same deployment.

## 5. Verification gates

1. `bun convex dev --once` (codegen; confirm `commerce.catalogProductsAction` in `convex/_generated/api.d.ts`)
2. `bun install` (workspace update)
3. `bun tsc -b --noEmit` (root, all projects)
4. `bun test` (vitest)
5. `cd apps/<app> && bun run build` × 4 (independent builds)
6. Root `bun run build` (platform preview/deploy path, shop → `dist/`)
7. `git status` — no `.env`, `node_modules`, `dist`, generated files staged.
