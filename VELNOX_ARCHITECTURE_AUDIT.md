# Velnox Architecture Audit — Phase 0

> **Date:** 2026-08-19
> **Purpose:** Complete architecture audit before implementing the new multi-client strategy
> **Status:** AUDIT ONLY — No code changes in this phase

---

## 1. CURRENT ARCHITECTURE

### Target Diagram

```
                    VELNOX BACKEND (single backend, shared by all clients)
                         │
          ┌──────────────┼──────────────┐
          │              │              │
       VelShop        VelSeller      VelCenter
      (Mobile)        (Web)           (Web)
          │
          └──────────────┬──────────────┘
                         │
                  Velnox Core / API
                         │
          ┌──────────────┼──────────────┐
          │              │              │
       Commerce       Behavior     Intelligence
          │              │              │
     Neon (SQL)     Events (Neon)   Customer Memory
                                   Recommendations
```

### Current Monorepo Layout

```
velnox-mvp/
├── apps/
│   ├── shop/          @velnox/shop — VelShop (customer storefront, Vite+React)
│   ├── seller/        @velnox/seller — VelSeller (merchant tools, Vite+React)
│   ├── center/        @velnox/center — VelCenter (company admin, Vite+React)
│   └── corporate/     @velnox/corporate — corporate site (Vite+React)
├── packages/
│   └── shared/        @velnox/shared — shared UI components + business logic
├── backend/           Neon PostgreSQL service layer (TypeScript, "use node")
├── convex/            Convex backend (queries, mutations, actions, HTTP)
├── db/
│   ├── schema.sql     Neon Commerce Core schema (14 tables)
│   └── migrations/    14 idempotent migrations
├── src/               Legacy Freebuff template (NOT the monorepo apps)
└── package.json       Bun workspaces root
```

### Client Architecture (NEW STRATEGY)

| Client | Type | Primary Use | Status |
|--------|------|-------------|--------|
| **VelShop** | Mobile App (React Native or similar) | Customer shopping, browsing, orders | To be built |
| **VelSeller** | Web App (Vite+React) | Merchant dashboard, products, orders | Exists |
| **VelCenter** | Web App (Vite+React) | Company admin, users, finance, analytics | Exists |
| **Corporate** | Web App (Vite+React) | Landing, contact, static content | Exists |

---

## 2. CURRENT DATABASE

### Neon PostgreSQL (Source of Truth for Commerce)

| Table | Purpose | Row Estimate |
|-------|---------|-------------|
| `users` | Business users (Convex auth ID → Neon row) | Low |
| `sellers` | Merchant accounts | Low |
| `shops` | Storefronts | Low |
| `products` | Product catalog | Medium |
| `product_images` | Image metadata (Cloudinary URLs) | Medium |
| `inventory` | Stock levels | Medium |
| `addresses` | Customer saved addresses | Medium |
| `orders` | Order headers | High (grows) |
| `order_items` | Order line items | High (grows) |
| `payments` | Payment attempts | High (grows) |
| `refunds` | Return/dispute records | Low |
| `commissions` | Platform fee tracking | High (grows) |
| `settlements` | Seller payouts | Low |
| `subscriptions` | VelRepeat recurring orders | Medium |
| `behavioral_events` | Durable event log (append-only) | Very High (grows fast) |
| `event_flush_cursor` | Convex→Neon flush progress | 1 row |
| `platform_settings` | Business configuration | Small |
| `categories` | Product categories | Small |
| `carts` | Active shopping carts | Medium |
| `cart_items` | Cart line items | Medium |
| `wishlists` | Customer wishlists | Medium |
| `reviews` | Product reviews | Medium |
| `notifications` | User notifications | High (grows) |
| `shipments` | Shipping tracking | Medium |
| `tracking_events` | Shipment status updates | Medium |
| `returns` | Return requests | Low |
| `return_items` | Return line items | Low |
| `ledger_entries` | Financial ledger | High (grows) |
| `seller_balances` | Seller payout balances | Low |
| `seller_payouts` | Payout requests | Low |
| `audit_logs` | Admin action audit trail | High (grows) |
| `staff_profiles` | Employee permissions | Low |

### Convex (Realtime + Intelligence Layer)

