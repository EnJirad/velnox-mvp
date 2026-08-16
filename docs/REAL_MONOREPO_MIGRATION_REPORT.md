# VELNOX — REAL MONOREPO MIGRATION REPORT

Date: 2026-08-16 · Repository: `EnJirad/velnox-mvp` · Package manager: **Bun**

## 1. Previous architecture

One **Vite multi-entry application** (React 19 + Vite 7 + TypeScript, NOT Next.js):
a single root `package.json`, 5 root HTML entries (`index.html` portal,
`velshop.html`, `velseller.html`, `velcenter.html`, `corporate.html`), one shared
`src/` tree containing everything (pages for all four sites, components, libs,
hooks), one Convex backend (`src/convex/`), one Neon commerce core
(`src/backend/` + `db/`), and root-level per-site Vite configs
(`vite.config.velshop.ts`, etc.). The portal (`index.html` → `src/main.tsx`) was
a generic application launcher / dashboard redirect hub.

## 2. New architecture

Real monorepo: 4 independent Vite apps + 1 shared frontend package + shared
backend infrastructure at the repo root.

```
velnox-mvp/
├── apps/
│   ├── shop/      VelShop (shop.velnox.com) — storefront
│   ├── seller/    VelSeller (seller.velnox.com) — seller platform
│   ├── center/    VelCenter (center.velnox.com) — operator platform (noindex)
│   └── corporate/ Velnox Corporate (velnox.com) — company site
├── packages/
│   └── shared/    @velnox/shared — UI kit, libs, hooks, auth, theme CSS
├── convex/        shared Convex backend (one deployment)
├── backend/       shared Neon commerce core
├── db/            shared schema/migrations (untouched)
├── tests/         vitest suites (root)
├── docs/
├── package.json   monorepo orchestrator (Bun workspaces: apps/*, packages/*)
├── bun.lock
└── tsconfig.json  solution file → references all apps + shared + node config
```

## 3. Applications created (each real, independently buildable)

| App | package.json | vite.config.ts | tsconfig.json | index.html | src/ |
|---|---|---|---|---|---|
| `apps/shop` | ✓ `@velnox/shop` | ✓ | ✓ | ✓ | `main.tsx` + 16 pages + `components/shop/` + `lib/{cart,seo}` |
| `apps/seller` | ✓ `@velnox/seller` | ✓ | ✓ | ✓ | `main.tsx` + 5 pages (`SellerGoals`, `MyShop`, `Reorder`, `SellerOrders`, `Income`) |
| `apps/center` | ✓ `@velnox/center` | ✓ | ✓ | ✓ | `main.tsx` + `pages/Center.tsx` |
| `apps/corporate` | ✓ `@velnox/corporate` | ✓ | ✓ | ✓ | `main.tsx` + `pages/corporate/*` |

Each app owns its routes, has its own `public/` (logo, manifest, robots,
sitemap) and its own `vercel.json` (security headers + SPA rewrite to `/`).
The old generic **portal/launcher was removed** — `velnox.com` is now the
corporate website, `shop.velnox.com/` opens the storefront, and the seller
platform is a separate application reached via the "ขายของ" link in the
VelShop header (→ `SITE_URLS.velseller`).

## 4. Files/directories moved

- `src/convex/` (19 files) → `convex/` — `convex.json` `functions` path updated
- `src/backend/` (27 files) → `backend/` — internal relative imports unchanged
- `src/components/ui/` (46) + `src/components/{AppHeader,Logo,LogoDropdown,MobileTabBar,RequireAuth,RequireRole,SiteSwitcher,UserMenu}.tsx` +
  `components/{goals,seller,reorder}/` (8) → `packages/shared/src/components/`
- `src/lib/{utils,sites,track,app-shell,monitoring,customer-memory-core,commerce,shop,reorder,goals,vly-integrations}.*` (11) → `packages/shared/src/lib/`
- `src/hooks/*` (2), `src/pages/{Auth,NotFound}.tsx` (2), `src/index.css`,
  `src/types/global.d.ts`, `src/assets/logo.svg`, `src/instrumentation.tsx` → `packages/shared/src/`
