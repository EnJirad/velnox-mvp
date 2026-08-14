-- ============================================================================
-- Velnox Commerce Core — Neon PostgreSQL (Source of Truth)
--
-- Ownership chain:  User -> Seller -> Shop -> Product -> Inventory / Images
--
-- Money is NUMERIC(12,2) in the DB; application code converts to/from
-- integers (satang) at calculation boundaries (see ARCHITECTURE_V3_MIGRATION.md).
--
-- This file is applied by `bun run db:migrate`. Every statement is
-- idempotent (IF NOT EXISTS) so it can be re-run safely. The migrate script
-- also handles the legacy `merchants` -> `sellers` rename when upgrading an
-- existing database (data is preserved, never dropped).
-- ============================================================================

-- Order numbers: ORD-YYYYMM-00001 ...
CREATE SEQUENCE IF NOT EXISTS order_number_seq;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  convex_id   TEXT UNIQUE,
  email       TEXT,
  phone       TEXT,
  name        TEXT,
  role        TEXT NOT NULL DEFAULT 'customer',   -- customer | seller | staff | admin | owner
  department  TEXT,                               -- marketing | sales | operations | finance | general
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- sellers  (legacy name: merchants — migrate script renames it in place)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sellers (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id        UUID NOT NULL REFERENCES users(id),
  name                 TEXT NOT NULL,
  tax_id               TEXT,
  status               TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | suspended
  -- Velnox return policy: platform covers up to 10% of a seller's sales;
  -- beyond that the seller is responsible.
  refund_policy_limit  NUMERIC(5,4) NOT NULL DEFAULT 0.10,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- shops
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shops (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id       UUID NOT NULL REFERENCES sellers(id),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE,
  description     TEXT,
  image_url       TEXT,
  phone           TEXT,
  address         TEXT,
  announcement    TEXT,
  status          TEXT NOT NULL DEFAULT 'active',     -- active | suspended | closed
  commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.03, -- Velnox fee (3%)
  currency        TEXT NOT NULL DEFAULT 'THB',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL REFERENCES shops(id),
  name        TEXT NOT NULL,
  description TEXT,
  category    TEXT NOT NULL DEFAULT 'general',   -- general | food | daily | beauty | packaging | other
  unit        TEXT NOT NULL DEFAULT 'piece',
  price       NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency    TEXT NOT NULL DEFAULT 'THB',
  status      TEXT NOT NULL DEFAULT 'draft',     -- draft | published | archived
  supplier    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- product_images — metadata only; the binary lives in object storage
-- (Cloudinary / R2 / S3 via the StorageProvider adapter).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_images (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url               TEXT NOT NULL,             -- secure CDN URL
  storage_provider  TEXT NOT NULL DEFAULT 'cloudinary',
  storage_key       TEXT,                      -- public_id in Cloudinary (for delete)
  alt               TEXT,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  is_primary        BOOLEAN NOT NULL DEFAULT false,
  width             INTEGER,
  height            INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- inventory — separate entity from Product (multi-warehouse ready)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  shop_id           UUID NOT NULL REFERENCES shops(id),
  quantity          INTEGER NOT NULL DEFAULT 0,        -- on-hand
  reserved_quantity INTEGER NOT NULL DEFAULT 0,        -- reserved by open orders
  reorder_level     INTEGER NOT NULL DEFAULT 0,
  warehouse         TEXT NOT NULL DEFAULT 'main',
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- addresses
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS addresses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id),
  label          TEXT NOT NULL DEFAULT 'default',
  recipient_name TEXT NOT NULL,
  phone          TEXT NOT NULL,
  line1          TEXT NOT NULL,
  line2          TEXT,
  city           TEXT,
  state          TEXT,
  postal_code    TEXT,
  country        TEXT NOT NULL DEFAULT 'TH',
  is_default     BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- orders — commerce heart. Address + item details are SNAPSHOTTED at
-- purchase time (never re-read product.price for old orders).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number     TEXT NOT NULL DEFAULT 'ORD-' || to_char(now(), 'YYYYMM') || '-' || lpad(nextval('order_number_seq')::text, 5, '0'),
  customer_user_id UUID NOT NULL REFERENCES users(id),
  status           TEXT NOT NULL DEFAULT 'pending',  -- pending|confirmed|shipped|delivered|completed|cancelled
  payment_status   TEXT NOT NULL DEFAULT 'unpaid',   -- unpaid|pending|paid|partially_refunded|refunded|failed
  shipping_status  TEXT NOT NULL DEFAULT 'not_shipped', -- not_shipped|processing|shipped|delivered|returned
  shipping_method  TEXT,
  tracking_number  TEXT,
  subtotal         NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping_fee     NUMERIC(12,2) NOT NULL DEFAULT 0,
  total            NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency         TEXT NOT NULL DEFAULT 'THB',
  address_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  note             TEXT,
  idempotency_key  TEXT UNIQUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- order_items — frozen snapshots of what was bought (product, shop, seller,
-- name, unit price, quantity). commission_rate snapshots the shop's rate.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id),
  shop_id         UUID NOT NULL REFERENCES shops(id),
  seller_id       UUID NOT NULL REFERENCES sellers(id),
  product_name    TEXT NOT NULL,
  unit            TEXT NOT NULL,
  unit_price      NUMERIC(12,2) NOT NULL,
  quantity        INTEGER NOT NULL,
  subtotal        NUMERIC(12,2) NOT NULL,
  commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.03
);

-- ---------------------------------------------------------------------------
-- payments / refunds
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount       NUMERIC(12,2) NOT NULL,
  currency     TEXT NOT NULL DEFAULT 'THB',
  method       TEXT NOT NULL,          -- cod | transfer | card | promptpay | wallet
  status       TEXT NOT NULL DEFAULT 'pending', -- pending | succeeded | failed | refunded
  external_ref TEXT,
  paid_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refunds (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments(id),
  amount     NUMERIC(12,2) NOT NULL,
  reason     TEXT,
  status     TEXT NOT NULL DEFAULT 'requested', -- requested | approved | processed | rejected
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- commissions / settlements — marketplace fees
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id     UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  seller_id         UUID NOT NULL REFERENCES sellers(id),
  shop_id           UUID NOT NULL REFERENCES shops(id),
  order_amount      NUMERIC(12,2) NOT NULL,
  commission_rate   NUMERIC(5,4) NOT NULL,
  commission_amount NUMERIC(12,2) NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending',  -- pending | settled | voided
  settled_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settlements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id        UUID NOT NULL REFERENCES sellers(id),
  period_start     DATE NOT NULL,
  period_end       DATE NOT NULL,
  gross_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  return_deduction NUMERIC(12,2) NOT NULL DEFAULT 0,
  payout_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'pending',  -- pending | paid
  paid_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- subscriptions (VelRepeat) — commerce data owned by Neon; intelligence
-- (cycle learning, prediction, reminders) lives in Convex.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_user_id    UUID NOT NULL REFERENCES users(id),
  product_id          UUID NOT NULL REFERENCES products(id),
  shop_id             UUID NOT NULL REFERENCES shops(id),
  seller_id           UUID NOT NULL REFERENCES sellers(id),
  quantity            INTEGER NOT NULL DEFAULT 1,
  unit_price_snapshot NUMERIC(12,2) NOT NULL,
  frequency           TEXT NOT NULL DEFAULT 'monthly',  -- daily | weekly | monthly | custom
  interval_days       INTEGER NOT NULL DEFAULT 30,
  next_order_date     DATE NOT NULL,
  status              TEXT NOT NULL DEFAULT 'active',   -- active | paused | cancelled
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_sellers_owner ON sellers(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_shops_seller ON shops(seller_id);
CREATE INDEX IF NOT EXISTS idx_shops_slug ON shops(slug);
CREATE INDEX IF NOT EXISTS idx_products_shop ON products(shop_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_shop ON inventory(shop_id);
CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_seller ON order_items(seller_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_commissions_order ON commissions(order_id);
CREATE INDEX IF NOT EXISTS idx_commissions_seller ON commissions(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_due ON subscriptions(status, next_order_date);

-- ============================================================================
-- updated_at trigger helper
-- ============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_updated ON products;
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_orders_updated ON orders;
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_inventory_updated ON inventory;
CREATE TRIGGER trg_inventory_updated BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_subscriptions_updated ON subscriptions;
CREATE TRIGGER trg_subscriptions_updated BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- backward compatibility views (legacy consumers that still say "merchants")
-- ============================================================================
CREATE OR REPLACE VIEW merchants AS SELECT * FROM sellers;
