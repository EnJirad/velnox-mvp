-- ============================================================================
-- Velnox — Migration 006: Logistics + Returns
-- ----------------------------------------------------------------------------
-- Phase 2 (Database): Logistics + After Sales layers (spec §27–30).
--   * shipments      — per-order shipment with carrier/tracking/status
--   * tracking_events — event timeline (PICKED_UP / IN_TRANSIT / ...)
--   * returns        — full return lifecycle (spec §29)
--   * return_items   — line-level return quantities (spec §30)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- shipments (spec §27)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shipments (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id               UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  seller_id              UUID NOT NULL REFERENCES sellers (id),
  carrier                TEXT NOT NULL,
  tracking_number        TEXT,
  status                 TEXT NOT NULL DEFAULT 'created'
                         CHECK (status IN ('created','picked_up','in_transit',
                                           'arrived_at_hub','out_for_delivery',
                                           'delivered','failed','returned','cancelled')),
  shipping_fee           NUMERIC(12,2) NOT NULL DEFAULT 0,
  estimated_delivery_date DATE,
  shipped_at             TIMESTAMPTZ,
  delivered_at           TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (shipping_fee >= 0)
);

CREATE INDEX IF NOT EXISTS idx_shipments_order ON shipments (order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON shipments (tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipments_seller ON shipments (seller_id);

-- ---------------------------------------------------------------------------
-- tracking_events (spec §28)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tracking_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments (id) ON DELETE CASCADE,
  status      TEXT NOT NULL,          -- PICKED_UP / IN_TRANSIT / ARRIVED_AT_HUB / OUT_FOR_DELIVERY / DELIVERED
  description TEXT,
  location    TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_tracking_events_shipment ON tracking_events (shipment_id);

-- ---------------------------------------------------------------------------
-- returns — full lifecycle (spec §29)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS returns (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  customer_user_id      UUID NOT NULL REFERENCES users (id),
  seller_id             UUID NOT NULL REFERENCES sellers (id),
  reason                TEXT,
  description           TEXT,
  evidence_urls         JSONB NOT NULL DEFAULT '[]'::jsonb,   -- return evidence images
  status                TEXT NOT NULL DEFAULT 'requested'
                        CHECK (status IN ('requested','under_review','approved','rejected',
                                          'return_shipping','received','refunding',
                                          'refunded','cancelled')),
  refund_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  return_tracking_number TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (refund_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_returns_order ON returns (order_id);
CREATE INDEX IF NOT EXISTS idx_returns_seller ON returns (seller_id);
CREATE INDEX IF NOT EXISTS idx_returns_customer ON returns (customer_user_id);

-- ---------------------------------------------------------------------------
-- return_items (spec §30)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS return_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id     UUID NOT NULL REFERENCES returns (id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES order_items (id),
  quantity      INTEGER NOT NULL,
  reason        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_return_items_return ON return_items (return_id);
