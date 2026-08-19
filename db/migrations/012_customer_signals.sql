-- ============================================================================
-- Velnox — Migration 012: Customer Signals (Phase 1: Brain Foundation)
-- ----------------------------------------------------------------------------
-- Pre-computed customer memory signals. Instead of recomputing affinities from
-- raw events on every API request, the signal computation pipeline periodically
-- aggregates events into this table. This makes reads fast and scalable.
--
-- Flow:
--   Raw events (Convex customerEvents)
--     → Cron flush → Neon behavioral_events
--     → Signal computation (Convex node action)
--     → customer_signals (this table)
--     → Recommendation engine reads from here
--
-- This is NOT a duplicate of raw events — it is an aggregated read model.
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_signals (
  user_id             UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- Product affinity (top 100 products by score)
  product_affinities  JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- [{ "productId": "...", "score": 0.91 }, ...]

  -- Category affinity (top 20 categories by score)
  category_affinities JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- [{ "category": "beauty", "score": 0.88 }, ...]

  -- Shop affinity (top 20 shops by score)
  shop_affinities     JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- [{ "shopId": "...", "score": 0.72 }, ...]

  -- Purchase patterns (top 50 products by purchase count)
  purchase_patterns   JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- [{ "productId": "...", "purchaseCount": 3, "avgIntervalDays": 30, "lastPurchasedAt": ... }, ...]

  -- Price preference
  price_preference    JSONB,
  -- { "minPrice": 50, "maxPrice": 500, "averagePrice": 200, "medianPrice": 180 }

  -- Purchase behavior aggregates
  purchase_frequency  NUMERIC(8,4),      -- orders per month
  avg_order_value     NUMERIC(12,2),     -- average order total
  last_purchased_at   TIMESTAMPTZ,
  first_purchased_at  TIMESTAMPTZ,
  total_purchases     INTEGER NOT NULL DEFAULT 0,

  -- Intent signal
  current_intent      TEXT NOT NULL DEFAULT 'low'
                      CHECK (current_intent IN ('low', 'medium', 'high')),

  -- Search terms (top 20 by frequency)
  search_terms        JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- [{ "query": " moisturizer", "count": 5, "lastSearchedAt": ... }, ...]

  -- Metadata
  total_events        INTEGER NOT NULL DEFAULT 0,
  last_activity_at    TIMESTAMPTZ,
  signal_version      INTEGER NOT NULL DEFAULT 1,
  computed_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookup for recommendation engine
CREATE INDEX IF NOT EXISTS idx_customer_signals_intent
  ON customer_signals (current_intent);

-- For cleanup of stale signals
CREATE INDEX IF NOT EXISTS idx_customer_signals_computed
  ON customer_signals (computed_at);

-- ============================================================================
-- Signal computation cursor — tracks how far signal computation has advanced
-- (similar to event_flush_cursor for behavioral_events)
-- ============================================================================
CREATE TABLE IF NOT EXISTS signal_computation_cursor (
  id                  SMALLINT PRIMARY KEY CHECK (id = 1),
  last_computed_at    TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01T00:00:00Z',
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO signal_computation_cursor (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;
