# VelShop

Customer-facing Velnox commerce application — the storefront customers use to
browse, cart, checkout, track orders and reorder ("Commerce that remembers you").

## Where the source lives

VelShop is **not** a Next.js app and has no private copy of its source here.
This repository is a **single Vite multi-entry application** (React 19 + Vite 7)
whose four deployable sites (corporate / velshop / velseller / velcenter) share
one source tree, one Convex backend (`src/convex/`) and one Neon database
(`src/backend/` + `db/`). That is a documented, deliberate architecture decision
— see `docs/RESTRUCTURE_INVENTORY.md` §16 and `apps/README.md`. Copying or
moving the shared source into `apps/shop` would duplicate it and break the
other three sites, so the real VelShop code stays where it is and this folder
is the deploy contract for the `velnox-shop` Vercel project.

| Piece | Location |
|---|---|
| Entry HTML | `../../velshop.html` |
| Bootstrap / router (15 routes) | `../../src/sites/velshop/main.tsx` |
| Pages | `../../src/pages/Shop*.tsx`, `MyOrders`, `ShopOrderDetail`, `ShopTracking`, `VelRepeatPage`, … |
| Shop components | `../../src/components/shop/` |
| Shared UI kit | `../../src/components/ui/` |
| Cart / tracking / memory | `../../src/lib/cart.tsx`, `track.ts`, `customer-memory-core.ts`, `shop.ts`, `seo.ts`, `sites.ts` |
| Backend (Convex + Neon) | `../../src/convex/`, `../../src/backend/` |
| Static assets | `../../public/` |

## Routes

`/shop` · `/shop/products` · `/shop/categories` · `/shop/products/:productId` · `/shop/shops/:shopId`
· `/shop/cart` · `/shop/checkout` (auth) · `/shop/orders` (auth) · `/shop/orders/:orderId` (auth)
· `/shop/orders/:orderId/tracking` (auth) · `/shop/velrepeat` (auth) · `/shop/wishlist` (auth)
· `/shop/addresses` (auth) · `/shop/profile` (auth) · `/shop/notifications` (auth) · `/auth`

## Development

```bash
bun install          # at the repo root (this package is a workspace member)
bun run dev:shop     # from the repo root  -> http://localhost:5173/velshop.html
# or, from this folder:
bun run dev          # opens the same app via apps/shop/vite.config.ts
```

## Build

```bash
bun run build        # from this folder -> static output in apps/shop/dist
```

The build reuses the root `vite.config.velshop.ts` (same `@/` alias, plugins,
velshop.html entry and manual chunking) with `root` pointed at the repo root so
the shared source and `public/` assets resolve identically to the root build.

## Deploy (Vercel)

- Repository: `EnJirad/velnox-mvp`
- **Root Directory:** `apps/shop`
- **Framework:** Vite (auto-detected from `package.json` — this is not Next.js)
- **Build Command:** `bun run build` (or `vite build --config ./vite.config.ts`)
- **Install Command:** `bun install` (Bun workspace, hoisted from repo root)
- **Output Directory:** `dist`
- **Production domain:** `https://shop.velnox.com`
- `vercel.json` in this folder applies the shared security headers and rewrites
  all routes to `velshop.html` so `/shop`, `/shop/cart`, … work at the domain root.

## Environment variables (client / Vite)

Set these in the Vercel project env (values are NOT secrets — no `.env` files
are committed):

- `VITE_CONVEX_URL` — Convex deployment URL (**required**)
- `VITE_VELSHOP_URL` / `VITE_VELSELLER_URL` / `VITE_VELCENTER_URL` / `VITE_CORPORATE_URL` — live domains of the four sites (cross-site links)
- `VITE_SITE_BASENAME` — empty string for a standalone domain deploy

Backend secrets (`DATABASE_URL`, `CLOUDINARY_*`, `JWT_PRIVATE_KEY`, `SITE_URL`,
`VLY_CONVEX_AUTH_ISSUER`) are Convex deployment env vars — set them on the
Convex deployment (Keys/API keys), never in a Vite `.env`.
