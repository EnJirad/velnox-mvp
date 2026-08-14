-- ============================================================================
-- Velnox — Migration 004: Cart + Wishlist
-- ----------------------------------------------------------------------------
-- Phase 2 (Database): Transaction layer — pre-order (spec §18–20).
--   * carts        — one active cart per user (status lifecycle)
--   * cart_items   — multi-seller items with PRICE SNAPSHOT (never live price)
--   * wishlists    — 1:1 with user
--   * wishlist_items
--
-- Multi-seller support: cart_items carry seller_id + shop_id per line so
-- checkout can group by seller (spec §22).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- carts (spec §18)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS carts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'active'
             CHECK (status IN ('active','checked_out','abandoned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_carts_user ON carts (user_id);

-- ---------------------------------------------------------------------------
-- cart_items (spec §19) — price_snapshot frozen at add-to-cart time
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cart_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id       UUID NOT NULL REFERENCES carts (id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES products (id),
  variant_id    UUID REFERENCES product_variants (id) ON DELETE SET NULL,
  seller_id     UUID NOT NULL REFERENCES sellers (id),
  shop_id       UUID NOT NULL REFERENCES shops (id),
  quantity      INTEGER NOT NULL,
  price_snapshot NUMERIC(12,2) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (quantity > 0),
  CHECK (price_snapshot >= 0)
);

CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items (cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product ON cart_items (product_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_seller ON cart_items (seller_id);

-- One line per (cart, product, variant) — merging on add
CREATE UNIQUE INDEX IF NOT EXISTS uq_cart_items_cart_product
  ON cart_items (cart_id, product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'));

-- ---------------------------------------------------------------------------
-- wishlists (spec §20)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wishlists (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wishlist_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wishlist_id UUID NOT NULL REFERENCES wishlists (id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (wishlist_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlist_items_product ON wishlist_items (product_id);