| Table | Purpose |
|-------|---------|
| `users` | Auth users (Convex Auth tables) |
| `goals` | Business goals (owner dashboard) |
| `products` | Convex-side product state (inventory for smart reorder) |
| `purchases` | Purchase history (inventory reordering) |
| `orders` | Convex-side orders (customer-facing) |
| `orderItems` | Order line items (Convex) |
| `productViews` | Legacy product view tracking |
| `interests` | Product interest/like clicks |
| `businessEvents` | Neon→Convex event bridge |
| `customerEvents` | **Core behavioral event store** (realtime) |
| `subscriptions` | VelRepeat subscriptions (Convex-side) |
| `storeSettings` | Legacy storefront settings |
| `rateLimits` | API rate limiting |

### Key Database Relationships

```
Neon Commerce Core:
  users ←→ sellers (1:1)
  sellers ←→ shops (1:N)
  shops ←→ products (1:N)
  products ←→ product_images (1:N)
  products ←→ inventory (1:1)
  users ←→ addresses (1:N)
  users ←→ orders (1:N)
  orders ←→ order_items (1:N)
  orders ←→ payments (1:N)
  orders ←→ refunds (1:N)
  orders ←→ commissions (1:N)
  users ←→ subscriptions (1:N)
  
Convex Intelligence:
  users ←→ customerEvents (1:N)
  users ←→ interests (1:N)
  users ←→ businessEvents (N:1 entity)
  customerEvents ←→ behavioral_events (flush copy)
```

---

## 3. CURRENT BACKEND

### Architecture Decision: Convex + Neon Hybrid

- **Neon** = Source of truth for all commerce data (transactions, ACID)
- **Convex** = Realtime subscriptions, event ingestion, intelligence computation
- **Bridge** = `businessEvents` table bridges Neon commerce facts into Convex realtime
- **Flush** = Cron copies `customerEvents` → Neon `behavioral_events` every 15 minutes

### Backend Services (backend/*.ts)

| Module | Responsibility |
|--------|---------------|
| `db.ts` | Neon connection pool |
| `identity.ts` | User lookup, Convex↔Neon identity bridge |
| `products.ts` | CRUD, search, filtering |
| `orders.ts` | Order creation, status, customer/seller views |
| `carts.ts` | Cart operations |
| `checkout.ts` | Order creation from cart (idempotent) |
| `payments.ts` | Payment recording, status updates |
| `payment.ts` | Payment processing (COD, transfer, online) |
| `shipping.ts` | Shipping quotes, carrier integration |
| `shipments.ts` | Shipment creation, tracking |
| `returns.ts` | Return request lifecycle |
| `reviews.ts` | Product reviews |
| `addresses.ts` | Customer address CRUD |
| `inventory.ts` | Stock management |
| `categories.ts` | Category CRUD |
| `sellers.ts` | Seller CRUD, shop management |
| `merchants.ts` | Legacy merchant functions |
| `storage.ts` | Cloudinary upload (server-side only) |
| `stripe.ts` | Stripe payment integration |
| `stripeVerify.ts` | Stripe webhook signature verification |
| `subscriptions.ts` | VelRepeat subscription CRUD + due processing |
| `reorder.ts` | Smart reorder logic |
| `finance.ts` | Ledger, commissions, settlements, balances |
| `platformSettings.ts` | Platform configuration |
| `permissions.ts` | Role-based access control |
| `rules.ts` | Business rules engine |
| `validation.ts` | Input validation |
| `errors.ts` | Error types and handling |
| `dates.ts` | Date utilities |
| `types.ts` | TypeScript interfaces |
| `events.ts` | Behavioral event store (Neon append-only) |
| `audit.ts` | Audit logging |
| `bootstrap.ts` | Owner bootstrap (first-time setup) |
| `passwords.ts` | Employee password management |
| `moderation.ts` | Product moderation |
| `notifications.ts` | Notification CRUD |

### Convex Modules (convex/*.ts)

