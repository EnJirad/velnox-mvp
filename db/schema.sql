-- ============================================================================
-- Velnox — Neon PostgreSQL Commerce Core schema
-- Source of Truth: Users, Merchants, Shops, Products, Inventory, Orders,
--                  Payments, Refunds, Commissions, Settlements, Subscriptions
-- Convex = Intelligence + Realtime only (NEVER duplicate source of truth here)
--
-- Idempotent: safe to run repeatedly (CREATE ... IF NOT EXISTS).
-- Apply with: bun run db:migrate   (needs DATABASE_URL)
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- updated_at trigger (shared)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Order numbers: ORD-YYYYMM-000001 style
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

-- ---------------------------------------------------------------------------
-- 1. users  (auth lives in Convex; this holds business attributes)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  convex_id     TEXT UNIQUE,            -- Convex user id (auth source)
  email         TEXT UNIQUE,
  phone         TEXT,
  name          TEXT,
  role          TEXT NOT NULL DEFAULT 'customer'
                CHECK (role IN ('customer','seller','staff','admin','owner')),
  department    TEXT CHECK (department IN ('marketing','sales','operations','finance','general')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

DROP TRIGGER IF EXISTS trg_users_updated ON users;
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. merchants  (User -> Merchant)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS merchants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  tax_id        TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','approved','suspended')),
  -- Velnox policy: if return/refund rate exceeds 10%, platform pays only 10%
  refund_policy_limit NUMERIC(5,4) NOT NULL DEFAULT 0.1000,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merchants_owner ON merchants (owner_user_id);

DROP TRIGGER IF EXISTS trg_merchants_updated ON merchants;
CREATE TRIGGER trg_merchants_updated BEFORE UPDATE ON merchants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. shops  (Merchant -> Shop)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shops (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id     UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE,
  description     TEXT,
  image_url       TEXT,
  phone           TEXT,
  address         TEXT,
  announcement    TEXT,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','suspended','closed')),
  commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0300,  -- 3% platform fee
  currency        TEXT NOT NULL DEFAULT 'THB',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shops_merchant ON shops (merchant_id);
CREATE INDEX IF NOT EXISTS idx_shops_slug ON shops (slug);

DROP TRIGGER IF EXISTS trg_shops_updated ON shops;
CREATE TRIGGER trg_shops_updated BEFORE UPDATE ON shops
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. products  (Shop -> Product) — current price only; order prices are snapshots
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  category      TEXT NOT NULL DEFAULT 'general'
                CHECK (category IN ('general','food','daily','beauty','packaging','other')),
  unit          TEXT NOT NULL DEFAULT 'piece',
  price         NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'THB',
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','published','archived')),
  supplier      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_shop ON products (shop_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products (status);

DROP TRIGGER IF EXISTS trg_products_updated ON products;
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. product_images
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_images (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images (product_id);

-- ---------------------------------------------------------------------------
-- 6. inventory  (separate entity: supports multiple warehouses in the future)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  shop_id          UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  quantity         INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  reorder_level    INTEGER NOT NULL DEFAULT 0,
  warehouse        TEXT NOT NULL DEFAULT 'main',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_shop ON inventory (shop_id);
CREATE INDEX IF NOT EXISTS idx_inventory_low ON inventory (quantity) WHERE quantity <= reorder_level;

DROP TRIGGER IF EXISTS trg_inventory_updated ON inventory;
CREATE TRIGGER trg_inventory_updated BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-create an inventory row whenever a product is created
CREATE OR REPLACE FUNCTION auto_create_inventory()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO inventory (product_id, shop_id, quantity, reserved_quantity, reorder_level)
  VALUES (NEW.id, NEW.shop_id, 0, 0, 0)
  ON CONFLICT (product_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_auto_inventory ON products;
CREATE TRIGGER trg_products_auto_inventory AFTER INSERT ON products
  FOR EACH ROW EXECUTE FUNCTION auto_create_inventory();

-- ---------------------------------------------------------------------------
-- 7. addresses  (customer addresses; snapshot copied into orders at purchase)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS addresses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label          TEXT NOT NULL DEFAULT 'home',
  recipient_name TEXT NOT NULL,
  phone          TEXT NOT NULL,
  line1          TEXT NOT NULL,
  line2          TEXT,
  city           TEXT NOT NULL,
  state          TEXT,
  postal_code    TEXT,
  country        TEXT NOT NULL DEFAULT 'TH',
  is_default     BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses (user_id);

-- ---------------------------------------------------------------------------
-- 8. orders  (with payment/shipping status + address snapshot)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number     TEXT UNIQUE NOT NULL DEFAULT
                   ('ORD' || to_char(now(),'YYYYMM') || '-' || lpad(nextval('order_number_seq')::text, 6, '0')),
  customer_user_id UUID NOT NULL REFERENCES users(id),
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
  address_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,   -- frozen shipping address
  note             TEXT,
  idempotency_key  TEXT UNIQUE,                          -- prevent duplicate orders on retry
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders (customer_user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders (created_at DESC);

DROP TRIGGER IF EXISTS trg_orders_updated ON orders;
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 9. order_items  (snapshot of product/price/shop/merchant at purchase time)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id),
  shop_id         UUID NOT NULL REFERENCES shops(id),
  merchant_id     UUID NOT NULL REFERENCES merchants(id),
  product_name    TEXT NOT NULL,           -- snapshot
  unit            TEXT NOT NULL DEFAULT 'piece', -- snapshot
  unit_price      NUMERIC(12,2) NOT NULL,  -- snapshot — NEVER re-read product.price
  quantity        INTEGER NOT NULL CHECK (quantity > 0),
  subtotal        NUMERIC(12,2) NOT NULL,
  commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0300, -- snapshot of shop rate
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items (product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_merchant ON order_items (merchant_id);
CREATE INDEX IF NOT EXISTS idx_order_items_shop ON order_items (shop_id);

-- ---------------------------------------------------------------------------
-- 10. payments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES orders(id),
  amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency     TEXT NOT NULL DEFAULT 'THB',
  method       TEXT NOT NULL DEFAULT 'cod'
               CHECK (method IN ('cod','transfer','card','promptpay','wallet')),
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','succeeded','failed','refunded')),
  external_ref TEXT,
  paid_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_order ON payments (order_id);

-- ---------------------------------------------------------------------------
-- 11. refunds  (returns / ตีกลับ — tracked for the ≤10% policy)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refunds (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID NOT NULL REFERENCES orders(id),
  payment_id UUID REFERENCES payments(id),
  amount     NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  reason     TEXT,
  status     TEXT NOT NULL DEFAULT 'requested'
             CHECK (status IN ('requested','approved','processed','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds (order_id);

-- ---------------------------------------------------------------------------
-- 12. commissions  (platform fee per order item; settled via settlements)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commissions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id    UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  order_id         UUID NOT NULL REFERENCES orders(id),
  merchant_id      UUID NOT NULL REFERENCES merchants(id),
  shop_id          UUID NOT NULL REFERENCES shops(id),
  order_amount     NUMERIC(12,2) NOT NULL,
  commission_rate  NUMERIC(5,4) NOT NULL,
  commission_amount NUMERIC(12,2) NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','settled','voided')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commissions_merchant ON commissions (merchant_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions (status);

-- ---------------------------------------------------------------------------
-- 13. settlements  (periodic payout to merchants)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settlements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id   UUID NOT NULL REFERENCES merchants(id),
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  gross_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
  commission_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  refund_total  NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','processing','paid')),
  paid_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_settlements_merchant ON settlements (merchant_id);

-- ---------------------------------------------------------------------------
-- 14. subscriptions  (VelRepeat — commerce data lives here; intelligence in Convex)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_user_id   UUID NOT NULL REFERENCES users(id),
  product_id         UUID NOT NULL REFERENCES products(id),
  shop_id            UUID NOT NULL REFERENCES shops(id),
  merchant_id        UUID NOT NULL REFERENCES merchants(id),
  quantity           INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price_snapshot NUMERIC(12,2) NOT NULL,   -- price frozen at subscription time
  frequency          TEXT NOT NULL DEFAULT 'monthly'
                     CHECK (frequency IN ('daily','weekly','monthly','custom')),
  interval_days      INTEGER NOT NULL DEFAULT 30,
  next_order_date    DATE NOT NULL,
  status             TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','paused','cancelled')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions (customer_user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next ON subscriptions (next_order_date) WHERE status = 'active';

DROP TRIGGER IF EXISTS trg_subscriptions_updated ON subscriptions;
CREATE TRIGGER trg_subscriptions_updated BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
