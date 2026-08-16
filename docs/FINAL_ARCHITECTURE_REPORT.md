# FINAL ARCHITECTURE REPORT — Velnox Monorepo Cleanup & Verification

**Date:** 2026-08-16 · **Repo:** `EnJirad/velnox-mvp` · **Branch:** `main`

## 1. Old architecture

- Single-root Vite project with **multi-HTML entries** (`velshop.html`,
  `velseller.html`, `velcenter.html`, `corporate.html`) driven by root
  `vite.config.*.ts` files and a shared root `src/`.
- All frontend code (pages, components, libs, hooks) lived under root `src/`
  (`src/sites/*`, `src/pages/*`, `src/components/*`, `src/backend/*`,
  `src/convex/*`).
- A nested **`velnox-mvp/`** folder at the repo root contained a stale
  deployable snapshot of that old layout (including the obsolete universal
  `src/pages/Dashboard.tsx` and `src/pages/Landing.tsx`).
- `apps/` existed but was mostly README-only.

## 2. New architecture (final)

```
velnox-mvp/
├── apps/
│   ├── shop/        → VelShop     shop.velnox.com     customer storefront
│   ├── seller/      → VelSeller   seller.velnox.com    seller platform
│   ├── center/      → VelCenter   center.velnox.com    internal operator platform
│   └── corporate/   → Velnox Corp velnox.com           public corporate website
├── packages/shared/ → @velnox/shared (UI kit, hooks, libs, Auth/NotFound pages, theme)
├── backend/         → shared Neon commerce core (business rules, server-side)
├── convex/          → shared Convex backend (one deployment, all 4 apps)
├── db/              → shared schema + migrations
├── docs/            → architecture / environment / deployment docs
└── tests/           → shared unit tests (bun test)
```

Each app is an independent Vite project (own `package.json`, `vite.config.ts`,
`tsconfig.json`, `index.html`, `public/`, `vercel.json`) that builds standalone
and deploys to its own Vercel project (Root Directory = `apps/<app>`).

## 3. What was migrated

- **VelShop** → `apps/shop/src` (15 storefront pages, `components/shop`,
  `lib/cart`, `lib/seo`). Root `/` → `/shop` storefront.
- **VelSeller** → `apps/seller/src` (`SellerGoals`, `MyShop`, `Reorder`,
  `SellerOrders`, `Income`).
- **VelCenter** → `apps/center/src` (`Center.tsx` operator platform).
- **Corporate** → `apps/corporate/src` (home, about, vision, business,
  ecosystem, technology, careers, news, privacy, terms, contact — no
  Convex/auth).
- **Shared frontend** → `packages/shared/src` (`components/ui` shadcn kit,
  `components/*`, `hooks/*`, `lib/*`, `pages/Auth`, `pages/NotFound`,
  `index.css` theme).
- **Backend** → `backend/` (29 services, moved from `src/backend`).
- **Convex** → `convex/` (20 modules, moved from `src/convex`).
- **Tests** → `tests/` (8 files, 79 tests).

## 4. What was removed

- **Nested `velnox-mvp/`** (265 files) — confirmed obsolete duplicate: root
  backend files are strictly newer (server-side shipping quotes, commission
  from `platform_settings`, payment-amount enforcement, seller-scoped
  subscriptions); the only unique nested files were the obsolete universal
  `Dashboard.tsx`, `Landing.tsx`, old `tsconfig.app.json` and old multi-entry
  HTML. (`git rm -r velnox-mvp`)
- **Root `main.ts`** — obsolete Deno/Hono static server for the old root `dist`.
- **Root `postcss.config.cjs`** — Tailwind v4 is loaded via `@tailwindcss/vite`;
  nothing uses PostCSS.
- **Root `sst-env.d.ts`** — SST orphan; `sst` is not a dependency.
- **Root `vly-toolbar-readonly.tsx`** — unused standalone artifact (not
  imported, not in any tsconfig).
- **Root `package-lock.json`** — obsolete npm lockfile (`bun.lock` is canonical).
- **Root `public/`** — old shared assets; every app ships its own `public/`.
- **Untracked build output** `dist/`, `apps/dist/`.

## 5. Dashboard changes

- No universal Velnox Dashboard / launcher exists anywhere in active code.
- No `/dashboard` route; no route sends users to a dashboard.
- `apps/seller/src/pages/SellerGoals.tsx` (legitimate seller operational UI)
  renamed its internal `Dashboard` component to `SellerGoals`.
- Remaining "dashboard" references are descriptive comments only (seller goals
  dashboard, center operator dashboard).
- VelCenter = **Operator/Operations platform** (orders, sellers, products,
  users/staff/roles, finance, platform settings, intelligence) — it operates
  Velnox, it does not navigate between the websites.

## 6. VelShop changes

- Storefront-first: `/` → `/shop` → `ShopHome` (products, search, categories,
  product detail, shops, cart, checkout, orders, wishlist, addresses, profile,
  notifications, VelRepeat). No admin/dashboard content at the root.
- Seller entry: header "ขายของ" links to `SITE_URLS.velseller` →
  `https://seller.velnox.com` (cross-app, full page load).
- Customer routes guarded with `RequireAuth`; checkout/orders/account are
  owner-scoped server-side.

## 7. VelSeller changes

- Separate app (`apps/seller`, seller.velnox.com) with its own router:
  goals, shop management, reorder, orders, income. All routes behind
  `RequireRole role="seller"` (seller/admin/owner).
- Seller resources are seller-scoped (backend enforces "ของใคร ของมัน").

## 8. VelCenter changes

