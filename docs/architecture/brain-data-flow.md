# Brain Data Flow

> Phase 1: Complete Pipeline — From Event to Recommendation

## Complete Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                        CLIENT                           │
│   VelShop Mobile / VelSeller Web / VelCenter Web        │
│                                                         │
│   User browses, searches, clicks, adds to cart, buys    │
└──────────────────────┬──────────────────────────────────┘
                       │ track("PRODUCT_VIEW", { entityId })
                       ▼
┌─────────────────────────────────────────────────────────┐
│                   EVENT API                             │
│                                                         │
│   Convex mutations (memoryEvents.ts):                   │
│     - trackEvent() — single event                       │
│     - trackBatch() — batch events                       │
│     - startSession() / endSession()                     │
│                                                         │
│   Validates:                                            │
│     ✓ Event type in ALL_EVENT_TYPES                     │
│     ✓ userId matches auth identity                      │
│     ✓ Entity exists (optional, for security)            │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              REALTIME STORAGE                           │
│              Convex customerEvents                      │
│                                                         │
│   • Fast writes (fire-and-forget)                       │
│   • Available immediately for realtime queries          │
│   • Session grouping via sessionId                      │
│   • Indexed by userId, type, session                    │
└──────────────────────┬──────────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          │ Cron (every 15 min)     │
          ▼                         ▼
┌─────────────────────┐  ┌────────────────────────────────┐
│  DURABLE STORAGE    │  │   REALTIME QUERIES              │
│  Neon               │  │                                 │
│  behavioral_events  │  │   myMemory() — live memory      │
│                     │  │   recommendForCustomer()         │
│  • Append-only      │  │   marketInsights()               │
│  • Idempotent       │  │                                 │
│  • Cursor-tracked   │  │   (reads from Convex directly)  │
└────────┬────────────┘  └────────────────────────────────┘
         │
         │ Cron (every 30 min)
         ▼
┌─────────────────────────────────────────────────────────┐
│              SIGNAL COMPUTATION                         │
│              brain.ts → computeSignalsBatch()            │
│                                                         │
│   For each user with new events:                        │
│                                                         │
│   1. Load raw events from Convex (last 2000)            │
│   2. Load product metadata from Neon                    │
│   3. Compute:                                           │
│      • Product affinities (weighted + decayed)          │
│      • Category affinities                              │
│      • Shop affinities                                  │
│      • Purchase patterns                                │
│      • Price preference                                 │
│      • Purchase frequency                               │
│      • Intent level                                     │
│   4. Persist to Neon customer_signals                   │
│                                                         │
│   Uses customer-memory-core.ts for pure logic:          │
│     • eventWeight() — centralized scoring               │
│     • decay() — exponential half-life                   │
│     • computeProductAffinities()                        │
│     • computeCategoryAffinities()                       │
│     • computeShopAffinities()                           │
│     • computePurchasePatterns()                         │
│     • computePricePreference()                          │
│     • aggregateSignals()                                │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              CUSTOMER SIGNALS                           │
│              Neon customer_signals                       │
│                                                         │
│   Pre-computed aggregated read model:                   │
│                                                         │
│   • product_affinities: [{productId, score}]            │
│   • category_affinities: [{category, score}]            │
│   • shop_affinities: [{shopId, score}]                  │
│   • purchase_patterns: [{productId, purchaseCount}]     │
│   • price_preference: {min, max, average, median}       │
│   • purchase_frequency: orders per month                │
│   • current_intent: low | medium | high                 │
│   • search_terms: [{query, count}]                      │
│                                                         │
│   Updated atomically via UPSERT                         │
│   Idempotent — safe to recompute                        │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              RECOMMENDATION ENGINE V1                   │
│              brain.ts → getRecommendations()             │
│                                                         │
│   1. Load persisted signals from Neon                   │
│   2. Load catalog (published products)                  │
│   3. Score each product:                                │
│      • Product affinity (direct)                        │
│      • Category affinity (× 0.6)                        │
│      • Shop affinity (× 0.35)                           │
│      • Price preference match                           │
│   4. Rank by score                                      │
│   5. Warm-up blend if < 4 personal picks                │
│   6. Return [{productId, score, reason}]                │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              CLIENT DISPLAY                             │
│                                                         │
│   Personalized home feed                                │
│   Product recommendations                               │
│   Smart search suggestions                              │
│   Reorder reminders                                     │
│                                                         │
│   Track recommendation interaction:                     │
│     • RECOMMENDATION_VIEW                               │
│     • RECOMMENDATION_CLICK                              │
│     • RECOMMENDATION_IGNORE                             │
└─────────────────────────────────────────────────────────┘
```

## Anonymous → Authenticated Flow

```
Guest browses anonymously
  ↓
Events carry anonymousId
  ↓
Guest signs in (creates / links account)
  ↓
mergeAnonymousToUser()
  ↓
  • Deduplicate (same type + entity = skip)
  • Merge remaining events under userId
  ↓
Signal computation picks up merged events
  ↓
Customer memory includes full history
```

## Processing Safety

| Property | Mechanism |
|----------|-----------|
| Idempotency | UPSERT on customer_signals.user_id |
| No double-counting | eventId dedup + cursor-based processing |
| Fault tolerance | Failed users retried next batch |
| Data safety | Raw events preserved in Convex + Neon |
| Privacy | Anonymous events power global popularity only |

## Cron Schedule

| Job | Interval | Purpose |
|-----|----------|---------|
| Flush to Neon | Every 15 min | Copy Convex events → Neon behavioral_events |
| Compute Signals | Every 30 min | Process events → customer_signals |
| Process VelRepeat | Every 6 hours | Generate recurring orders |
