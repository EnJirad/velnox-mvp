# VelShop Mobile — Event Tracking

## Overview

The EventTracker sends behavioral events to the Velnox Brain system for
recommendation signals and analytics. Events are queued and batched to
minimize network overhead.

## Architecture

```
UI Action → EventTracker.track() → Queue → Batch Flush → POST /api/events/batch
```

- Events are queued in-memory (ConcurrentLinkedQueue)
- Flushed every 5 seconds or when queue reaches 20 events
- Failed events are re-queued (capped at 200)
- Deduplication prevents duplicate submissions
- Never blocks the shopping UI

## Canonical Event Types

| Event | Trigger | Extra Data |
|-------|---------|------------|
| `APP_OPEN` | App launch | — |
| `SESSION_START` | App foreground | — |
| `SESSION_END` | App background | — |
| `PRODUCT_VIEW` | Product detail screen | productId, sellerId |
| `PRODUCT_CLICK` | Product card tap | productId, sellerId |
| `CATEGORY_VIEW` | Category screen | categoryId |
| `STORE_VIEW` | Store screen | sellerId |
| `SEARCH` | Search execution | query |
| `SEARCH_RESULT_CLICK` | Search result tap | query, productId |
| `CART_VIEW` | Cart screen | — |
| `CART_ADD` | Add to cart | productId, quantity |
| `CART_REMOVE` | Remove from cart | productId |
| `CHECKOUT_START` | Checkout screen | — |
| `PURCHASE` | Order placed | orderId |
| `WISHLIST_ADD` | Add to wishlist | productId |
| `WISHLIST_REMOVE` | Remove from wishlist | productId |
| `RECOMMENDATION_VIEW` | Recommendation shown | productId |
| `RECOMMENDATION_CLICK` | Recommendation tapped | productId |

## Event Payload

```json
{
  "eventType": "PRODUCT_VIEW",
  "sessionId": "sess_550e8400-...",
  "anonymousId": "anon_550e8400-...",
  "userId": "optional-user-id",
  "productId": "product-id",
  "sellerId": "seller-id",
  "categoryId": "category-id",
  "metadata": {
    "platform": "android_34",
    "appVersion": "1.0.0",
    "query": "search term"
  },
  "timestamp": 1692000000000
}
```

## Integration

Events are tracked automatically in most screens. Example:

```kotlin
// In HomeScreen
EventTracker.get().trackAppOpen()
EventTracker.get().trackProductClick(productId, sellerId)

// In CartScreen
EventTracker.get().trackCartAdd(productId, quantity)
```

## Safety

- Event failures never crash the app
- Queue is capped at 200 events
- Deduplication by event ID
- Flush runs on Dispatchers.IO