| Module | Responsibility |
|--------|---------------|
| `auth.ts` | Convex Auth setup |
| `auth.config.ts` | Auth configuration |
| `auth/emailOtp.ts` | Email OTP authentication |
| `auth_redirect.ts` | Auth redirect handling |
| `users.ts` | User queries, role checks, bootstrap |
| `customer.ts` | Customer-facing actions (profile, upload, events) |
| `commerce.ts` | Full commerce actions (products, cart, checkout, orders) |
| `products.ts` | Product queries (storefront) |
| `orders.ts` | Order queries (customer/seller views) |
| `memory.ts` | **Customer Memory & Intelligence** (recommendations, memory) |
| `memoryEvents.ts` | Event recording mutations + internal queries |
| `intelligence.ts` | Business event bridge, interest recording |
| `sellerOps.ts` | Seller operations (products, orders, inventory) |
| `center.ts` | Center queries (dashboard stats) |
| `centerAdmin.ts` | Admin actions (users, sellers, products, settings) |
| `goals.ts` | Business goals CRUD |
| `subscriptions.ts` | VelRepeat subscription management |
| `storefront.ts` | Public storefront settings |
| `stripe.ts` | Stripe payment actions |
| `http.ts` | HTTP routes (health, Stripe webhook) |
| `rateLimit.ts` | Rate limiting |
| `crons.ts` | Scheduled jobs (event flush, subscription processing) |

---

## 4. CURRENT APIs

### Convex API (via useAction / useQuery / useMutation)

All frontend→backend communication goes through Convex functions. No separate REST API exists.

| Domain | Key Functions |
|--------|--------------|
| **Auth** | `signIn("email-otp")`, `signIn("anonymous")`, `signOut()` |
| **User** | `users.currentUser`, `users.getCurrentUser`, `users.ownerBootstrapStatus` |
| **Profile** | `customer.getProfileImageUploadSignature`, `customer.saveProfileImage` |
| **Products** | `commerce.listProducts`, `commerce.getProduct`, `commerce.createProduct` |
| **Cart** | `commerce.getCart`, `commerce.addToCart`, `commerce.removeFromCart` |
| **Checkout** | `commerce.createOrder` (idempotent) |
| **Orders** | `commerce.listMyOrders`, `commerce.getOrder`, `commerce.listSellerOrders` |
| **Seller** | `sellerOps.createProduct`, `sellerOps.updateProduct`, `sellerOps.listSellerProducts` |
| **Center** | `center.dashboardStats`, `centerAdmin.listUsers`, `centerAdmin.setUserAccess` |
| **Events** | `memoryEvents.track`, `memoryEvents.trackForUser` |
| **Memory** | `memory.myMemory`, `memory.recommendForCustomer`, `memory.dueReorderReminders` |
| **Subscriptions** | `subscriptions.listMySubscriptions`, `subscriptions.createSubscription` |
| **Interests** | `intelligence.recordInterest`, `intelligence.recentInterests` |

### HTTP Routes

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check (no auth) |
| `/stripe/webhook` | POST | Stripe payment webhook |
| `/upload/image` | POST | Profile image upload (Convex HTTP action → Cloudinary) |

---

## 5. CURRENT AUTHENTICATION

### System: Convex Auth

- **Provider:** `@convex-dev/auth` v0.0.95
- **Methods:** Email OTP + Anonymous
- **Identity:** Convex `auth.userId` → Neon `users.convex_id`
- **Bridge:** `identity.ts` maps Convex auth to Neon business user

### Roles

| Role | Access |
|------|--------|
| `owner` | VelCenter full access, manage employees |
| `admin` | VelCenter business data, no employee management |
| `staff` | VelCenter view-only business numbers |
| `seller` | VelSeller merchant tools |
| `customer` | VelShop shopping (default) |

### Department Scoping (VelCenter)

Marketing, Sales, Operations, Finance, General

### Auth Flow

```
Browser → Convex Auth (email OTP or anonymous)
        → Convex session
        → Backend checks: getAuthUserId(ctx) → Neon users table
        → Role-based authorization via permissions.ts
```

---

## 6. CURRENT COMMERCE FEATURES

### Fully Implemented

- **Product Catalog:** CRUD, search, filtering, moderation, images (Cloudinary)
- **Shopping Cart:** Add/remove/update, multi-shop cart
- **Checkout:** Idempotent order creation, address snapshot
- **Orders:** Full lifecycle (pending → confirmed → shipped → delivered → completed)
- **Payments:** COD, transfer, card (Stripe), promptpay, wallet
- **Shipping:** Multi-carrier, tracking, delivery confirmation
- **Returns:** Request → review → approve → refund workflow
- **Reviews:** Product ratings + comments
- **Subscriptions (VelRepeat):** Recurring orders, auto-processing
- **Commissions:** 3% platform fee per line item
- **Settlements:** Periodic seller payouts
- **Ledger:** Full financial transaction log
- **Seller Management:** Application → approval → shop → products
- **Admin Center:** User roles, seller management, product moderation, platform settings
- **Smart Reorder:** Purchase cycle learning, reorder reminders
- **Business Goals:** Owner dashboard goal tracking
- **Notifications:** Multi-type notification system

