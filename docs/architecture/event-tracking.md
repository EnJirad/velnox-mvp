# Event Tracking Architecture

> Phase 1: Brain Foundation — Canonical Event Contract

## Overview

Event tracking is the foundation of Velnox's customer intelligence. Every meaningful interaction across all clients (VelShop Mobile, VelSeller Web, VelCenter Web) is recorded into a single canonical event system.

## Canonical Event Vocabulary

**28 event types** — there is exactly ONE name per concept. Do NOT introduce aliases or synonyms.

| Category | Events | Purpose |
|----------|--------|---------|
| **Session** | `SESSION_START`, `SESSION_END`, `APP_OPEN` | Browsing session lifecycle |
| **Product** | `PRODUCT_VIEW`, `PRODUCT_CLICK`, `PRODUCT_IMAGE_VIEW` | Product engagement |
| **Discovery** | `CATEGORY_VIEW`, `STORE_VIEW` | Category and store browsing |
| **Search** | `SEARCH`, `SEARCH_RESULT_CLICK` | Search behavior |
| **Cart** | `CART_ADD`, `CART_REMOVE`, `CART_VIEW` | Cart interactions |
| **Wishlist** | `WISHLIST_ADD`, `WISHLIST_REMOVE` | Wishlist management |
| **Purchase** | `CHECKOUT_START`, `PURCHASE`, `PURCHASE_CANCEL`, `REPEAT_PURCHASE` | Purchase lifecycle |
| **Interest** | `INTEREST`, `REORDER`, `VELREPEAT_START`, `VELREPEAT_CANCEL` | Explicit interest |
| **Recommendations** | `RECOMMENDATION_VIEW`, `RECOMMENDATION_CLICK`, `RECOMMENDATION_IGNORE` | Recommendation engagement |
| **Notifications** | `NOTIFICATION_SENT`, `NOTIFICATION_OPEN` | Notification tracking |

### Event Naming Rules

1. Use `STORE_VIEW` — NOT `SHOP_VIEW`
2. Use `CART_ADD` — NOT `ADD_TO_CART`
3. Use `CART_REMOVE` — NOT `REMOVE_FROM_CART`
4. Every canonical name is defined in `packages/shared/src/lib/customer-memory-core.ts`
5. All event types are enforced at compile time via `BrainEventType` union

## Event Schema

```typescript
interface CustomerEvent {
  // Required
  type: BrainEventType;        // canonical event name
  createdAt: number;           // epoch ms

  // User identity (at least one present)
  userId?: string;             // authenticated user ID
  anonymousId?: string;        // anonymous session ID

  // Entity references (context-dependent)
  entityId?: string;           // product/shop ID
  value?: string;              // search query, category label

  // Session tracking
  sessionId?: string;          // browsing session ID

  // Additional context
  context?: {
    price?: number;
    quantity?: number;
    source?: "HOME" | "SEARCH" | "CART" | "DETAIL" | "NOTIFICATION";
    position?: number;
    device?: "ANDROID" | "IOS" | "WEB";
  };
}
```

## Event Storage

### Convex (Realtime)

- Table: `customerEvents`
- Fast writes, realtime subscriptions
- Ephemeral — flushed to Neon periodically

### Neon (Durable)

- Table: `behavioral_events`
- Idempotent upserts on `(source, source_event_id)`
- Cursor-based flush from Convex (every 15 minutes)
- Long-term storage for intelligence

### Data Flow

```
Client action
  ↓
Convex mutation (customerEvents)
  ↓
Realtime available immediately
  ↓
Cron flush (every 15 min) → Neon behavioral_events
  ↓
Signal computation (every 30 min) → customer_signals
  ↓
Recommendation engine reads customer_signals
```

## Session Tracking

Browsing sessions group related events:

```typescript
interface Session {
  userId?: string;
  anonymousId?: string;
  device?: "ANDROID" | "IOS" | "WEB";
  platform?: string;
  startedAt: number;
  endedAt?: number;
}
```

### Session Lifecycle

1. `SESSION_START` creates a session record
2. All subsequent events carry `sessionId`
3. `SESSION_END` closes the session
4. If no `SESSION_END` is sent, session expires after inactivity

## Anonymous → Authenticated Merge

Anonymous users browse without accounts. When they sign in:

```
Anonymous events (anonymousId)
  ↓
User signs in (userId)
  ↓
mergeAnonymousToUser()
  ↓
Deduplicate (same type + entity = skip)
  ↓
Merge remaining events under userId
  ↓
Customer memory recalculated
```

### Merge Rules

1. Events are deduplicated by `eventKey(type, entityId, value)`
2. No event is double-counted
3. Anonymous identifiers are cleaned up after merge
4. Customer signals are recomputed after merge

## Validation

All events are validated server-side:

- Event type must be in `ALL_EVENT_TYPES`
- userId must match authenticated user (no spoofing)
- Entity IDs are verified against Neon (product exists, user owns order, etc.)
- Rate limiting prevents abuse

## Frontend Integration

### useTracking Hook

```typescript
import { track } from "@velnox/shared";

// Track a product view
track("PRODUCT_VIEW", { entityId: productId, context: { source: "HOME" } });

// Track a search
track("SEARCH", { value: "toothpaste" });

// Track a cart add
track("CART_ADD", { entityId: productId, context: { price: 29.99 } });

// Batch events
trackBatch([
  { type: "SESSION_START", context: { device: "ANDROID" } },
  { type: "APP_OPEN", context: { device: "ANDROID" } },
]);
```

## Performance

- Events are fire-and-forget (never block UI)
- Batch events for efficiency
- Signal computation is batch-based, not per-request
- Convex handles write throughput; Neon handles durable storage
