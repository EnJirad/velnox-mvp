-- ============================================================================
-- Velnox — Migration 005: Orders + Payments
-- ----------------------------------------------------------------------------
-- Phase 2 (Database): Transaction layer (spec §21–26).
--   * orders          — parent_order_id for multi-seller, seller_id/shop_id for
--                       seller sub-orders, tax, expanded status enums (spec §24)
--   * order_items     — variant snapshot + SKU + discount (spec §23)
--   * payments        — provider column + expanded status (spec §25)
--   * payment_transactions — provider-level records (spec §26)
--   * refunds         — provider ref + completed_at
--
-- Order statuses are kept on 3 axes (status / payment_status / shipping_status)
-- instead of one giant enum — more flexible, and the existing backend already
-- uses all three columns. Old values stay valid; new ones are added.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- orders — multi-seller + tax + full statuses (spec §21, §22, §24)
-- ---------------------------------------------------------------------------
ALTER TABLE orders ADD COLUMN IF NOT EXISTS parent_order_id UUID REFERENCES orders (id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES sellers (id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shop_id UUID REFERENCES shops (id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax NUMERIC(12,2) NOT NULL DEFAULT 0;

-- status: full lifecycle (spec §24) — old values preserved for existing rows
DO $$
BEGIN
  ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
  ALTER TABLE orders ADD CONSTRAINT orders_status_check
    CHECK (status IN ('pending','confirmed','processing','packed','shipped',
                      'in_transit','out_for_delivery','delivered','completed',
                      'cancelled','return_requested','returned','refunded'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- payment_status: add processing/cancelled
DO $$
BEGIN
  ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
  ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check
    CHECK (payment_status IN ('unpaid','pending','processing','paid',
                              'partially_refunded','refunded','failed','cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_parent ON orders (parent_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders (seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);

-- ---------------------------------------------------------------------------
-- order_items — variant + SKU snapshot (spec §23) — never re-price from product
-- ---------------------------------------------------------------------------
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_id UUID;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_name TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS discount NUMERIC(12,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_order_items_variant ON order_items (variant_id);

-- ---------------------------------------------------------------------------
-- payments — provider abstraction (spec §25)
-- ---------------------------------------------------------------------------
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider TEXT;          -- 'omise' | 'stripe' | 'manual' ...
ALTER TABLE payments ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users (id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'THB';

DO $$
BEGIN
  ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
  ALTER TABLE payments ADD CONSTRAINT payments_status_check
    CHECK (status IN ('pending','processing','succeeded','failed','cancelled','refunded'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_payments_user ON payments (user_id);

-- ---------------------------------------------------------------------------
-- payment_transactions — provider-level journal per payment (spec §26)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_transactions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id            UUID NOT NULL REFERENCES payments (id) ON DELETE CASCADE,
  provider              TEXT NOT NULL,
  provider_transaction_id TEXT,
  type                  TEXT NOT NULL DEFAULT 'payment'
                        CHECK (type IN ('payment','refund','partial_refund')),
  amount                NUMERIC(12,2) NOT NULL,
  currency              TEXT NOT NULL DEFAULT 'THB',
  status                TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','succeeded','failed')),
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_payment ON payment_transactions (payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider ON payment_transactions (provider, provider_transaction_id);

-- ---------------------------------------------------------------------------
-- refunds — provider refund id + completion time (spec §31)
-- ---------------------------------------------------------------------------
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'THB';
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS provider_refund_id TEXT;
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_refunds_provider ON refunds (provider_refund_id);
