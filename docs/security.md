# Velnox — Security

> Canonical security overview. Detailed legacy doc: [`SECURITY.md`](./SECURITY.md) ·
> `docs/production/security.md`. Tests: `tests/security.test.ts`.

## 1. Authentication

- **Convex Auth** — email OTP (6-digit, 15 min) + anonymous guest sessions. Sessions are
  httpOnly cookies managed by the backend — tokens never live in `localStorage`.
- Roles (stored server-side on the user): `owner`, `admin`, `staff` (VelCenter employees,
  department-scoped), `seller` (VelSeller merchants), `customer` (default).

## 2. Authorization — enforced server-side, never UI-only

| Guard | Module | Enforces |
|---|---|---|
| `canSell` / `canAdmin` / `canAccessCenter` / `canManageStaff` | `convex/users.ts` | role gates for seller/admin/center functions |
| `requireIdentity` | `backend/identity.ts` | login + user row for customer writes |
| `requireSeller` | `backend/identity.ts` | seller + their own shop |
| `requirePermission` | `backend/identity.ts` | role + permission list for center writes |
| ownership chain `User→Seller→Shop→Product` | `convex/commerce.ts` | every write is ownership-checked server-side |

- **VelCenter is private**: knowing `https://center.velnox.com` grants nothing — Convex guards
  require an authenticated account with `staff/admin/owner` role; no public queries expose
  internal data.
- **Seller isolation (IDOR)**: seller actions read/write only their own store's products,
  orders, and income (`listOrdersForSeller`, `sellerIncome`, etc. filter by `seller_id`
  server-side).
- **Customer privacy**: profile, addresses, orders, wishlist, subscriptions, and memory reads are
  scoped to the authenticated user's own rows (`memory.ts` — “ของใคร ของมัน”). Guests only
  contribute anonymous popularity signals.

## 3. Input validation & abuse prevention

- Every mutation validates with zod before touching the DB (`backend/validation.ts`): ids, GPS
  pairs for shipping addresses, prices, quantities, ratings.
- Server-side rate limiting (`convex/rateLimit.ts`, sliding window): customer events (300/min),
  checkout, reviews, returns, OTP flows.
- `track` is fire-and-forget: rate-limit failures are swallowed, never surfaced to the UI.

## 4. Money & order integrity

- All money math is server-side (`backend/orders.ts`, `payments.ts`, `commissions`): prices,
  fees, totals, refunds are never accepted from the client.
- `createOrder` is one DB transaction: idempotency key → row locks → inventory reservation →
  order + items + commission snapshot → optional payment row. Retries cannot create duplicate
  orders.
- Orders snapshot address + item prices at order time; payment/refund state transitions are
  validated server-side.

## 5. Secrets

- `DATABASE_URL`, `CLOUDINARY_*` are server-side only (`backend/db.ts`, `backend/storage.ts`).
- Frontends receive only public `VITE_*` vars; no `VITE_DATABASE_URL`-style vars exist.
- Never log passwords, tokens, keys, or payment credentials (`backend/audit.ts` logs actions and
  entity ids, not secrets).

## 6. Transport & headers

- Per-app `vercel.json` ships: CSP (restrictive, allows only needed origins), HSTS
  (2 years + preload), `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`.
- Production uses HTTPS custom domains (see `deployment.md`).

## 7. Observability of security events

- `backend/audit.ts` writes immutable `audit_logs` for every important action (approve seller,
  edit product, change settings, refunds, …) — VelCenter can answer “ใคร ทำอะไร กับอะไร
  เมื่อไหร่”.
- Sentry captures frontend errors; `/health` + Neon/Convex monitoring cover availability.
- Monitor auth failures, authorization failures, checkout/payment failures
  (`docs/production/monitoring.md`).
