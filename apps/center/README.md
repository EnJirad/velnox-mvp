# VelCenter

Internal Velnox operator / administration platform — company KPIs, order
management, seller & staff operations, purchase-cycle intelligence, role-based
access (owner / admin / staff). Internal only: noindex, auth required, and
authorization is enforced server-side in Convex.

**Production domain:** https://center.velnox.com

## What's here

| Piece | Location |
|---|---|
| Entry HTML | `index.html` (`<meta robots=noindex>`) |
| Bootstrap / router | `src/main.tsx` |
| Operator page | `src/pages/Center.tsx` |
| Shared UI/lib/hooks/auth + seller tooling components | `@velnox/shared` → `../../packages/shared/src/` |
| Shared Convex backend | `../../convex/` (one deployment for all Velnox apps) |
| Shared Neon commerce core | `../../backend/` + `../../db/` |

## Development

```bash
bun install              # at the repo root (Bun workspace)
bun run dev:center       # from the repo root → http://localhost:5173
# or, from this folder:
bun run dev
```

## Build

```bash
bun run build            # from this folder → static output in apps/center/dist
```

## Deploy (Vercel)

- Repository: `EnJirad/velnox-mvp`
- **Root Directory:** `apps/center`
- **Framework:** Vite · **Build:** `bun run build` · **Install:** `bun install` · **Output:** `dist`
- `vercel.json` applies security headers + SPA rewrite to `index.html`.
- Access: `RequireRole role="center"` (owner/admin/staff) + server-side
  permission checks in `convex/centerAdmin.ts` / `backend/permissions.ts`.

## Environment variables (client / Vite)

- `VITE_CONVEX_URL` — Convex deployment URL (**required**)
- `VITE_VELSHOP_URL` / `VITE_VELSELLER_URL` / `VITE_VELCENTER_URL` / `VITE_CORPORATE_URL` — live domains
- `VITE_SITE_BASENAME` — empty for standalone domain deploy

Backend secrets (`DATABASE_URL`, `CLOUDINARY_*`, `JWT_PRIVATE_KEY`, `SITE_URL`,
`VLY_CONVEX_AUTH_ISSUER`) are Convex deployment env vars.
