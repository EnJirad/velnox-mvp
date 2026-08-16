# VelSeller

Seller platform for Velnox — the separate web application merchants use to run
their shop: goals, store management, products, reorder (Smart Reorder),
orders and income. It is **not** a route inside VelShop.

**Production domain:** https://seller.velnox.com

## What's here

| Piece | Location |
|---|---|
| Entry HTML | `index.html` |
| Bootstrap / router | `src/main.tsx` |
| Seller pages | `src/pages/` (`SellerGoals`, `MyShop`, `Reorder`, `SellerOrders`, `Income`) |
| Seller tooling components (goals / reorder / seller dialogs) | `@velnox/shared` → `../../packages/shared/src/components/` (shared with VelCenter) |
| Shared UI/lib/hooks/auth | `@velnox/shared` → `../../packages/shared/src/` |
| Shared Convex backend | `../../convex/` (one deployment for all Velnox apps) |
| Shared Neon commerce core | `../../backend/` + `../../db/` |

## Development

```bash
bun install              # at the repo root (Bun workspace)
bun run dev:seller       # from the repo root → http://localhost:5173
# or, from this folder:
bun run dev
```

## Build

```bash
bun run build            # from this folder → static output in apps/seller/dist
```

## Deploy (Vercel)

- Repository: `EnJirad/velnox-mvp`
- **Root Directory:** `apps/seller`
- **Framework:** Vite · **Build:** `bun run build` · **Install:** `bun install` · **Output:** `dist`
- `vercel.json` applies security headers + SPA rewrite to `index.html`.
- Access is enforced server-side in Convex (`RequireRole role="seller"` +
  `convex/users.ts` role checks) — never trust the frontend alone.

## Environment variables (client / Vite)

- `VITE_CONVEX_URL` — Convex deployment URL (**required**)
- `VITE_VELSHOP_URL` / `VITE_VELSELLER_URL` / `VITE_VELCENTER_URL` / `VITE_CORPORATE_URL` — live domains
- `VITE_SITE_BASENAME` — empty for standalone domain deploy

Backend secrets (`DATABASE_URL`, `CLOUDINARY_*`, `JWT_PRIVATE_KEY`, `SITE_URL`,
`VLY_CONVEX_AUTH_ISSUER`) are Convex deployment env vars.
