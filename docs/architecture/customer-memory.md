# Customer Memory Architecture

> Phase 1: Brain Foundation

## Overview

Customer Memory is the core intelligence layer of Velnox. It transforms raw behavioral events into actionable customer understanding that powers personalized experiences across all clients (VelShop Mobile, VelSeller Web, VelCenter Web).

## Data Flow

```
CLIENT (Browser / Mobile)
    ↓
EVENT (tracked via useTracking hook)
    ↓
EVENT STORAGE (Convex customerEvents — realtime)
    ↓
EVENT PROCESSING (Cron: every 30 min)
    ↓
CUSTOMER SIGNALS (Neon customer_signals — aggregated read model)
    ↓
RECOMMENDATION ENGINE V1 (reads signals, generates ranked recommendations)
    ↓
PERSONALIZED EXPERIENCE (home feed, product recommendations, notifications)
```

## Event Tracking

### Event Vocabulary (28 types)

| Category | Events |
|----------|--------|
| Session | SESSION_START, SESSION_END, APP_OPEN |
| Product | PRODUCT_VIEW, PRODUCT_CLICK, PRODUCT_IMAGE_VIEW |
| Discovery | CATEGORY_VIEW, STORE_VIEW |
| Search | SEARCH, SEARCH_RESULT_CLICK |
| Cart | CART_ADD, CART_REMOVE, CART_VIEW |
| Wishlist | WISHLIST_ADD, WISHLIST_REMOVE |
| Purchase | CHECKOUT_START, PURCHASE, PURCHASE_CANCEL, REPEAT_PURCHASE |
| Interest | INTEREST, REORDER, VELREPEAT_START, VELREPEAT_CANCEL |
| Recommendations | RECOMMENDATION_VIEW, RECOMMENDATION_CLICK, RECOMMENDATION_IGNORE |
| Notifications | NOTIFICATION_SENT, NOTIFICATION_OPEN |

### Event Schema

```typescript
{
  eventType: string;          // from vocabulary
  userId?: string;            // authenticated user (optional for anonymous)
  anonymousId?: string;       // guest session identifier
  sessionId?: string;         // links events to a browsing session
  entityId?: string;          // Neon product/shop/category ID
  value?: string;             // search query, category label
  context?: {                 // additional metadata
    price?: number;
    quantity?: number;
    source?: string;          // HOME, SEARCH, CART, etc.
    position?: number;        // position in list
    device?: string;          // ANDROID, IOS, WEB
  };
  timestamp: number;          // epoch ms
}
```

## Scoring System

### Event Weights (Configurable)

| Event | Weight | Rationale |
|-------|--------|-----------|
| PURCHASE | 12 | Strongest purchase signal |
| REPEAT_PURCHASE | 15 | Repeat is stronger than first purchase |
| REORDER | 10 | Active reorder intent |
| CART_ADD | 6 | Strong intent signal |
| WISHLIST_ADD | 5 | Saved for later |
| CHECKOUT_START | 4 | Near-purchase |
| INTEREST | 4 | Explicit like/favorite |
| PRODUCT_VIEW | 2 | Browsing interest |
| PRODUCT_CLICK | 2 | Active engagement |
| PRODUCT_IMAGE_VIEW | 1.5 | Image inspection |
| SEARCH | 0.4 | Discovery intent |
| SEARCH_RESULT_CLICK | 1 | Active search result |
| STORE_VIEW | 0.3 | Shop browsing |
| CATEGORY_VIEW | 0.25 | Category browsing |
| RECOMMENDATION_CLICK | 3 | Recommendation engagement |
| RECOMMENDATION_VIEW | 0.5 | Passive exposure |
| CART_REMOVE | -2 | Negative signal |
| WISHLIST_REMOVE | -2 | Negative signal |
| PURCHASE_CANCEL | -5 | Strong negative |
| RECOMMENDATION_IGNORE | -0.5 | Weak negative |

### Time Decay (Exponential Half-Life)

Old behavior gradually becomes less important. After `halfLife` days, signal strength is halved.

| Signal | Half-life | Rationale |
|--------|-----------|-----------|
| PURCHASE | 120 days | Purchase intent persists |
| CART_ADD | 90 days | Cart intent persists |
| WISHLIST_ADD | 90 days | Wishlist intent persists |
| PRODUCT_VIEW | 30 days | Browsing fades faster |
| SEARCH | 45 days | Search intent medium persistence |

**Formula:** `decay = 0.5 ^ (ageDays / halfLifeDays)`

## Customer Signals

Pre-computed aggregates stored in Neon `customer_signals` table. Updated every 30 minutes by cron.

### Signal Types

| Signal | Type | Description |
|--------|------|-------------|
| productAffinities | Array<{productId, score}> | Top 100 products by interest score |
| categoryAffinities | Array<{category, score}> | Top 20 categories by interest |
| shopAffinities | Array<{shopId, score}> | Top 20 shops by engagement |
| purchasePatterns | Array<PurchasePattern> | Purchase history per product |
| pricePreference | {min, max, average, median} | Preferred price range |
| purchaseFrequency | number | Orders per month |
| intent | "low" | "medium" | "high" | Current purchase intent |
| searchTerms | Array<{query, count}> | Top 20 search terms |
| totalEvents | number | Total behavioral events |
| lastActivityAt | timestamp | Last activity |

## Recommendation Engine V1

### Strategies

1. **High Product Affinity** — Products the customer has shown strong interest in
2. **Category Affinity** — Products in categories the customer prefers
3. **Shop Affinity** — Products from shops the customer visits
4. **Price Match** — Products within the customer's price preference range
5. **Marketplace Popular** — Warm-up for new users (global popularity last 30 days)

### Recommendation Response

```typescript
[
  {
    "productId": "...",
    "score": 0.92,
    "reason": "HIGH_PRODUCT_AFFINITY"
  },
  {
    "productId": "...",
    "score": 0.81,
    "reason": "CATEGORY_AFFINITY"
  }
]
```

## Privacy

- Anonymous users power global popularity only, never personalized memory
- Users cannot access other customers' behavioral data
- No PII collected beyond what's necessary for personalization
- All reads scoped to authenticated user's own data

## Scalability

- Raw events stored in Convex (realtime, fast writes)
- Signals pre-computed and cached in Neon (fast reads)
- Recommendation engine reads from signals, not raw events
- Event processing is batch-based (every 30 min), not per-request
