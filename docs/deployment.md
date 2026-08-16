# Velnox — Deployment

> Canonical deployment guide (current state — four standalone apps). Detailed runbook:
> [`DEPLOYMENT.md`](./DEPLOYMENT.md) · `docs/production/deploy-runbook.md` · `docs/production/deployment.md`.

## 1. What gets deployed

| Project | Root directory | Domain | Purpose |
|---|---|---|---|
| `velnox` (corporate) | `apps/corporate` | https://velnox.com | corporate website |
| `velshop` | `apps/shop` | https://shop.velnox.com | public customer storefront |
| `velseller` | `apps/seller` | https://seller.velnox.com | seller platform |
| `velcenter` | `apps/center` | https://center.velnox.com | private operator/admin platform |

All four are standalone Vite + React apps sharing **one Convex deployment** and **one Neon
database**. Do not point an app at the repo root `/` — each Vercel project uses its own app
root.

## 2. Build configuration (per Vercel project)

- Framework preset: **Vite**
- Install command: `bun install`
- Build command: `bun run build` (each app's `package.json` script builds its own `dist`)
  - e.g. `build:shop` → `vite build --config apps/shop/vite.config.ts`
- Output directory: `dist`
- Package manager: Bun (`bun.lock` is committed)

Each `apps/*/vercel.json` already ships security headers (CSP, HSTS, X-Content-Type-Options,
Referrer-Policy, Permissions-Policy) and an SPA rewrite (`/(.*) → /`) so direct routes like
`https://shop.velnox.com/products` never 404 on refresh.

## 3. Environment variables

### Public (Vite — safe for the browser), set per Vercel project

| Var | Where | Notes |
|---|---|---|
| `VITE_CONVEX_URL` | all 4 projects | **must** point to the same Convex deployment (production in prod) |
| `VITE_VELSHOP_URL` / `VITE_VELSELLER_URL` / `VITE_VELCENTER_URL` / `VITE_CORPORATE_URL` | where cross-app links matter | defaults to the production domains; set only when a deployment differs |
| `VITE_SITE_BASENAME` | optional | `""` (default `/`) for standalone domains — do not set `/shop` |

### Backend secrets (Convex deployment env — **never** in Vercel / browser)

| Var | Used by |
|---|---|
| `DATABASE_URL` | `backend/db.ts` (Neon) |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | `backend/storage.ts` (product images) |
| `VLY_APP_NAME` | OTP email sender label |

Convex Auth's `JWT_PRIVATE_KEY`/`JWKS` are managed by the Convex platform. Do not copy them into
frontend env vars.

## 4. Convex backend deployment

```bash
bun convex dev --once          # local (non-interactive) codegen + push
npx convex deploy              # production deployment (from CI or machine with access)
```

- Codegen (`convex/_generated`) runs during deploy; do not hand-edit generated files.
- Health check: `GET <convex-url>/health` → `{"status":"ok"}`.
- Crons (durable event flush) are registered automatically from `convex/crons.ts`.

## 5. Neon database

```bash
DATABASE_URL=<neon-connection-string> bun run db:migrate   # idempotent (schema + migrations)
DATABASE_URL=<neon-connection-string> bun run db:smoke      # smoke check
DATABASE_URL=<neon-connection-string> bun run db:consistency
```

Migrations are idempotent (`CREATE TABLE IF NOT EXISTS` …). Never point local development at the
production database.

## 6. Production deploy order

1. **Neon production** — run migrations + smoke + consistency.
2. **Convex production** — `npx convex deploy`, verify `/health`, set backend env.
3. **Four Vercel projects** — import repo, set root dir, build commands, public env.
4. **Custom domains** — add each domain in Vercel, follow the registrar DNS steps, wait for
   propagation, verify SSL, test direct routes.
5. **Smoke test** — see `docs/production/deploy-runbook.md` §3.

Full step-by-step (with feature freeze rules): `docs/production/deploy-runbook.md`.
