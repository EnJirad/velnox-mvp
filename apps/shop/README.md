# VelShop

Customer-facing Velnox commerce application — the storefront customers use to
browse, search, cart, checkout, track orders and reorder ("Commerce that
remembers you · จำแทนคุณ").

**Production domain:** https://shop.velnox.com

## What's here

This is a real, independently deployable Vite app:

| Piece | Location |
|---|---|
| Entry HTML | `index.html` |
| Bootstrap / router (16 routes) | `src/main.tsx` |
| Storefront pages | `src/pages/` (`ShopHome`, `ShopProducts`, `ShopCategories`, `ShopProductDetail`, `ShopDetail`, `ShopCart`, `ShopCheckout`, `MyOrders`, `ShopOrderDetail`, `ShopTracking`, `VelRepeatPage`, `ShopWishlist`, `ShopAddresses`, `ShopProfile`, `ShopNotifications`) |
| Shop components | `src/components/shop/` (ShopHeader, CartDrawer, ProductDetailModal, MapPicker, SubscriptionDialog) |
| Shop-only libs | `src/lib/cart.tsx`, `src/lib/seo.ts` |
| Shared UI/lib/hooks/auth | `@velnox/shared` → `../../packages/shared/src/` |
| Shared Convex backend | `../../convex/` (one deployment for all Velnox apps) |
| Shared Neon commerce core | `../../backend/` + `../../db/` |

## Development

```bash
bun install              # at the repo root (Bun workspace)
bun run dev:shop         # from the repo root → http://localhost:5173
# or, from this folder:
bun run dev
```

## Build

```bash
bun run build            # from this folder → static output in apps/shop/dist
```

Independent from the other three apps — nothing here builds the seller, center
or corporate applications.

## Deploy (Vercel)

- Repository: `EnJirad/velnox-mvp`
- **Root Directory:** `apps/shop`
- **Framework:** Vite (auto-detected from `package.json`)
- **Build Command:** `bun run build` · **Install Command:** `bun install` · **Output Directory:** `dist`
- `vercel.json` applies security headers and rewrites all routes to `index.html`
  so `/shop`, `/shop/cart`, … work at the domain root.
- Set `VITE_SITE_BASENAME=""` for a standalone domain.

## Environment variables (client / Vite)

- `VITE_CONVEX_URL` — Convex deployment URL (**required**)
- `VITE_VELSHOP_URL` / `VITE_VELSELLER_URL` / `VITE_VELCENTER_URL` / `VITE_CORPORATE_URL` — live domains (cross-site links; defaults to the other apps' domains)
- `VITE_SITE_BASENAME` — empty for standalone domain deploy
- Optional: `VITE_VLY_APP_ID`, `VITE_VLY_MONITORING_URL` (VLY observability)

Backend secrets (`DATABASE_URL`, `CLOUDINARY_*`, `JWT_PRIVATE_KEY`, `SITE_URL`,
`VLY_CONVEX_AUTH_ISSUER`) are Convex deployment env vars — set them on the
Convex deployment, never in a Vite `.env`.