### VelRepeat (Recurring Commerce)

- Subscription creation with frequency (daily/weekly/monthly/custom)
- Automatic order placement via cron (every 6 hours)
- Purchase cycle learning from order history
- Proactive reorder reminders

---

## 7. EXISTING ANALYTICS

### What Exists

| Feature | Location | Status |
|---------|----------|--------|
| Business goals dashboard | `convex/goals.ts` + `convex/center.ts` | ✅ Working |
| Marketplace insights | `memory.marketInsights` | ✅ Working |
| Event counts by type | `backend/events.countBehavioralEvents` | ✅ Working |
| Top searches/categories | `memory.marketInsights` | ✅ Working |
| Popular products | `memory.marketInsights` | ✅ Working |

### What Does NOT Exist Yet

- Seller-level analytics dashboard
- Revenue/order trend charts
- Customer cohort analysis
- Conversion funnel
- A/B testing infrastructure
- Real-time dashboards

---

## 8. EXISTING EVENT TRACKING

### Event Vocabulary (16 event types)

```
PRODUCT_VIEW, PRODUCT_CLICK, SEARCH, CATEGORY_VIEW, SHOP_VIEW,
INTEREST, WISHLIST_ADD, WISHLIST_REMOVE, CART_ADD, CART_REMOVE,
CHECKOUT_START, PURCHASE, REORDER, VELREPEAT_START, VELREPEAT_CANCEL,
RECOMMENDATION_CLICK
```

### Event Pipeline

```
Browser (useTracking hook)
  → Convex mutation: memoryEvents.track
  → Convex table: customerEvents (realtime, fast reads)
  → Cron (every 15 min): memory.flushToNeon
  → Neon table: behavioral_events (durable, append-only)
```

### Identity Binding

- **Signed-in:** `userId` set, `anonymousId` null
- **Signed-out:** `anonymousId` set (localStorage UUID), `userId` null
- **Merge:** On sign-in, `mergeAnonymousToUser` re-binds anonymous events to the account

### Rate Limiting

- 300 events per user per 60 seconds
- Rate limit tracked in Convex `rateLimits` table

---

## 9. EXISTING RECOMMENDATION FEATURES

### Customer Memory (`convex/memory.ts`)

**myMemory** — Returns per-customer understanding:
- Category affinity (top 5 by score)
- Top search terms
- Favorite shops (top 3)
- Purchase intent level (low/medium/high)
- Event counts (views, purchases, cart adds, etc.)

**recommendForCustomer** — Personalized product recommendations:
- Signed-in: uses personal memory (product interest + category affinity + shop affinity + search matches)
- Signed-out: global popularity (last 30 days)
- Warm-up blend: fewer than 4 personal picks → top up with popular items
- Reasons displayed: "คุณเคยสั่งซื้อ", "คุณเพิ่มลงตะกร้า", "คุณแสดงความสนใจ", etc.

**dueReorderReminders** — Proactive reorder nudges:
- Learns purchase cycle from order history (≥2 purchases)
- Calculates average days between purchases
- Returns items due for reorder

### Interest Scoring (Customer Memory Core)

| Event Type | Weight | Half-life (days) |
|-----------|--------|-----------------|
| PURCHASE | 12 | 120 |
| VELREPEAT_START | 8 | 120 |
| CART_ADD | 6 | 90 |
| WISHLIST_ADD | 5 | 90 |
| INTEREST | 4 | 60 |
| PRODUCT_VIEW | 2 | 30 |
| PRODUCT_CLICK | 1.5 | 30 |
| SEARCH | 0.4 | 45 |
| SHOP_VIEW | 0.3 | 60 |
| CATEGORY_VIEW | 0.25 | 45 |

**Time Decay:** Exponential half-life model — `RECENT INTEREST > OLD INTEREST`

**Purchase Intent Estimation:**
- High: ≥3 purchases OR (≥5 cart adds AND ≥10 views) OR ≥3 wishlists OR ≥2 checkouts
- Medium: >0 purchases/cart adds/wishlists/checkouts
- Low: browsing only

---

## 10. WHAT CAN BE REUSED

### Fully Reusable

