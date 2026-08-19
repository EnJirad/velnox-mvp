# VelShop Mobile — Brain Integration Guide

> This document explains how the future VelShop Mobile App will integrate with the Velnox Brain (Phase 1) to send events and receive personalized recommendations.

---

## Overview

The VelShop Mobile App connects to the Velnox Backend (Convex + Neon) for all intelligence features. The Brain provides:

1. **Event Tracking** — Record customer behavior
2. **Customer Memory** — Pre-computed customer signals
3. **Recommendations** — Personalized product recommendations
4. **Purchase Patterns** — Detected reorder opportunities

---

## 1. Event Tracking Integration

### Setup

```typescript
import { useTracking } from "@velnox/shared/lib/track";

function App() {
  const { track, startSession, endSession } = useTracking();
  
  // Start session on app open
  useEffect(() => {
    startSession("ANDROID", "velshop");
    return () => endSession();
  }, []);
  
  return <AppContent track={track} />;
}
```

### Required Events

The mobile app must send these events at the appropriate moments:

| Event | When to Send | Required Context |
|-------|-------------|-----------------|
| `APP_OPEN` | App launches | — |
| `SESSION_START` | Session begins | device, platform |
| `SESSION_END` | App backgrounds/closes | — |
| `PRODUCT_VIEW` | Product detail screen opens | productId |
| `PRODUCT_CLICK` | Product card tapped | productId |
| `PRODUCT_IMAGE_VIEW` | Product image zoomed/expanded | productId |
| `CATEGORY_VIEW` | Category screen opened | category name |
| `STORE_VIEW` | Store detail screen opened | storeId |
| `SEARCH` | Search executed | query |
| `SEARCH_RESULT_CLICK` | Search result tapped | productId, position |
| `CART_ADD` | Item added to cart | productId, quantity |
| `CART_REMOVE` | Item removed from cart | productId |
| `CART_VIEW` | Cart screen opened | — |
| `WISHLIST_ADD` | Item added to wishlist | productId |
| `WISHLIST_REMOVE` | Item removed from wishlist | productId |
| `CHECKOUT_START` | Checkout screen opened | — |
| `PURCHASE` | Order completed | orderId, total |
| `PURCHASE_CANCEL` | Order cancelled | orderId |
| `REPEAT_PURCHASE` | Reorder placed | orderId, productId |
| `INTEREST` | Heart/favorite button tapped | productId |
| `RECOMMENDATION_VIEW` | Recommendation section displayed | — |
| `RECOMMENDATION_CLICK` | Recommendation item tapped | productId |
| `NOTIFICATION_OPEN` | Push notification tapped | notificationId |

### Example: Tracking a Product View

```typescript
import { useTracking } from "@velnox/shared/lib/track";

function ProductDetail({ product }: { product: Product }) {
  const { track } = useTracking();
  
  useEffect(() => {
    track("PRODUCT_VIEW", {
      entityId: product.id,
      context: {
        price: product.price,
        category: product.category,
      },
    });
  }, [product.id]);
  
  return <ProductCard product={product} />;
}
```

### Example: Tracking Search

```typescript
function SearchScreen() {
  const { track } = useTracking();
  
  const handleSearch = (query: string) => {
    track("SEARCH", {
      value: query,
      context: { source: "SEARCH_BAR" },
    });
  };
  
  const handleResultClick = (productId: string, position: number) => {
    track("SEARCH_RESULT_CLICK", {
      entityId: productId,
      context: { position, source: "SEARCH_RESULTS" },
    });
  };
  
  // ...
}
```

### Example: Tracking Cart Actions

```typescript
function useCartActions() {
  const { track } = useTracking();
  
  const addToCart = async (productId: string, quantity: number) => {
    await cartApi.add(productId, quantity);
    track("CART_ADD", {
      entityId: productId,
      context: { quantity },
    });
  };
  
  const removeFromCart = async (productId: string) => {
    await cartApi.remove(productId);
    track("CART_REMOVE", {
      entityId: productId,
    });
  };
  
  return { addToCart, removeFromCart };
}
```

---

## 2. Recommendations Integration

### Fetching Recommendations

```typescript
import { useAction } from "convex/react";
import { api } from "@convex/_generated/api";

function HomeScreen() {
  const getRecommendations = useAction(api.brain.getRecommendations);
  const [recommendations, setRecommendations] = useState([]);
  
  useEffect(() => {
    getRecommendations({ limit: 8 })
      .then(setRecommendations)
      .catch(console.error);
  }, []);
  
  return (
    <RecommendationSection
      title="Recommended for You"
      items={recommendations}
      onItemPress={(item) => {
        track("RECOMMENDATION_CLICK", { entityId: item.productId });
        navigate(`/product/${item.productId}`);
      }}
    />
  );
}
```

### Recommendation Response Format

```typescript
interface RecommendationItem {
  productId: string;   // Neon product ID
  score: number;       // Relevance score (0-15+)
  reason: string;      // Why recommended (for display/debugging)
}
```

### Displaying Recommendations

The `reason` field can be used for personalized UI copy:

