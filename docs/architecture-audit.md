# Velnox — Architecture Audit

> Written 2026-08-16 from a full repository inspection. Status: the repository has **already**
> been migrated to the target monorepo architecture; this audit records what was verified, the
> problems found, and the remaining work. Detailed phase reports live in
> [`PHASE-*-REPORT.md`](./) and [`FINAL_ARCHITECTURE_REPORT.md`](./FINAL_ARCHITECTURE_REPORT.md).

## 1. Current architecture (verified)

| Area | State |
|---|---|
| Monorepo | ✅ `apps/{shop,seller,center,corporate}` + `packages/shared` (Bun workspaces, `turbo`-style root scripts) |
| Four apps | ✅ Each app standalone Vite+React, own root route, own `vercel.json` (CSP/security headers + SPA rewrites) |
| VelShop storefront-first | ✅ `/` is the storefront; no `/shop` prefix; no public app switcher; single seller entry in footer |
| Neon = source of truth | ✅ `backend/*` services + `db/schema.sql` + 10 idempotent migrations; `DATABASE_URL` server-side only |
| Convex = realtime/intelligence | ✅ `commerce.ts` node actions bridge frontends → Neon; `memory.ts`/`intelligence.ts` derive customer memory |
| Durable behavioral events | ✅ **New (this audit):** `behavioral_events` table + `event_flush_cursor` + 15-min cron flush (migration 011) |
| Auth | ✅ Convex Auth (email OTP + anonymous), roles `owner/admin/staff/seller/customer`, department scoping |
| Authorization (server-side) | ✅ `convex/users.ts` guards (`canSell`, `canAdmin`, `canAccessCenter`, `canManageStaff`) + `backend/identity.ts` guards + ownership chains |
| Order/payment safety | ✅ idempotency keys, `withTransaction`, inventory locking, commission snapshot, audit trail |
| Rate limiting | ✅ `convex/rateLimit.ts` sliding window (customer events, checkout, reviews, OTP) |
| Input validation | ✅ zod schemas in `backend/validation.ts` (GPS-required shipping addresses, prices, ids) |
| Testing | ✅ 79 vitest tests (business rules, security matrix, memory core, velrepeat, validation, errors, providers) |
| Observability | ✅ `/health` HTTP route, Sentry in frontend, audit logs, phase-13 monitoring docs |
| Docs | ✅ Extensive `docs/` tree (see §6 for the canonical set) |

## 2. Problems found & fixed in this audit

1. **Behavioral events had no durable persistence outside Convex** (§11, §64).
   `customerEvents` (product views, searches, cart actions, purchases…) lived only in the Convex
   realtime store — if Convex were lost, the intelligence history was lost.
   **Fixed:** Neon `behavioral_events` (append-only, deduped on `(source, source_event_id)`) +
   `event_flush_cursor` + `convex/behavioralEvents.ts` cron flush (15 min, idempotent). The full
   event history is now durable and the Convex intelligence layer is rebuildable from it.

2. **Stale doc reference:** `docs/production/deploy-runbook.md` still told operators to set
   `VITE_SITE_BASENAME=/shop` for VelShop. The `/shop` prefix was removed (VelShop owns its domain
   root). **Fixed** to `VITE_SITE_BASENAME=""`.

3. **Environment loading across apps** (fixed in a prior session): Vite `root` is `apps/*`, so the
   repo-root env file was not loaded; all four `vite.config.ts` now set `envDir` to the repo root.

4. **Shared Tailwind classes missing** (fixed in a prior session): Tailwind v4 did not scan
   `packages/shared/src`; `@source "./"` in `packages/shared/src/index.css` restored shared styles
   (incl. the approved mobile floating navigation).

## 3. Duplicate / obsolete systems

- **Legacy Convex-table commerce**: `convex/orders.ts` and `convex/products.ts` still read/write
  Convex tables (`orders`, `orderItems`, `products`) for the **legacy** storefront flows
  (VelRepeat subscriptions, customer regulars, inventory management). The **Neon** Commerce Core
  is authoritative; order creation goes through `commerce.ts` → `backend/checkout.ts` → Neon.
  Keeping the legacy tables is a deliberate compatibility decision — the realtime storefront
  reads them as projections. **Do not** treat them as authoritative; new business flows must go
  through Neon.
- **`businessEvents`** (Convex) mirrors Neon facts (OrderCreated, PaymentConfirmed…) for realtime
  dashboards. It is derived — rebuildable from Neon, never authoritative.

## 4. Security posture (audited)

- Frontend never receives `DATABASE_URL` or any backend secret (all `VITE_*` are public-safe).
- Every admin/seller endpoint validates role **server-side**; VelCenter pages additionally guard
  on the client, but access is enforced by Convex guards.
- IDOR: seller/customer reads are scoped server-side (own store / own user); orders snapshot
  address + price; wishlist/cart keyed to the authenticated user.
- CSP + security headers shipped per app via `vercel.json`; HSTS enabled.
- See [`security.md`](./security.md) for the full matrix and [`SECURITY.md`](./SECURITY.md)
  (detailed legacy doc).

## 5. Migration plan — remaining work

| # | Item | Status |
|---|---|---|
| 1 | Durable behavioral event store (Neon) + cron flush | ✅ done (migration 011, `backend/events.ts`, `convex/behavioralEvents.ts`, `convex/crons.ts`) |
| 2 | Rebuild-from-events drill (Convex memory from `behavioral_events`) | 📋 documented in `disaster-recovery.md`; needs an operator-run drill before launch |
| 3 | VelRepeat prediction (next-purchase-date from durable events) | 📋 foundation in place (`backend/subscriptions.ts` cycle learning); prediction endpoint is next |
| 4 | Full payment-provider integration (provider abstraction exists; wire real PSP) | 📋 pending credentials |
| 5 | Sitemap/robots + structured data for public apps | 📋 pending (SEO pass) |
| 6 | Production smoke tests after first deploy | 📋 runbook in `docs/production/` |

## 6. Canonical docs (created/updated in this pass)

- `docs/architecture.md` — this architecture overview
- `docs/architecture-audit.md` — this audit
- `docs/data-ownership.md` — who owns what, what is rebuildable
- `docs/realtime.md` — event vocabulary + realtime pipeline
- `docs/disaster-recovery.md` — backup, recovery scenarios, RPO/RTO
- `docs/deployment.md` — Vercel/Convex/Neon deployment
- `docs/environment.md` — env separation
- `docs/security.md` — authz matrix + security controls
