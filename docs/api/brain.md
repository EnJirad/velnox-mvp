# Brain API

> Intelligence layer — customer memory, recommendations, signals

**Files:** `convex/brain.ts`, `convex/memory.ts`, `convex/memoryEvents.ts`  
**Clients:** All  
**Auth:** Varies by endpoint

## Brain Module (brain.ts)

| Action | Auth | Purpose |
|--------|------|---------|
| `computeSignalsBatch()` | System (cron) | Batch signal computation |
| `computeSignals(userId)` | System | Compute signals for one user |
| `getRecommendations(userId, limit)` | System | Personalized recommendations |
| `getSignals(userId)` | System | Read persisted signals |

## Memory Module (memory.ts)

| Action | Auth | Purpose |
|--------|------|---------|
| `myMemory()` | Customer | Real-time customer memory |
| `recommendForCustomer(limit)` | Customer | Personalized recommendations |
| `dueReorderReminders()` | Customer | Reorder reminders |
| `marketInsights()` | Admin | Marketplace analytics |
| `flushToNeon()` | System (cron) | Flush events to Neon |

## Event Module (memoryEvents.ts)

| Mutation | Auth | Purpose |
|----------|------|---------|
| `trackEvent(data)` | Customer | Record single event |
| `trackBatch(events)` | Customer | Record batch events |
| `startSession(data)` | Customer | Start browsing session |
| `endSession(sessionId)` | Customer | End browsing session |

## Data Flow

```
Client → trackEvent() → Convex customerEvents
                              ↓
                    Cron flush (15 min) → Neon behavioral_events
                              ↓
                    Signal computation (30 min) → Neon customer_signals
                              ↓
                    getRecommendations() → Ranked products
```