- VelShop code (16 pages, `components/shop/`, `lib/{cart,seo}.tsx`,
  `sites/velshop/main.tsx`) → `apps/shop/src/`
- VelSeller code (`Dashboard` → **renamed `SellerGoals`**, `MyShop`, `Reorder`,
  `SellerOrders`, `Income`, `sites/velseller/main.tsx`) → `apps/seller/src/`
- VelCenter (`Center.tsx`, `sites/velcenter/main.tsx`) → `apps/center/src/`
- Corporate (`pages/corporate/*`, `sites/corporate/main.tsx`) → `apps/corporate/src/`
- `src/lib/customer-memory-core.test.ts` → `tests/`

## 5. Shared package created

**`@velnox/shared`** (`packages/shared`) — a single cohesive package holding
everything used by ≥2 applications (UI kit, libs, hooks, auth guards, Auth &
NotFound pages, global theme CSS). Justification: spec §9 (“create shared
packages only where justified”) — the shared surface is one interlocking module;
splitting into 8 packages would add 8× configuration with no behavioral benefit.
App-specific code was **not** over-shared: `lib/cart.tsx`, `lib/seo.ts`,
`components/shop/*` stay in `apps/shop`; the seller/center-shared goals,
reorder and seller dialogs live in `@velnox/shared`.

## 6. Files removed (after new apps built & verified)

- Root HTML entries: `index.html`, `velshop.html`, `velseller.html`,
  `velcenter.html`, `corporate.html`
- Root Vite configs: `vite.config.ts`, `vite.config.velshop.ts`,
  `vite.config.velseller.ts`, `vite.config.velcenter.ts`, `vite.config.corporate.ts`
- Root `vercel.json` (obsolete multi-entry contract; per-app files replace it)
- Portal application: `src/main.tsx`, `src/pages/Landing.tsx` (generic
  launcher — forbidden by spec §59–66), and the now-empty `src/` tree
- Root `tsconfig.app.json` (replaced by per-app + shared configs)

## 7. Configuration changes

- Root `package.json`: workspaces `["apps/*", "packages/*"]`; scripts now
  orchestrate the apps (`dev`/`build` default to VelShop; `dev:seller|center|corporate`,
  `build:shop|seller|center|corporate`, `build:apps`, `typecheck`, `test`, db scripts).
- `convex.json`: functions path `src/convex/` → `convex/`.
- `.gitignore`: `src/convex/_generated` → `convex/_generated`.
- Root `tsconfig.json`: solution file referencing `apps/*`, `packages/shared`,
  `tsconfig.node.json` (which now covers `backend`, `convex`, `db`, `tests`).
- `db/*.ts` scripts: `../src/backend/db` → `../backend/db`.

## 8. Vite changes

Each app has its own `vite.config.ts`: `root` = app dir, plugins
`react` + `vlyPlugin` + `@tailwindcss/vite`, `resolve.alias` (longest-first
array form) for `@velnox/shared` → `packages/shared/src`, `@convex/_generated`
→ `convex/_generated`, `@` → app `src/`, React `dedupe`, `outDir` =
`<app>/dist`. No `hmr` settings were added (Freebuff constraint preserved).
Root `bun run build` builds VelShop and copies `apps/shop/dist` → root `dist/`
for the platform preview/hosting path.

## 9. TypeScript changes

- `@/*` in every app resolves to that app's own `src/*` (spec §30).
- `@velnox/shared/*` → `packages/shared/src/*` (both in apps and inside the
  package itself).
- `@convex/_generated/*` → `convex/_generated/*` (apps + shared).
- Per-app `src/vite-env.d.ts` + one in `packages/shared` restore `vite/client`
  types (`import.meta.env`, `*.css`, `*.svg` module declarations).
- Root `tsc -b --noEmit` covers all apps, the shared package and backend infra.

## 10. Convex changes

Centralized at `convex/` (unchanged logic). `convex/memory.ts` &
`convex/memoryEvents.ts` now import the shared customer-memory core via
`../packages/shared/src/lib/customer-memory-core`. **`catalogProductsAction`
verified**: exported in `convex/commerce.ts` (`export const catalogProductsAction
= action(...)`), the regenerated `convex/_generated` API includes the `commerce`
module, and `apps/shop/src/pages/ShopProducts.tsx` consumes
`api.commerce.catalogProductsAction` through the `@convex/_generated` alias.
Codegen: `bun convex dev --once` → “Convex functions ready!”. No fake/placeholder
functions were created.

