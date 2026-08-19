-- ============================================================================
-- Velnox — Neon PostgreSQL schema (Commerce Core / Source of Truth)
-- ----------------------------------------------------------------------------
-- Architecture v3: Neon owns commerce data (users, sellers, shops, products,
-- product_images, inventory, addresses, orders, order_items, payments,
-- refunds, commissions, settlements, subscriptions). Convex = Intelligence +
-- Realtime. NEVER create a second source of truth for these entities.
--
-- Rules:
--   * Idempotent — safe to run repeatedly (CREATE TABLE IF NOT EXISTS).
--   * Money is NUMERIC(12,2). Order totals are snapshotted in order_items;
--     old orders must never be re-priced from products.price.
--   * status columns are TEXT + CHECK (easier to migrate than PG enums).
--   * `updated_at` is auto-maintained by a trigger.
--
-- Usage:  DATABASE_URL=<neon-connection-string> bun run db:migrate
-- Verify: DATABASE_URL=<neon-connection-string> bun run db:smoke
--
-- Required env (set in the project Keys/API keys UI):
--   DATABASE_URL — Neon PostgreSQL connection string
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- updated_at trigger (shared by every mutable commerce table)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 1. users — business attributes keyed by the Convex auth id (auth = Convex)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  convex_id     TEXT NOT NULL UNIQUE,           -- Convex auth subject
  email         TEXT,
  phone         TEXT,
  name          TEXT,
  role          TEXT NOT NULL DEFAULT 'customer'
                CHECK (role IN ('customer','seller','staff','admin','owner')),
  department    TEXT
                CHECK (department IN ('marketing','sales','operations','finance','general')),
  avatar_url    TEXT,                           -- profile photo (Cloudinary URL, metadata only)
  cover_url     TEXT,                           -- profile cover photo (Cloudinary URL, metadata only)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- ---------------------------------------------------------------------------
