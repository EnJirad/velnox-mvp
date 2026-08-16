# Velnox Apps — Real Monorepo

Velnox is a platform composed of **four independent web applications** sharing
one Convex backend + one Neon database:

| App | Folder | Purpose | Domain | Entry |
|---|---|---|---|---|
| **VelShop** | `apps/shop` | Public customer storefront (commerce) | shop.velnox.com | `src/main.tsx` → `/` |
| **VelSeller** | `apps/seller` | Seller platform (goals, products, reorder, orders, income) | seller.velnox.com | `src/main.tsx` → `/seller/goals` |
| **VelCenter** | `apps/center` | Internal operator platform (RBAC, noindex) | center.velnox.com | `src/main.tsx` → `/` |
| **Velnox Corporate** | `apps/corporate` | Public company website (no Convex/auth) | velnox.com | `src/main.tsx` → `/` |

## Rules of this monorepo

- Each app is a **standalone Vite project** (own `package.json`, `vite.config.ts`,
  `tsconfig.json`, `index.html`, `public/`, `src/`). Each builds independently:
  `cd apps/<app> && bun run build`.
- Apps must **not** import each other's source. They communicate through the
  production domains (`SITE_URLS` in `@velnox/shared/lib/sites`) — a full page
  load, never an internal route.
- Shared frontend code (UI kit, libs, hooks, auth guards, Auth/NotFound pages,
  global theme CSS) lives in **`@velnox/shared`** (`packages/shared/src`) and is
  imported as `@velnox/shared/...`. Imports aliased `@/*` inside an app resolve
  only to that app's own `src/`.
- The **Convex backend is shared** (`convex/` at the repo root, one deployment)
  and the **Neon commerce core is shared** (`backend/` + `db/`). No per-app
  databases, no duplicated business logic.
- Authorization is enforced server-side in Convex (`convex/users.ts`,
  `convex/centerAdmin.ts`, `backend/permissions.ts`). Frontend route guards
  (`RequireAuth` / `RequireRole`) are UX only.

## Vercel — 4 projects from one repository

| Vercel project | Root Directory | Build | Output |
|---|---|---|---|
| velnox-shop | `apps/shop` | `bun run build` | `dist` |
| velnox-seller | `apps/seller` | `bun run build` | `dist` |
| velnox-center | `apps/center` | `bun run build` | `dist` |
| velnox-corporate | `apps/corporate` | `bun run build` | `dist` |

Install command for every project: `bun install` (Bun workspace, hoisted from
the repo root). Every app folder carries its own `vercel.json` (security
headers + SPA rewrite). Env per app: see each README; secrets live on the
Convex deployment, not in Vite env vars.
