-- ============================================================================
-- Velnox — Migration 011: Durable behavioral event store
-- ----------------------------------------------------------------------------
-- Production architecture (§11, §64): important behavioral events must have a
-- durable persistence strategy OUTSIDE the realtime layer.
--
-- Flow:
--   Browser action → Convex `customerEvents` (realtime, low latency)
--                  → Convex cron (node action) → Neon `behavioral_events`
--                  (durable, rebuildable)
--
-- `behavioral_events` is an append-only event log. It is NOT a duplicate of
-- the Convex table — it is the durable copy that survives a Convex outage so
-- intelligence (interests, recommendations, VelRepeat prediction) can be
-- rebuilt by reprocessing history (docs/disaster-recovery.md §Convex).
--
-- `event_flush_cursor` tracks how far the Convex → Neon flush has advanced so
-- the cron only re-scans recent events (idempotent: UNIQUE + DO NOTHING makes
-- re-runs harmless).
--
-- No PII rules: anonymous events carry anonymousId only, never personal data.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- behavioral_events — append-only durable event log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS behavioral_events (
  id             BIGSERIAL PRIMARY KEY,
  -- where the event originated (Convex customerEvents / business bridge / …)
  source         TEXT NOT NULL DEFAULT 'convex_customer_events',
  -- the source row id — used for dedupe (UNIQUE below)
  source_event_id TEXT NOT NULL,
  -- exactly one of these is set: signed-in customer OR anonymous guest session
  user_id        TEXT,
  anonymous_id   TEXT,
  -- event vocabulary: PRODUCT_VIEW | PRODUCT_CLICK | SEARCH | CATEGORY_VIEW |
  -- SHOP_VIEW | INTEREST | WISHLIST_ADD | WISHLIST_REMOVE | CART_ADD |
  -- CART_REMOVE | CHECKOUT_START | PURCHASE | REORDER | VELREPEAT_START |
  -- VELREPEAT_CANCEL | RECOMMENDATION_CLICK (see convex/memoryEvents.ts)
  event_type     TEXT NOT NULL,
  -- Neon commerce entity id (product / shop / category) when applicable
  entity_id      TEXT,
  -- search query / category label / short value
  value          TEXT,
  -- extra hints (price, quantity, page) — JSONB, never secrets
  context        JSONB,
  occurred_at    TIMESTAMPTZ NOT NULL,
  ingested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT behavioral_events_source_event_uniq UNIQUE (source, source_event_id),
  CONSTRAINT behavioral_events_identity_check CHECK (
    (user_id IS NOT NULL)::int + (anonymous_id IS NOT NULL)::int <= 1
  )
);

-- analytics + rebuild queries
CREATE INDEX IF NOT EXISTS behavioral_events_user_idx
  ON behavioral_events (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS behavioral_events_anonymous_idx
  ON behavioral_events (anonymous_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS behavioral_events_type_idx
  ON behavioral_events (event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS behavioral_events_entity_idx
  ON behavioral_events (entity_id, occurred_at DESC);

-- ---------------------------------------------------------------------------
-- event_flush_cursor — how far the Convex → Neon flush has advanced
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_flush_cursor (
  id            SMALLINT PRIMARY KEY CHECK (id = 1),
  -- last customerEvents.createdAt (epoch ms) flushed to Neon
  last_event_at BIGINT NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO event_flush_cursor (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;