## 11. Authentication changes

`@velnox/shared/pages/Auth.tsx` (email OTP + anonymous) is shared by all three
authenticated apps. `currentSite()` now also detects the standalone
`/seller…` / `/center…` route prefixes so post-login redirects land correctly
on the separate domains (spec §69: customer → VelShop, seller → VelSeller,
operator → VelCenter — no generic `/dashboard`).

## 12. Authorization changes

None weakened — the same server-side enforcement remains authoritative:
- `convex/users.ts` role checks + `convex/centerAdmin.ts` staff-permission
  checks + `backend/permissions.ts` RBAC (owner/admin/staff/seller/customer).
- Frontend guards (`RequireAuth`, `RequireRole`) moved to `@velnox/shared` and
  are UX-only, as before. VelCenter stays `noindex` + role-gated.

## 13. Environment variables

Per-app client vars (documented in each app README; **no `.env` files are
committed**; `.env.example` per app is blocked by the platform's sensitive-file
policy, so env docs live in the READMEs):

- `VITE_CONVEX_URL` (required), `VITE_VELSHOP_URL` / `VITE_VELSELLER_URL` /
  `VITE_VELCENTER_URL` / `VITE_CORPORATE_URL`, `VITE_SITE_BASENAME=""`,
  optional `VITE_VLY_APP_ID` / `VITE_VLY_MONITORING_URL`.

Backend secrets (Convex deployment env, never in Vite):
`DATABASE_URL`, `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` /
`CLOUDINARY_API_SECRET`, `JWT_PRIVATE_KEY`, `SITE_URL`, `VLY_CONVEX_AUTH_ISSUER`.

## 14. Build results

| Check | Result |
|---|---|
| `bun convex dev --once` (codegen) | PASS — “Convex functions ready!” |
| `bun install` (Bun workspace) | PASS |
| `bun tsc -b --noEmit` (all projects) | PASS |
| `bun test` (vitest) | PASS — 79 tests, 0 fail |
| `cd apps/shop && bun run build` | PASS |
| `cd apps/seller && bun run build` | PASS |
| `cd apps/center && bun run build` | PASS |
| `cd apps/corporate && bun run build` | PASS |
| `bun run build` (root, platform path) | PASS — clean `dist/` (VelShop) |

## 15. Vercel configuration

| Project | Root Directory | Framework | Build | Output |
|---|---|---|---|---|
| velnox-shop | `apps/shop` | Vite (auto) | `bun run build` | `dist` |
| velnox-seller | `apps/seller` | Vite (auto) | `bun run build` | `dist` |
| velnox-center | `apps/center` | Vite (auto) | `bun run build` | `dist` |
| velnox-corporate | `apps/corporate` | Vite (auto) | `bun run build` | `dist` |

Install command for each: `bun install` (Bun workspace resolves the repo root).
Each app folder carries its own `vercel.json`. **Do not select “Next.js”** —
this is Vite.

## 16. Remaining known issues

- `vly-toolbar-readonly.tsx` (platform read-only toolbar, formerly used by the
  removed portal) is kept at the repo root but is no longer imported or
  typechecked by any app. Severity: **low**. Next step: remove when the
  platform no longer needs it.
- Root `public/` (legacy shared assets) and `main.ts` (Deno/Hono static server
  for `dist/`) remain at the root for platform compatibility. Severity: **low**.
  Next step: delete once platform hosting config moves fully to Vercel.
- `package-lock.json` (legacy npm lockfile) remains at root alongside `bun.lock`.
  Severity: **low**. Next step: delete.
- Root `README.md`, `ARCHITECTURE_V3_MIGRATION.md` and the `velnox-mvp/`
  snapshot folder still describe the old single-tree architecture. Severity:
  **low**. Next step: refresh root docs.
- Freebuff hosting (`bun run build`) deploys VelShop only; the other three apps
  deploy via their own Vercel projects. Severity: **none** for the target setup.
