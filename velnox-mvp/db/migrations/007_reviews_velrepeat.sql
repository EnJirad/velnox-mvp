-- ============================================================================
-- Velnox — Migration 007: Reviews + VelRepeat
-- ----------------------------------------------------------------------------
-- Phase 2 (Database): After Sales + Subscription layers (spec §32–34).
--   * reviews           — product/store reviews (rating 1–5, verified-purchase
--                         enforced at the backend via order_id)
--   * velrepeat_orders  — link each auto-generated order back to its subscription
--   * subscriptions     — variant, payment method, shipping address (spec §33)
--
-- NOTE: `subscriptions` (Neon) is the SINGLE source of truth for VelRepeat.
-- The legacy Convex `subscriptions` table is deprecated and will be migrated
-- into Neon in Phase 10 — we do NOT create a second entity for it here.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- reviews (spec §32) — rating 1–5 enforced by CHECK
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  shop_id    UUID NOT NULL REFERENCES shops (id),
  user_id    UUID NOT NULL REFERENCES users (id),
  order_id   UUID REFERENCES orders (id) ON DELETE SET NULL,  -- verified purchase
  rating     INTEGER NOT NULL,
  title      TEXT,
  comment    TEXT,
  images     JSONB NOT NULL DEFAULT '[]'::jsonb,   -- URLs only, no binary
  status     TEXT NOT NULL DEFAULT 'published'
             CHECK (status IN ('published','pending','hidden')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (rating BETWEEN 1 AND 5),
  UNIQUE (user_id, product_id, order_id)   -- one verified review per purchase
);

CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews (product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_shop ON reviews (shop_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews (user_id);

-- ---------------------------------------------------------------------------
-- subscriptions — VelRepeat commerce source of truth (spec §33)
-- ---------------------------------------------------------------------------
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants (id) ON DELETE SET NULL;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS shipping_address_id UUID REFERENCES addresses (id) ON DELETE SET NULL;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_order_date DATE;

CREATE INDEX IF NOT EXISTS idx_subscriptions_variant ON subscriptions (variant_id);

-- ---------------------------------------------------------------------------
-- velrepeat_orders — every auto-placed order links back to its subscription
-- (spec §34). Backend uses this to prove which orders came from VelRepeat and
-- to compute next-order dates.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS velrepeat_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions (id) ON DELETE CASCADE,
  order_id        UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  scheduled_date  DATE NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_velrepeat_orders_subscription ON velrepeat_orders (subscription_id);
CREATE INDEX IF NOT EXISTS idx_velrepeat_orders_order ON velrepeat_orders (order_id);
