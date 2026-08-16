# Velnox — Production Architecture

> Canonical architecture overview (current state, 2026-08). Detailed phase docs:
> [`ARCHITECTURE.md`](./ARCHITECTURE.md) (Thai, approved architecture) · [`architecture-audit.md`](./architecture-audit.md) · [`data-ownership.md`](./data-ownership.md) · [`realtime.md`](./realtime.md)

## 1. The core principle

> **NEON = SOURCE OF TRUTH. CONVEX = REALTIME + EVENT + INTELLIGENCE LAYER.**

Neon PostgreSQL owns all permanent, business-critical data (users, sellers, shops, products,
inventory, orders, payments, commissions, subscriptions, audit). Convex owns realtime state,
behavioral events, customer memory/intelligence, notifications and derived values — everything
derived **must** be rebuildable from Neon + the durable event store.

If Convex disappears, the business data still exists in Neon and the intelligence layer can be
rebuilt by reprocessing history (`docs/disaster-recovery.md` §Convex).

## 2. Repo layout

```
velnox-mvp/
├── apps/
│   ├── shop/        VelShop      — public customer storefront      → shop.velnox.com
│   ├── seller/      VelSeller    — seller platform                  → seller.velnox.com
│   ├── center/      VelCenter    — internal operator/admin (private)→ center.velnox.com
│   └── corporate/   Velnox Group — corporate website                → velnox.com
├── packages/shared/  shared UI, i18n (th/en/my), customer-memory core, site URLs
├── backend/          Neon commerce-core services (server-side only)
├── convex/           Convex backend: auth, commerce bridge, intelligence, events, crons
├── db/               Neon schema.sql + idempotent numbered migrations + scripts
├── docs/             architecture, security, deployment, recovery, environment
└── tests/            vitest unit tests (business rules, security, memory, velrepeat, …)
```

Each `apps/*` is a standalone Vite + React app with its own `vite.config.ts`, `tsconfig.json`,
`package.json`, `index.html`, and `vercel.json` (security headers + SPA rewrites). They share one
Convex backend and one Neon database.

## 3. Data flow

```
Browser (any of the 4 apps)
        │  Convex queries/mutations (realtime subscriptions)
        ▼
   Convex (realtime + intelligence)
   ├── auth (Convex Auth: email OTP + anonymous) + roles
   ├── commerce.ts / customer.ts / sellerOps.ts / centerAdmin.ts   ← node actions ("use node")
   │        └── ownership checks (User→Seller→Shop→Product) then call backend/*
   ├── memory.ts / memoryEvents.ts / intelligence.ts                ← events + customer memory
   └── crons.ts / behavioralEvents.ts                               ← durable event flush
        │  server-side only (DATABASE_URL / CLOUDINARY_* live in Convex deployment env)
        ▼
   Neon PostgreSQL (Commerce Core — authoritative)   +   Cloudinary (product images)
```

Frontends never touch Neon directly and never decide business numbers (prices, fees, totals are
computed server-side in `backend/*`).

## 4. Layer responsibilities

| Layer | Owns | Example modules |
|---|---|---|
| **Neon** (authoritative) | users, sellers, shops, products, images metadata, inventory, addresses, orders, order items, payments, refunds, commissions, settlements, subscriptions, wishlist, cart, reviews, shipments, platform settings, audit logs, durable behavioral events | `backend/*`, `db/schema.sql`, `db/migrations/*` |
| **Convex** (realtime/derived) | auth + sessions + roles, customerEvents (behavioral), productViews, interests, businessEvents bridge, rate-limit counters, realtime notifications | `convex/*` |
| **Backend services** | all business logic: order creation (idempotent, transactional), payments, refunds, inventory, commissions, subscriptions, validation, audit | `backend/*` |
| **Frontends** | UI only — no DB access, no money math | `apps/*/src` |

## 5. Event pipeline (durable)

```
Browser action → customerEvents (Convex — realtime, fire-and-forget)
              → cron every 15 min → behavioral_events (Neon — durable, append-only)
              → memory.ts derives customer memory → recommendations / VelRepeat prediction
```

See [`realtime.md`](./realtime.md) for the full event vocabulary and `data-ownership.md` for what
is rebuildable and how.

## 6. Environments

Development / staging / production use **separate Convex deployments and Neon databases**.
Public `VITE_*` vars are set per hosting project; backend secrets (`DATABASE_URL`,
`CLOUDINARY_*`) are set only inside the Convex deployment — never in the browser.
See [`environment.md`](./environment.md).

## 7. Deployment

Four independent Vercel projects (one per app) + Convex deploy + Neon migrations. Each app
deploys from its own root directory with SPA rewrites. See [`deployment.md`](./deployment.md).
