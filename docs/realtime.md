# Velnox — Realtime Event Architecture

> Convex is the realtime layer: browser subscriptions for live UI, fire-and-forget behavioral
> events, and a durable flush to Neon so history survives Convex outages
> (`data-ownership.md`, `architecture.md` §5).

## 1. Event vocabulary

Machine-readable identifiers only (never localized UI text — §35):

```
PRODUCT_VIEW          user viewed a product
PRODUCT_CLICK         user clicked a product
SEARCH                user searched (value = query)
CATEGORY_VIEW         user opened a category (value = label)
SHOP_VIEW             user opened a shop
INTEREST              user marked “สนใจ” (interested)
WISHLIST_ADD / WISHLIST_REMOVE
CART_ADD / CART_REMOVE
CHECKOUT_START
PURCHASE
REORDER
VELREPEAT_START / VELREPEAT_CANCEL
RECOMMENDATION_CLICK
```

Defined in `convex/memoryEvents.ts` (`EVENT_TYPES`) — keep in sync with the browser tracker
(`packages/shared/src/lib/track.ts`).

## 2. Event shape (typed)

```ts
{
  userId: string | undefined,      // signed-in customer (Convex user id)
  anonymousId: string | undefined, // guest session (localStorage uuid) — exactly one set
  type: CustomerEventType,         // from the vocabulary above
  entityId: string | undefined,    // Neon product / shop / category id
  value: string | undefined,       // search query / category label
  context: object | undefined,     // hints (price, quantity, page) — never secrets/PII
  createdAt: number,               // epoch ms
}
```

No passwords, tokens, keys, or payment credentials ever enter event payloads. Anonymous events
carry no personally-identifiable data.

## 3. Pipeline

```
Browser (fire-and-forget, rate-limited 300/min/user)
   └─▶ customerEvents (Convex) ── realtime subscriptions power:
   │      • personalized home recommendations (memory.ts myMemory)
   │      • category chips / popular entities
   │      • proactive reorder reminders (VelRepeat)
   └─▶ cron flush (every 15 min) ──▶ behavioral_events (Neon, durable, deduped)
                                         └─▶ analytics / rebuild source
```

- `memoryEvents.track` mutation: validates the event type, binds userId or anonymousId (never
  both), rate-limits, inserts into `customerEvents`. Tracking must never throw into the UI.
- `memory.ts` (node action): reads the customer's own events (scoped — “ของใคร ของมัน”),
  computes interest/intent via the pure `customer-memory-core` (weights, half-lives, decay).
- `behavioralEvents.flushToNeon` (cron): scans `customerEvents` since the Neon cursor (with a
  60 s overlap), inserts into `behavioral_events` with `ON CONFLICT DO NOTHING`, advances the
  cursor monotonically. Idempotent + best-effort: a Neon outage delays, never breaks, tracking.

## 4. Neon → Convex business-event bridge

`intelligence.recordBusinessEvent` records Neon facts (OrderCreated, PaymentConfirmed,
OrderStatusChanged, InventoryChanged, ProductUpdated, SubscriptionUpdated) into Convex
`businessEvents` for live dashboards / push notifications. These are **derived** — authoritative
state always comes from Neon.

## 5. Rebuilding realtime intelligence

If Convex is lost:

1. Redeploy Convex (same deployment or new one) with the same env (`DATABASE_URL`,
   `CLOUDINARY_*`).
2. Reprocess durable inputs: `behavioral_events` + Neon orders/purchases → re-insert
   `customerEvents`/`interests` → recompute memory, recommendations, VelRepeat predictions.
3. Verify with `db:smoke`, `db:consistency`, and a memory check.

Full procedure: [`disaster-recovery.md`](./disaster-recovery.md) §Convex.
