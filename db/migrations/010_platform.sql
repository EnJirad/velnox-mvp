-- ============================================================================
-- Velnox — Migration 010: Platform (settings, notifications, audit, staff)
-- ----------------------------------------------------------------------------
-- Phase 2 (Database): Platform layer (spec §42–48).
--   * platform_settings — key/value JSONB (single config row per key) + seeds.
--                         Values are read by the BACKEND only — frontend never
--                         sets commission/percentages itself (spec §49).
--   * notifications     — in-app notifications (spec §45)
--   * audit_logs        — every important action, immutable (spec §48)
--   * staff_profiles    — department + granular permissions (spec §46–47)
--   * coupons / promotions (spec §43–44)
--
-- Deliberate decisions (see docs/PHASE2_DATABASE.md):
--   * platform_settings is key/value, not fixed columns — adding a setting
--     later is a row, not a migration.
--   * staff_profiles.department reuses the existing department set from
--     `users` (marketing/sales/operations/finance/general) instead of the
--     spec's OPERATIONS/FINANCE/... — the velcenter UI already uses them.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- platform_settings (spec §42) — key/value JSONB
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_settings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT NOT NULL UNIQUE,
  value      JSONB NOT NULL,
  updated_by UUID REFERENCES users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed defaults (spec §23/§39/§41/§42) — idempotent
INSERT INTO platform_settings (key, value)
SELECT * FROM (VALUES
  ('platform_name',              '"Velnox"'::jsonb),
  ('currency',                   '"THB"'::jsonb),
  ('platform_commission_percent', '3'::jsonb),
  ('shipping_company_percent',   '10'::jsonb),
  ('return_rate_threshold',      '10'::jsonb),
  ('auto_approve_sellers',       'false'::jsonb),
  ('auto_approve_products',      'false'::jsonb),
  ('tax_enabled',                'false'::jsonb),
  ('tax_percent',                '7'::jsonb),
  ('payment_credit_card',        'true'::jsonb),
  ('payment_promptpay',          'true'::jsonb),
  ('payment_bank_transfer',      'true'::jsonb),
  ('payment_cod',                'true'::jsonb)
) AS seed(key, value)
WHERE NOT EXISTS (SELECT 1 FROM platform_settings WHERE key = seed.key);

-- ---------------------------------------------------------------------------
-- notifications (spec §45)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type       TEXT NOT NULL
             CHECK (type IN ('order','payment','shipping','return','refund',
                             'promotion','system','seller')),
  title      TEXT NOT NULL,
  message    TEXT,
  data       JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, is_read);

-- ---------------------------------------------------------------------------
-- audit_logs (spec §48) — append-only; never UPDATE/DELETE rows
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES users (id),
  actor_role  TEXT,
  action      TEXT NOT NULL,          -- e.g. ADMIN_APPROVED_SELLER
  entity_type TEXT,
  entity_id   TEXT,
  before      JSONB,
  after       JSONB,
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC);

-- ---------------------------------------------------------------------------
-- staff_profiles (spec §46) — department + granular permissions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  department  TEXT
              CHECK (department IN ('marketing','sales','operations','finance','general')),
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
              -- e.g. ["VIEW_SELLERS","APPROVE_SELLERS","VIEW_FINANCE", ...] (spec §47)
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active','inactive')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- coupons (spec §43)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coupons (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code             TEXT NOT NULL UNIQUE,
  type             TEXT NOT NULL CHECK (type IN ('percentage','fixed')),
  value            NUMERIC(12,2) NOT NULL,
  minimum_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
  maximum_discount NUMERIC(12,2),
  usage_limit      INTEGER,
  used_count       INTEGER NOT NULL DEFAULT 0,
  starts_at        TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (value >= 0),
  CHECK (used_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons (code);

-- ---------------------------------------------------------------------------
-- promotions (spec §44)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS promotions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  type        TEXT,
  value       NUMERIC(12,2),
  starts_at   TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