- Separate internal app (`apps/center`, center.velnox.com), `noindex`.
- Root `/` behind `RequireRole role="center"` (owner/admin/staff); the first
  user may claim ownership via `users.becomeOwner`; thereafter access is
  granted by the owner. Authorization enforced server-side
  (`convex/users.ts`, `convex/centerAdmin.ts`, `backend/permissions.ts`).

## 9. Corporate changes

- Separate public website (`apps/corporate`, velnox.com) — company info,
  vision, business, ecosystem, technology, careers, news, privacy, terms,
  contact. No Convex client, no auth, no dashboard; links out to the apps via
  `SITE_URLS`.

## 10. Shared package changes

- Single `packages/shared` (`@velnox/shared`) kept — not split into
  `packages/ui|auth|api|...` (no technical need; stability first).
- `packages/README.md` rewritten to describe the real layout.
- `components.json` updated: css → `packages/shared/src/index.css`, aliases →
  `@velnox/shared/*`.
- `lib/sites.ts` `SITE_URLS` defaults now point to the production domains
  (previously the removed `/velshop.html`-style paths).

## 11. Convex changes

- `convex/` remains the single shared backend; one deployment for all apps.
- **`commerce:catalogProductsAction`** — verified: exported as a **public
  action** in `convex/commerce.ts`, consumed by `apps/shop` via
  `api.commerce.catalogProductsAction`; generated API regenerated and in sync
  (the earlier "Could not find public function" error was stale
  deployment/generated state).
- **`convex/_generated` is now committed** (removed from `.gitignore`). The
  generated files embed no URLs or secrets. This makes every app build in a
  **clean checkout** (Vercel root dirs / CI) without needing a linked Convex
  deployment — `convex codegen` fails without `CONVEX_DEPLOYMENT`, so relying
  on it at build time would break clean builds. Regenerate with
  `bun convex codegen` when `convex/` source changes and commit together.

## 12. Backend changes

- `backend/` remains the shared Neon commerce core (single source, no
  per-app backends). No business logic rewritten.

## 13. Database status

- **Untouched.** Schema, migrations and data intact — no drops, truncates,
  resets or deletes. `db/` is the shared schema for all apps.

## 14. Authentication status

- Existing Convex Auth preserved (`convex/auth.ts`, `convex/auth/emailOtp.ts`,
  `packages/shared/src/pages/Auth.tsx`).
- Post-auth destinations are role/context-based (see `roleHome` in Auth.tsx):
  customers → `/shop`, sellers → seller.velnox.com, staff → center.velnox.com.
  No universal `/dashboard` target.

## 15. Authorization status

- Server-side enforced: `backend/permissions.ts` (role + department +
  permission catalog), `convex/users.ts` (role checks), `convex/centerAdmin.ts`
  (center admin ops), owner-gated staff management.
- Frontend guards (`RequireAuth`/`RequireRole`) preserve the requested path
  (`/auth?returnTo=...`) and are UX only.
- Seller scoping and payment-amount/shipping-fee checks are server-side
  (verified against the old snapshot: root has these fixes, the snapshot did
  not).

## 16. Environment variables

| Variable | Scope | Notes |
|---|---|---|
| `VITE_CONVEX_URL` | Vite (all apps) | required; same deployment for all 4 apps |
| `VITE_VELSHOP_URL` / `VITE_VELSELLER_URL` / `VITE_VELCENTER_URL` / `VITE_CORPORATE_URL` | Vite | cross-site links; default = production domains |
| `VITE_SITE_BASENAME` | Vite | `""` for standalone domain deploy |
| `DATABASE_URL` | Convex (Neon) | required backend secret |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Convex | product/seller/avatar image uploads |
| `SITE_URL` / `VLY_APP_NAME` | Convex | optional |
| `JWT_PRIVATE_KEY` / `JWKS` | Convex Auth | managed automatically |

No secrets are exposed through `VITE_*`; backend secrets live on the Convex
deployment (Keys/API keys UI), never in a Vite env file. `docs/ENVIRONMENT.md`
and each app README document the variables. `.env.example` files are managed
by the platform (sandbox blocks direct `.env*` file edits).

## 17. Build results (all pass)

| App | Command | Result |
|---|---|---|
| shop | `cd apps/shop && bun run build` | ✅ ~8.2s |
| seller | `cd apps/seller && bun run build` | ✅ ~7.8s |
| center | `cd apps/center && bun run build` | ✅ ~6.9s |
| corporate | `cd apps/corporate && bun run build` | ✅ ~4.2s |

## 18. Test results

- `bun tsc -b --noEmit` (full monorepo) ✅
- `bun test` ✅ **79 pass / 0 fail** across 8 files

## 19. Remaining issues

| # | File | Issue | Severity | Recommended fix |
|---|---|---|---|---|
| 1 | `INSTALL_AND_USAGE.md` | Long Thai manual still describes the old 3-site/`velshop.html` architecture | Low (docs only) | Rewrite/trim the manual to match the monorepo when convenient; README + apps/README already describe the current structure |
| 2 | `docs/ARCHITECTURE.md`, `docs/*PHASE*` | Historical reports reference the removed `velnox-mvp/` snapshot | Info (historical docs) | Leave as history, or purge when docs are consolidated |
| 3 | Vercel (per app) | Per-app `bun run build` requires `convex/_generated` present — now committed, so clean Vercel builds work | Resolved | Keep `_generated` committed; regenerate + commit with `convex/` changes |
| 4 | Production env | No production env vars set yet (`freebuff-deploy env list` empty) | Setup | Set `VITE_CONVEX_URL` (+ backend secrets on Convex) before first deploy |