| Component | Reason |
|-----------|--------|
| Neon Commerce Core (all 14+ tables) | Complete, production-ready commerce schema |
| All backend services (backend/*.ts) | Full business logic layer |
| Convex auth system | Working email OTP + anonymous auth |
| Role-based access control | 5 roles + department scoping |
| Cloudinary image upload (backend) | Server-side only, working |
| Stripe integration | Payment processing working |
| VelRepeat subscriptions | Auto-order processing working |
| Customer Memory core (pure logic) | Scoring, decay, intent — all working |
| Event tracking pipeline | Browser → Convex → Neon flush working |
| Interest scoring | Configurable weights + half-lives working |
| Recommendation engine v1 | Personalized + popular recommendations working |
| Due reorder reminders | Purchase cycle learning working |
| Shared UI components (packages/shared) | RequireAuth, RequireRole, LogoDropdown, etc. |
| Rate limiting | Convex-based rate limiting working |
| Audit logging | Admin action audit trail working |
| Business rules engine | Configurable via platform_settings |

### Reusable with Modifications

| Component | Modification Needed |
|-----------|-------------------|
| VelShop web app | Migrate to mobile-first architecture |
| VelSeller web app | Add analytics dashboard |
| VelCenter web app | Add behavioral analytics views |
| Event vocabulary | Add new event types (see below) |
| Customer Memory | Add new signal types (see below) |

---

## 11. WHAT MUST BE CHANGED

### Priority 1: Image Upload Architecture

**Current:** Browser → Cloudinary (direct) in `ProfileImageUpload.tsx`
**Required:** Browser → Convex HTTP action → Cloudinary (server-side only)
**Files:** `apps/shop/src/components/shop/ProfileImageUpload.tsx`

### Priority 2: Event Vocabulary Expansion

**Current:** 16 event types
**Required:** Add missing events for complete behavior tracking

New events needed:
- `APP_OPEN` / `SESSION_START` / `SESSION_END`
- `PRODUCT_IMAGE_VIEW`
- `PRODUCT_IGNORE` (viewed but didn't engage)
- `SEARCH_RESULT_CLICK` (with position)
- `NOTIFICATION_SENT` / `NOTIFICATION_OPEN`
- `PAGE_VIEW` (for navigation analytics)
- `FILTER_APPLY` / `SORT_CHANGE`

### Priority 3: Mobile App API Requirements

VelShop mobile needs dedicated API surface:
- Compact payloads (bandwidth-sensitive)
- Offline support patterns
- Push notification tokens
- Image upload (server-side only)
- Event batching

### Priority 4: Seller Analytics

VelSeller needs analytics dashboard:
- Sales trends
- Product performance
- Customer insights (anonymized)
- Revenue forecasting

### Priority 5: Behavioral Analytics for VelCenter

VelCenter needs behavioral analytics:
- Marketplace-wide trends
- Customer cohort analysis
- Conversion funnels
- Recommendation performance metrics

---

## 12. WHAT MUST BE ADDED

### New Event Types

```
APP_OPEN, SESSION_START, SESSION_END
PRODUCT_IMAGE_VIEW, PRODUCT_IGNORE
SEARCH_RESULT_CLICK (with position)
NOTIFICATION_SENT, NOTIFICATION_OPEN
PAGE_VIEW, FILTER_APPLY, SORT_CHANGE
```

### New Customer Memory Signals

```
brandAffinity          — products viewed/purchased by brand
pricePreference        — price range analysis
purchaseFrequency      — orders per time period
purchaseInterval       — days between purchases
recentInterests        — last N interactions (recency-weighted)
preferredStores        — shops with highest engagement
categoryDiversity      — breadth of category interest
searchPatterns         — common search terms and refinements
```

### New Recommendation Types

```
frequentlyBoughtTogether  — market basket analysis
similarProducts           — category/attribute similarity
priceAlternatives         — similar products at different prices
newArrivalsPersonalized   — new products matching interest profile
```

### New Analytics Features

```
Seller Analytics Dashboard
- Daily/weekly/monthly sales charts
- Product performance rankings
- Customer retention metrics
- Revenue per category

Center Analytics
- Marketplace-wide behavioral trends
- Customer cohort analysis
- Conversion funnel (view → cart → purchase)
- Recommendation CTR tracking
- Event volume monitoring
```

---

## 13. PROPOSED DATABASE CHANGES

### No Schema Changes Required (Phase 0)

The existing schema supports the new architecture. Future phases may add:

| Addition | Phase | Purpose |
|----------|-------|---------|
| `customer_signals` (Neon) | Phase 2 | Pre-computed customer memory (aggregated) |
| `product_embeddings` | Phase 3+ | Product similarity (ML-ready) |
| `recommendation_log` | Phase 2 | Track which recommendations were shown/clicked |
| `session_events` | Phase 1 | Session-level aggregation |

### Behavioral Events Table

Already exists and is production-ready:
- Append-only with deduplication
- Indexed by user, type, entity, time
- Cron flush from Convex every 15 minutes
- Cursor-based incremental processing

---

## 14. PROPOSED EVENT ARCHITECTURE

### Current Pipeline (Working)

```
Browser → useTracking() → memoryEvents.track (Convex mutation)
                        → customerEvents (Convex table, realtime)
                        → Cron (15 min) → flushToNeon
                        → behavioral_events (Neon, durable)
```

### Proposed Enhancement

```
Browser/Mobile → Event Batch API → Convex (batch insert)
                                 → customerEvents (realtime)
                                 → Cron → behavioral_events (Neon)
                                 → Event Processor (periodic)
                                 → customer_signals (Neon, aggregated)
                                 → Recommendation Engine
```

### Event Processing Strategy

1. **Realtime (Convex):** Raw events for live recommendations
2. **Near-realtime (15-min flush):** Durable copy in Neon
3. **Batch processing (hourly/daily):** Aggregate into customer signals
4. **On-demand:** Recommendation refresh when signals change significantly

---

## 15. PROPOSED CUSTOMER MEMORY ARCHITECTURE

### Layer 1: Raw Events (Exists)

- `customerEvents` in Convex (realtime)
- `behavioral_events` in Neon (durable)

### Layer 2: Customer Signals (To Build)

Pre-computed per-customer aggregates, updated periodically:

```sql
CREATE TABLE customer_signals (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  
  -- Category affinity
  top_categories JSONB,  -- [{category, score, count}]
  
  -- Product interest
  viewed_products JSONB,  -- [{productId, score, lastViewed}]
  purchased_products JSONB, -- [{productId, count, lastPurchased}]
  
  -- Shop affinity
  preferred_shops JSONB,  -- [{shopId, score, visitCount}]
  
  -- Search patterns
  search_terms JSONB,  -- [{query, count, lastSearched}]
  
  -- Purchase behavior
  purchase_frequency DECIMAL,  -- orders per month
  avg_purchase_interval INTEGER,  -- days between orders
  avg_order_value DECIMAL,
  last_purchased_at TIMESTAMPTZ,
  
  -- Intent signals
  current_intent TEXT,  -- 'low' | 'medium' | 'high'
  cart_abandonment_rate DECIMAL,
  
  -- Preferences
  price_range_min DECIMAL,
  price_range_max DECIMAL,
  preferred_categories TEXT[],
  
  -- Metadata
  total_events INTEGER,
  last_event_at TIMESTAMPTZ,
  signal_version INTEGER DEFAULT 1,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Layer 3: Customer Memory (Exists, Enhance)

Current `memory.myMemory` already returns:
- Category affinity
- Top searches
- Favorite shops
- Purchase intent

Enhancement: read from `customer_signals` instead of recomputing each time.

---

## 16. PROPOSED RECOMMENDATION ARCHITECTURE

### V1: Deterministic (Exists, Enhance)

Current: `memory.recommendForCustomer` — works but recomputes on every call.

Enhancement:
1. Cache recommendations in `customer_signals`
2. Refresh when new events arrive (score threshold)
3. Add `frequentlyBoughtTogether` from order history

### V2: Collaborative Filtering (Future)

Market basket analysis from `order_items`:
- Products frequently bought together
- Category co-occurrence
- Seller cross-purchase patterns

### V3: ML-Ready (Future)

- Product embeddings (content-based)
- User embeddings (collaborative filtering)
- Hybrid recommendations

---

## 17. PROPOSED API ARCHITECTURE

### Principle: Single Backend, Multiple Clients

All clients share the same Convex backend. The API surface is the same; only the UI differs.

### Client-Specific API Surface

| Client | Core APIs | Unique APIs |
|--------|-----------|-------------|
| VelShop (Mobile) | Auth, Products, Cart, Orders, Profile | Event batching, push tokens, offline support |
| VelSeller (Web) | Auth, Products, Orders, Inventory | Seller analytics, store management |
| VelCenter (Web) | Auth, Users, Sellers, Products, Orders | Admin analytics, audit logs, platform settings |

### Mobile-Specific Considerations

1. **Bandwidth:** Compact payloads, pagination, field selection
2. **Offline:** Local cache, sync on reconnect
3. **Events:** Batch sending (not individual mutations)
4. **Images:** Server-side upload only, responsive URLs
5. **Push:** Device token registration, notification handling

---

## 18. SECURITY CONCERNS

### Current Security Posture

| Area | Status |
|------|--------|
| Authentication | ✅ Convex Auth (email OTP + anonymous) |
| Authorization | ✅ Role-based (5 roles) + department scoping |
| API secrets | ✅ Never exposed to client |
| Cloudinary | ✅ Server-side upload only (except ProfileImageUpload.tsx) |
| Stripe | ✅ Server-side webhook verification |
| Rate limiting | ✅ Convex-based rate limiting |
| Audit logging | ✅ Admin actions logged |
| Input validation | ✅ Backend validation |

### Issues to Fix

1. **ProfileImageUpload.tsx** still calls Cloudinary directly from browser
2. **No push notification infrastructure** for mobile app
3. **No API key rotation** strategy documented
4. **No rate limiting** for mobile app specifically

### Security Requirements for Mobile App

- Certificate pinning (optional, recommended)
- Token storage (secure enclave / keychain)
- Biometric auth (future)
- Session management (Convex handles this)
- Device fingerprinting (for fraud detection)

---

## 19. SCALABILITY CONCERNS

### Current Scale

| Metric | Estimate |
|--------|----------|
| Users | <1000 |
| Products | <10,000 |
| Orders | <10,000/month |
| Behavioral events | <100,000/day |

### Scale Targets

| Metric | Target |
|--------|--------|
| Users | 100,000+ |
| Products | 1,000,000+ |
| Orders | 1,000,000/month |
| Behavioral events | 10,000,000/day |

### Scalability Strategy

1. **Behavioral Events:** Already append-only, indexed, cursor-based flush
2. **Customer Signals:** Pre-computed aggregates (not recomputed per request)
3. **Recommendations:** Cached per customer, refreshed on score change
4. **Convex:** Realtime queries are scoped (own data only)
5. **Neon:** Read replicas for analytics queries
6. **Event Processing:** Batch processing (not per-event computation)

### Bottlenecks to Watch

- `memory.recommendForCustomer` scans full catalog (optimize with signals)
- `memory.myMemory` loads 400 events per call (cache in customer_signals)
- `flushToNeon` scans recent events (cursor-based, should scale)
- Product search (full-text search may need dedicated engine at scale)

---

## 20. EXACT IMPLEMENTATION ORDER

### Phase 1: Fix Existing Issues (Immediate)

1. Fix `ProfileImageUpload.tsx` — move to server-side upload
2. Add missing event types to vocabulary
3. Verify all existing features work on mobile viewport

### Phase 2: Mobile App Foundation (Weeks 1-2)

1. Create VelShop mobile app shell
2. Implement auth (email OTP)
3. Implement product browsing (list, search, detail)
4. Implement cart + checkout
5. Implement order tracking
6. Implement profile + address management
7. Wire up event tracking (useTracking)

### Phase 3: Customer Memory Enhancement (Weeks 2-3)

1. Add `customer_signals` table (Neon)
2. Build signal computation job (batch processor)
3. Enhance `myMemory` to read from signals
4. Add new event types (APP_OPEN, SESSION_*, etc.)
5. Add session tracking

### Phase 4: Recommendation Enhancement (Weeks 3-4)

1. Add `frequentlyBoughtTogether` analysis
2. Cache recommendations per customer
3. Add recommendation logging (shown/clicked)
4. Add recommendation performance metrics

### Phase 5: Seller Analytics (Weeks 4-5)

1. Build seller analytics dashboard
2. Add sales trend charts
3. Add product performance rankings
4. Add customer insights (anonymized)

### Phase 6: Center Analytics (Weeks 5-6)

1. Add behavioral analytics to VelCenter
2. Add marketplace-wide trends
3. Add conversion funnel
4. Add recommendation CTR tracking

### Phase 7: Advanced Features (Weeks 6+)

1. Push notifications
2. Offline support
3. Collaborative filtering
4. ML-ready infrastructure
5. A/B testing framework
