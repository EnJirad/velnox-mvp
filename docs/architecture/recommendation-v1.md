# Recommendation Engine V1

> Phase 1: Brain Foundation — Deterministic Recommendations

## Overview

Recommendation Engine V1 is a deterministic, explainable system that generates personalized product recommendations based on customer signals. No AI/ML — pure scoring and ranking.

## Architecture

```
Customer Signals (pre-computed)
  ↓
Load Catalog (published products)
  ↓
Score Each Product
  ↓
  ├── Product Affinity
  ├── Category Affinity
  ├── Shop Affinity
  └── Price Preference Match
  ↓
Rank by Score
  ↓
Warm-up Blend (if < 4 personal picks)
  ↓
Return Ranked List with Reasons
```

## Scoring Formula

For each catalog product:

```
totalScore = productAffinity + (categoryAffinity × 0.6) + (shopAffinity × 0.35) + priceMatchBonus
```

Where:
- `productAffinity` = direct score from `customer_signals.product_affinities`
- `categoryAffinity` = score from `customer_signals.category_affinities` × 0.6
- `shopAffinity` = score from `customer_signals.shop_affinities` × 0.35
- `priceMatchBonus` = 1.0 if product price is within customer's preferred range

## Recommendation Reasons

Every recommendation includes an explainable reason:

| Reason | Meaning |
|--------|---------|
| `HIGH_PRODUCT_AFFINITY` | Customer has strong interest in this product |
| `CATEGORY_AFFINITY` | Product is in a category the customer prefers |
| `SHOP_AFFINITY` | Product is from a shop the customer visits |
| `PRICE_MATCH` | Product price matches customer's preference |
| `EVENT_SCORING` | Computed from raw events (fallback) |
| `MARKETPLACE_POPULAR` | Global popularity (warm-up for new users) |

## Recommendation Types

### 1. Personalized (signed-in users with signals)

```typescript
{
  productId: "abc123",
  score: 0.92,
  reason: "HIGH_PRODUCT_AFFINITY"
}
```

### 2. Event-based Fallback (signed-in, no signals yet)

When signals haven't been computed yet, recommendations are computed directly from recent events using the same scoring weights.

### 3. Popular (signed-out or no history)

Marketplace-wide popularity from the last 30 days.

## Warm-up Blend

If personalized picks are fewer than 4, the system tops up with marketplace popular products. This ensures new users always see relevant content.

## Recommendation Event Loop

The system tracks whether recommendations work:

```
Recommendation shown → RECOMMENDATION_VIEW
Recommendation clicked → RECOMMENDATION_CLICK → PRODUCT_VIEW
  → CART_ADD → PURCHASE
Recommendation ignored → RECOMMENDATION_IGNORE
```

This feedback loop allows future optimization.

## API

### getRecommendations

```typescript
// Convex action
api.brain.getRecommendations({ userId, limit })
// Returns: RecommendationItem[]
```

### myMemory (compatibility)

```typescript
// Convex action — real-time memory from events
api.memory.myMemory({})
// Returns: { categories, searches, shops, intent, ... }
```

### getSignals

```typescript
// Convex action — read persisted signals
api.brain.getSignals({ userId })
// Returns: CustomerSignals | null
```

## Performance

- Signals are pre-computed (batch cron every 30 minutes)
- Recommendation reads from signals, not raw events
- Catalog is loaded fresh on each request (cacheable)
- Warm-up blend uses popularity query (indexed)
