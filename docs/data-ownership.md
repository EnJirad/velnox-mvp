# Velnox — Data Ownership

> Rule of the platform: **Neon = authoritative business data, Convex = realtime/derived
> intelligence.** Anything in Convex is either a realtime projection of Neon or a derived value
> that can be rebuilt from Neon + the durable event store.

## 1. Ownership table

| Data | Owner | Realtime | Persistent | Rebuildable |
|---|---|---|---|---|
| User / account / roles | Neon (`users`) + Convex Auth session | Optional | Yes | Auth session regenerable |
| Product | Neon (`products`, `product_images`, `inventory`) | Optional | Yes | No |
| Merchant / Shop | Neon (`sellers`, `shops`) | Optional | Yes | No |
| Order | Neon (`orders`, `order_items`) | Optional | Yes | No |
| Payment | Neon (`payments`, `refunds`) | No | Yes | No |
| Commission / Settlement | Neon (`commissions`, `settlements`) | Optional | Yes | No |
| Cart | Neon (`cart_items`) | Optional | Yes | No |
| Wishlist | Neon (`wishlist_items`) | Optional | Yes | No |
| Address | Neon (`addresses`) | No | Yes | No |
| Subscription (VelRepeat) | Neon (`subscriptions`) | Optional | Yes | No |
| Reorder prediction | Convex | Yes | Derived | Yes — from events + orders |
| Product view / search / cart / checkout event | Convex `customerEvents` (**realtime**) + Neon `behavioral_events` (**durable**) | Yes | Yes (Neon) | Yes — from Neon store |
| Customer memory / interests | Convex (`interests`, `productViews`, derived memory) | Yes | Derived | Yes — from `behavioral_events` + orders |
| Recommendation list | Convex | Yes | Derived | Yes — recomputed |
| Realtime business-event bridge | Convex (`businessEvents`) | Yes | Derived | Yes — from Neon facts |
| Notifications | Convex (`notifications`) | Yes | Derived | Yes — from Neon facts |
| Rate-limit counters | Convex (`rateLimits`) | Yes | No | No (ephemeral) |
| Audit log | Neon (`audit_logs`) | No | Yes | No |
| Product images (binary) | Cloudinary (metadata in Neon) | No | Yes | Re-upload from Cloudinary |

## 2. Rules

1. **Never** create duplicate authoritative tables for users/products/orders/payments/inventory
   in Convex. A small realtime projection is allowed if it documents source, purpose, sync
   method, and that it is not authoritative (`architecture-audit.md` §3 lists the current ones).
2. **Every Convex projection must be rebuildable.** The rebuild input set is: Neon commerce
   tables + `behavioral_events` (durable event log) + `audit_logs`.
3. **Derived realtime values** (interest scores, recommendations, counters) may live in Convex
   only, but their loss must be acceptable — they are recomputed from the durable inputs.
4. **Never let stale realtime data override Neon** — prices, inventory, order status, payment
   status are read from Neon at the moment of the authoritative operation.

## 3. Durable event pipeline

```
Browser action → customerEvents (Convex, realtime)
              → cron flush (every 15 min, idempotent)
              → behavioral_events (Neon, append-only, deduped)
              → (rebuild path) reprocess behavioral_events → rebuild Convex memory/intelligence
```

Implemented in: `db/migrations/011_behavioral_events.sql`, `backend/events.ts`,
`convex/behavioralEvents.ts`, `convex/crons.ts`. See [`realtime.md`](./realtime.md).

## 4. Disaster-recovery implication

Losing Convex = losing only the derived/realtime layer. Recovery = restore/rebuild Convex
deployment, then reprocess `behavioral_events` + Neon commerce data to rebuild memory,
interests, and recommendations. Procedure: [`disaster-recovery.md`](./disaster-recovery.md).