| Reason | Thai Copy |
|--------|-----------|
| `HIGH_PRODUCT_AFFINITY` | "คุณสนใจสินค้านี้" |
| `CATEGORY_AFFINITY` | "หมวดที่คุณชอบ" |
| `SHOP_AFFINITY` | "จากร้านที่คุณแวะบ่อย" |
| `PRICE_MATCH` | "ในราคาที่คุณพอใจ" |
| `MARKETPLACE_POPULAR` | "ยอดนิยมในตลาดตอนนี้" |
| `EVENT_SCORING` | "แนะนำสำหรับคุณ" |

---

## 3. Customer Memory Integration

### Fetching Customer Memory

```typescript
import { useAction } from "convex/react";
import { api } from "@convex/_generated/api";

function ProfileScreen() {
  const getMemory = useAction(api.memory.myMemory);
  const [memory, setMemory] = useState(null);
  
  useEffect(() => {
    getMemory().then(setMemory);
  }, []);
  
  if (!memory) return <Loading />;
  
  return (
    <View>
      <Text>兴趣类别</Text>
      {memory.categories.map(cat => (
        <CategoryChip key={cat.category} label={cat.label} score={cat.score} />
      ))}
      
      <Text>最近搜索</Text>
      {memory.searches.map(s => (
        <SearchTag key={s.q} query={s.q} count={s.count} />
      ))}
      
      <Text>购买意向: {memory.intent}</Text>
    </View>
  );
}
```

---

## 4. Reorder Reminders Integration

### Fetching Due Reorders

```typescript
import { useAction } from "convex/react";
import { api } from "@convex/_generated/api";

function ReorderScreen() {
  const getReminders = useAction(api.memory.dueReorderReminders);
  const [reminders, setReminders] = useState([]);
  
  useEffect(() => {
    getReminders().then(setReminders);
  }, []);
  
  return (
    <View>
      <Text>ถึงเวลาสั่งซื้อซ้ำ</Text>
      {reminders.map(r => (
        <ReorderCard
          key={r.product.id}
          product={r.product}
          daysLeft={r.daysLeft}
          avgCycle={r.avgCycleDays}
          onReorder={() => handleReorder(r.product)}
        />
      ))}
    </View>
  );
}
```

---

## 5. Session Management

### Automatic Session Tracking

The `useTracking` hook automatically manages sessions:

1. **Session Start:** When the app opens or the hook first mounts
2. **Session End:** When the app goes to background or unmounts
3. **Events are linked** to the current session via `sessionId`

### Manual Session Control (if needed)

```typescript
const { startSession, endSession } = useTracking();

// For explicit session boundaries
startSession("ANDROID", "velshop");
// ... user activity ...
endSession();
```

---

## 6. Offline Support

### Event Batching (Future)

For mobile apps with intermittent connectivity:

1. Store events locally when offline
2. Batch send when connectivity returns
3. Use `trackBatch` mutation for efficiency

### Cached Recommendations

1. Cache recommendations locally after fetch
2. Show cached recommendations while fresh ones load
3. Refresh when app comes to foreground

---

## 7. Error Handling

### Tracking Failures

All tracking calls are fire-and-forget. Failures are silently ignored and never block the UI.

### Recommendation Failures

If recommendations fail to load, fall back to:
1. Cached recommendations (if available)
2. Popular products (global)
3. Empty state with retry button

---

## 8. Performance Considerations

### Event Frequency

- Maximum 300 events per user per minute (rate limited)
- Batch events when possible (use `trackBatch`)
- Don't track every scroll — track meaningful interactions

### Recommendation Caching

- Cache recommendations for 15-30 minutes
- Refresh on app foreground
- Don't refetch on every screen transition

### Memory Usage

- Customer memory is read from Neon (pre-computed)
- No need to compute affinities on the client
- Client only reads signals, never computes them

---

## 9. Analytics

### Key Metrics to Track

| Metric | Events |
|--------|--------|
| Product views | PRODUCT_VIEW |
| Search usage | SEARCH |
| Cart conversion | CART_ADD / PRODUCT_VIEW |
| Purchase conversion | PURCHASE / CHECKOUT_START |
| Recommendation CTR | RECOMMENDATION_CLICK / RECOMMENDATION_VIEW |
| Repeat purchase rate | REPEAT_PURCHASE / PURCHASE |

---

## 10. API Reference

### Convex Functions

| Function | Type | Purpose |
|----------|------|---------|
| `memoryEvents.track` | mutation | Record single event |
| `memoryEvents.trackBatch` | mutation | Record multiple events |
| `memoryEvents.startSession` | mutation | Start browsing session |
| `memoryEvents.endSession` | mutation | End browsing session |
| `memoryEvents.mergeAnonymousToUser` | mutation | Merge guest → account |
| `brain.getRecommendations` | action | Get personalized recommendations |
| `brain.getSignals` | action | Get pre-computed customer signals |
| `brain.computeSignals` | action | Compute signals on-demand |
| `memory.myMemory` | action | Get customer memory summary |
| `memory.recommendForCustomer` | action | Get recommendations (legacy) |
| `memory.dueReorderReminders` | action | Get reorder reminders |
| `memory.marketInsights` | action | Get marketplace insights |

### Client Hooks

| Hook | Purpose |
|------|---------|
| `useTracking()` | Track events, manage sessions |
| `useAuth()` | Authentication state |
| `useConvexAuth()` | Convex auth state |
