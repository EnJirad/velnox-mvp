# Memory API

> Real-time customer memory and marketplace insights

**File:** `convex/memory.ts`  
**Client:** VelShop, VelCenter  
**Auth:** Varies

## Customer Endpoints

| Action | Auth | Purpose |
|--------|------|---------|
| `myMemory()` | Customer | Real-time memory summary |
| `recommendForCustomer(limit)` | Customer | Personalized recommendations |
| `dueReorderReminders()` | Customer | Reorder reminders |

## Admin Endpoints

| Action | Auth | Purpose |
|--------|------|---------|
| `marketInsights()` | Admin | Marketplace analytics |

## System Endpoints

| Action | Auth | Purpose |
|--------|------|---------|
| `flushToNeon()` | Cron | Flush events to Neon |

## Memory Response

```typescript
{
  categories: [
    { category: "beauty", label: "ความงาม", score: 8.5, count: 12 }
  ],
  searches: [
    { q: "toothpaste", count: 5 }
  ],
  shops: [
    { shopId: "shop-1", shopName: "My Shop", score: 6.2, count: 3 }
  ],
  intent: "medium",
  eventCount: 50,
  viewCount: 30,
  purchaseCount: 3,
  cartAddCount: 5,
  wishlistCount: 2,
  checkoutCount: 1
}
```

## Reorder Reminders

Returns products the customer regularly purchases that are due for reorder:

```typescript
[
  {
    product: { id, name, price, ... },
    times: 3,
    avgCycleDays: 30,
    lastOrderedAt: 1692000000000,
    nextDueAt: 1694592000000,
    daysLeft: -2,
    emoji: "🧴"
  }
]
```

## Marketplace Insights (Admin)

Returns aggregate marketplace data (no personal data):

```typescript
{
  topSearches: [{ q: "toothpaste", count: 120 }],
  topCategories: [{ category: "beauty", label: "ความงาม", count: 450 }],
  popularProducts: [{ product: {...}, views: 230 }],
  eventCount: 15000,
  windowDays: 30
}
```
