# Velnox — Environment Variables

> Canonical env guide. Detailed legacy doc: [`ENVIRONMENT.md`](./ENVIRONMENT.md) ·
> `docs/production/environment.md`.

## 1. Separation rules

1. **Frontend (Vite)** receives only public-safe `VITE_*` values. `DATABASE_URL`, payment
   credentials, JWT secrets, and Cloudinary secrets **never** go into Vite/browser bundles.
2. **Backend (Convex node actions)** reads secrets from `process.env` in the **Convex deployment
   environment** (Keys/API keys UI) — `backend/db.ts`, `backend/storage.ts`, `convex/auth.ts`.
3. **Development / staging / production** use separate Convex deployments and separate Neon
   databases. Production secrets are never used locally; dev secrets never shipped to prod.

## 2. Public (per hosting project)

| Var | Example | Used by |
|---|---|---|
| `VITE_CONVEX_URL` | `https://<deployment>.convex.cloud` | all apps — must match the app's Convex deployment |
| `VITE_VELSHOP_URL` | `https://shop.velnox.com` | cross-app links (`packages/shared/src/lib/sites.ts`) |
| `VITE_VELSELLER_URL` | `https://seller.velnox.com` | cross-app links |
| `VITE_VELCENTER_URL` | `https://center.velnox.com` | cross-app links |
| `VITE_CORPORATE_URL` | `https://velnox.com` | cross-app links |
| `VITE_SITE_BASENAME` | `""` | router basename (defaults to `/`; keep empty for standalone domains) |

## 3. Backend secrets (Convex deployment env only)

| Var | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | `backend/db.ts` | Neon connection string — server-side only |
| `CLOUDINARY_CLOUD_NAME` | `backend/storage.ts` | product image upload |
| `CLOUDINARY_API_KEY` | `backend/storage.ts` | product image upload |
| `CLOUDINARY_API_SECRET` | `backend/storage.ts` | product image upload |
| `GOOGLE_CLIENT_ID` | `convex/auth.ts` | **Required for Google Sign-In** (primary login method) — OAuth Client ID (public by design, but set server-side) |
| `GOOGLE_CLIENT_SECRET` | `convex/auth.ts` | **Required** — OAuth Client Secret. **Never** in `VITE_*`/git; Convex deployment env only |
| `AUTH_ALLOWED_ORIGINS` | `convex/auth_redirect.ts` | Optional **JSON array** (parsed with `JSON.parse()` — not comma-separated) of post-OAuth redirect origins, e.g. `["https://velshop.vercel.app","https://velseller.vercel.app","https://velcenter.vercel.app"]` (default = the 3 current production domains + localhost; the env var **replaces** the defaults) |
| `EMAIL_OTP_ENABLED` | `convex/auth.ts` | Default `"false"` — Google OAuth ON, Email OTP OFF (backend kept; set `"true"` to re-enable) |
| `FREEBUFF_EMAIL_API_KEY` | `convex/auth/emailOtp.ts` | **Only if Email OTP is enabled** — **Resend API key** (`re_...`), server-side only, never a `VITE_*` var |
| `EMAIL_FROM` | `convex/auth/emailOtp.ts` | **Required if Email OTP is enabled** — sender under a verified Resend domain, e.g. `Velnox <no-reply@velnox.com>` (must be `velnox.com`, **not** Gmail, **not** `onboarding@resend.dev`). Resend only delivers from verified domains — the sandbox sender 403s for every recipient except the account owner. Missing → server logs a safe config error, users see the generic failure message |
| `SITE_URL` | `convex/auth_redirect.ts` + Stripe return URL | canonical origin (e.g. `https://velshop.vercel.app`) — single URL, never multi-value; must be an allowlisted origin |

Managed by Convex Auth (do not set manually): `JWT_PRIVATE_KEY`, `JWKS`.

## 4. Where each variable lives

| Env | Frontend vars | Backend vars |
|---|---|---|
| Local / preview | platform Keys UI → repo-root env file → loaded by Vite via `envDir` (all four configs point at the repo root) | Convex deployment env (local dev deployment) |
| Staging / preview deploy | Vercel project env (preview) | staging Convex deployment |
| Production | Vercel project env (production) | production Convex deployment |

## 5. Checklist

- [ ] `VITE_CONVEX_URL` in all four Vercel projects points to the production Convex deployment
- [ ] `DATABASE_URL` is the production Neon URL, set only in the Convex deployment env
- [ ] `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` set in the Convex deployment env, and the Google Cloud OAuth Client includes the `/api/auth/callback/google` redirect URI (see `docs/GOOGLE_OAUTH_UPGRADE_REPORT.md`)
- [ ] No `.env*` committed; `git status` clean of secrets
- [ ] No `process.env.<SECRET>` referenced from any `apps/*/src` or `packages/shared/src`
- [ ] Rotate any leaked credential immediately