-- 2. sellers — merchant who opened a shop with Velnox (User -> Seller -> Shop)
--    (renamed from "merchants"; see ARCHITECTURE_V3_MIGRATION.md)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sellers (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id        UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  tax_id               TEXT,
  status               TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','approved','rejected','suspended')),
  approved_at          TIMESTAMPTZ,
  approved_by          UUID REFERENCES users (id),
  -- reason shown to the seller when the application was rejected
  rejection_reason     TEXT,
  -- 0.10 = Velnox covers returns up to 10% of sales; beyond that the seller pays
  refund_policy_limit  NUMERIC(6,4) NOT NULL DEFAULT 0.10,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 3. shops — one Seller can own several shops (marketplace-ready)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shops (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id       UUID NOT NULL REFERENCES sellers (id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE,
  description     TEXT,
  image_url       TEXT,
  phone           TEXT,
  address         TEXT,
  announcement    TEXT,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','suspended','closed')),
  -- 0.03 = Velnox platform fee 3% per item (snapshot into order_items/commissions)
  commission_rate NUMERIC(6,4) NOT NULL DEFAULT 0.03,
  currency        TEXT NOT NULL DEFAULT 'THB',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shops_seller ON shops (seller_id);

-- ---------------------------------------------------------------------------
-- 4. products — catalog + CURRENT price only (never used for old orders)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL REFERENCES shops (id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  category    TEXT NOT NULL DEFAULT 'general'
              CHECK (category IN ('general','food','daily','beauty','packaging','other')),
  unit        TEXT NOT NULL DEFAULT 'piece',
  price       NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency    TEXT NOT NULL DEFAULT 'THB',
  status      TEXT NOT NULL DEFAULT 'draft'
              CHECK (status IN ('draft','pending_review','published','rejected','archived')),
  -- moderation rejection reason (only set when status = 'rejected')
  rejection_reason TEXT,
  supplier    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_shop ON products (shop_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products (status);

DROP TRIGGER IF EXISTS trg_products_updated ON products;
CREATE TRIGGER trg_products_updated
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. product_images — metadata ONLY; the binary lives in object storage
--    (Cloudinary via src/backend/storage.ts). storage_key = public_id needed
--    to delete the binary later.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_images (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  url              TEXT NOT NULL,               -- canonical CDN url (original)
  storage_provider TEXT NOT NULL DEFAULT 'cloudinary',
  storage_key      TEXT,                        -- cloudinary public_id / object key
  alt              TEXT,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  is_primary       BOOLEAN NOT NULL DEFAULT false,
  width            INTEGER,
  height           INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images (product_id);

-- ---------------------------------------------------------------------------
-- 6. inventory — stock is a SEPARATE entity from product
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID NOT NULL UNIQUE REFERENCES products (id) ON DELETE CASCADE,
  shop_id           UUID NOT NULL REFERENCES shops (id) ON DELETE CASCADE,
  quantity          INTEGER NOT NULL DEFAULT 0,          -- on-hand
  reserved_quantity INTEGER NOT NULL DEFAULT 0,          -- reserved by open orders
  reorder_level     INTEGER NOT NULL DEFAULT 0,
  warehouse         TEXT NOT NULL DEFAULT 'main',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (quantity >= 0),
  CHECK (reserved_quantity >= 0),
  CHECK (reorder_level >= 0)
);

CREATE INDEX IF NOT EXISTS idx_inventory_shop ON inventory (shop_id);

DROP TRIGGER IF EXISTS trg_inventory_updated ON inventory;
CREATE TRIGGER trg_inventory_updated
  BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. addresses — customer saved addresses (orders freeze a snapshot instead)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS addresses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  label          TEXT NOT NULL DEFAULT 'บ้าน',
  recipient_name TEXT NOT NULL,
  phone          TEXT NOT NULL,
  line1          TEXT NOT NULL,
  line2          TEXT,
  city           TEXT NOT NULL,
  state          TEXT,
  postal_code    TEXT,
  country        TEXT NOT NULL DEFAULT 'TH',
  is_default     BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses (user_id);

-- ---------------------------------------------------------------------------
-- 8. orders — order header with frozen address snapshot + statuses
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS orders_number_seq;

CREATE TABLE IF NOT EXISTS orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number     TEXT NOT NULL UNIQUE
                   DEFAULT ('ORD-' || lpad(nextval('orders_number_seq')::text, 6, '0')),
  customer_user_id UUID NOT NULL REFERENCES users (id),
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','confirmed','shipped','delivered','completed','cancelled')),
  payment_status   TEXT NOT NULL DEFAULT 'unpaid'
                   CHECK (payment_status IN ('unpaid','pending','paid','partially_refunded','refunded','failed')),
  shipping_status  TEXT NOT NULL DEFAULT 'not_shipped'
                   CHECK (shipping_status IN ('not_shipped','processing','shipped','delivered','returned')),
  shipping_method  TEXT,
  tracking_number  TEXT,
  subtotal         NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping_fee     NUMERIC(12,2) NOT NULL DEFAULT 0,
  total            NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency         TEXT NOT NULL DEFAULT 'THB',
  address_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,   -- frozen at purchase time
  note             TEXT,
  -- unique per customer+cart: makes createOrder retry-safe (never duplicates)
  idempotency_key  TEXT UNIQUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders (customer_user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders (created_at DESC);

DROP TRIGGER IF EXISTS trg_orders_updated ON orders;
CREATE TRIGGER trg_orders_updated
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 9. order_items — line-level SNAPSHOT (product name, unit, unit price, shop,
--    seller, commission rate at purchase time). Never re-price from products.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  product_id      UUID NOT NULL,
  shop_id         UUID NOT NULL,
  seller_id       UUID NOT NULL,
  product_name    TEXT NOT NULL,               -- snapshot
  unit            TEXT NOT NULL,               -- snapshot
  unit_price      NUMERIC(12,2) NOT NULL,      -- snapshot
  quantity        INTEGER NOT NULL,
  subtotal        NUMERIC(12,2) NOT NULL,
  commission_rate NUMERIC(6,4) NOT NULL DEFAULT 0.03,  -- snapshot of shop rate
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_seller ON order_items (seller_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items (product_id);

-- ---------------------------------------------------------------------------
-- 10. payments — one order can have several payment attempts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  amount       NUMERIC(12,2) NOT NULL,
  currency     TEXT NOT NULL DEFAULT 'THB',
  method       TEXT NOT NULL CHECK (method IN ('cod','transfer','card','promptpay','wallet')),
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','succeeded','failed','refunded')),
  external_ref TEXT,
  paid_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_order ON payments (order_id);

-- ---------------------------------------------------------------------------
-- 11. refunds — return / dispute records (Velnox covers up to 10% of sales)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refunds (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments (id),
  amount     NUMERIC(12,2) NOT NULL,
  reason     TEXT,
  status     TEXT NOT NULL DEFAULT 'requested'
             CHECK (status IN ('requested','approved','processed','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds (order_id);

-- ---------------------------------------------------------------------------
-- 12. commissions — 3% platform fee per line item (snapshot), voided on refund
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commissions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id    UUID NOT NULL REFERENCES order_items (id) ON DELETE CASCADE,
  order_id         UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  seller_id        UUID NOT NULL,
  shop_id          UUID NOT NULL,
  order_amount     NUMERIC(12,2) NOT NULL,
  commission_rate  NUMERIC(6,4) NOT NULL,
  commission_amount NUMERIC(12,2) NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','settled','voided')),
  settled_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commissions_order ON commissions (order_id);
CREATE INDEX IF NOT EXISTS idx_commissions_seller ON commissions (seller_id);
CREATE INDEX IF NOT EXISTS idx_commissions_item ON commissions (order_item_id);

-- ---------------------------------------------------------------------------
-- 13. settlements — periodic payout summary per seller (v2; reserved now)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settlements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id         UUID NOT NULL REFERENCES sellers (id) ON DELETE CASCADE,
  period_start      DATE NOT NULL,
  period_end        DATE NOT NULL,
  gross_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  refund_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  payout_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','paid')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_settlements_seller ON settlements (seller_id);

-- ---------------------------------------------------------------------------
-- 14. subscriptions — VelRepeat (commerce side; intelligence lives in Convex)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  product_id          UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  shop_id             UUID NOT NULL REFERENCES shops (id) ON DELETE CASCADE,
  seller_id           UUID NOT NULL,
  quantity            INTEGER NOT NULL,
  unit_price_snapshot NUMERIC(12,2) NOT NULL,   -- frozen at signup
  frequency           TEXT NOT NULL DEFAULT 'monthly'
                      CHECK (frequency IN ('daily','weekly','monthly','custom')),
  interval_days       INTEGER NOT NULL DEFAULT 30,
  next_order_date     DATE NOT NULL,
  status              TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','paused','cancelled')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions (customer_user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_seller ON subscriptions (seller_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_product ON subscriptions (product_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_due ON subscriptions (status, next_order_date);

DROP TRIGGER IF EXISTS trg_subscriptions_updated ON subscriptions;
CREATE TRIGGER trg_subscriptions_updated
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
