-- ============================================================================
-- Velnox — Migration 008: Finance (ledger + balances + payouts)
-- ----------------------------------------------------------------------------
-- Phase 2 (Database): Finance layer (spec §35–37).
--   * financial_ledger — source of truth for ALL money movement (spec §37)
--   * seller_balances  — derived/documented balances (never hard-updated by the
--                        frontend; recomputed from the ledger by the backend)
--   * seller_payouts   — payout requests and their lifecycle (spec §36)
--
-- Rules:
--   * Financial records are NEVER hard-deleted. Corrections are written as a
--     new ADJUSTMENT / reversal entry, never UPDATE/DELETE.
--   * Money is NUMERIC(12,2) with an explicit currency on every row
--     (see docs/PHASE2_DATABASE.md — deliberate decision replacing spec §50
--     integer minor units; PostgreSQL NUMERIC is exact, no float error).
--   * seller_balances is a convenience projection. The ledger is the truth.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- financial_ledger (spec §37)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS financial_ledger (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id TEXT,                -- provider / payment transaction reference
  order_id      UUID REFERENCES orders (id) ON DELETE SET NULL,
  seller_id     UUID REFERENCES sellers (id) ON DELETE SET NULL,
  type          TEXT NOT NULL
                CHECK (type IN ('sale','platform_commission','shipping_revenue',
                                'seller_payout','refund','return_cost','penalty','adjustment')),
  amount        NUMERIC(12,2) NOT NULL,      -- signed: +income / -expense
  currency      TEXT NOT NULL DEFAULT 'THB',
  description   TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_ledger_order ON financial_ledger (order_id);
CREATE INDEX IF NOT EXISTS idx_financial_ledger_seller ON financial_ledger (seller_id);
CREATE INDEX IF NOT EXISTS idx_financial_ledger_type ON financial_ledger (type);
CREATE INDEX IF NOT EXISTS idx_financial_ledger_created ON financial_ledger (created_at DESC);

-- ---------------------------------------------------------------------------
-- seller_balances (spec §35) — projection; backend recomputes from ledger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seller_balances (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id         UUID NOT NULL UNIQUE REFERENCES sellers (id) ON DELETE CASCADE,
  available_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  pending_balance   NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_earned      NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_withdrawn   NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'THB',
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (available_balance >= 0),
  CHECK (pending_balance >= 0),
  CHECK (total_earned >= 0),
  CHECK (total_withdrawn >= 0)
);

-- ---------------------------------------------------------------------------
-- seller_payouts (spec §36)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seller_payouts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id     UUID NOT NULL REFERENCES sellers (id) ON DELETE CASCADE,
  amount        NUMERIC(12,2) NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'THB',
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','processing','completed','failed','cancelled')),
  method        TEXT,             -- bank_transfer / promptpay / ...
  destination   TEXT,             -- masked account / promptpay id
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_seller_payouts_seller ON seller_payouts (seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_payouts_status ON seller_payouts (status);
