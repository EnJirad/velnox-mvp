-- ============================================================================
-- Velnox — Migration 009: Seller profile + Store settings/location
-- ----------------------------------------------------------------------------
-- Phase 2 (Database): Commerce layer (spec §9–12).
--   * sellers — business type, contacts, approval audit, status 'rejected'
--   * shops   — store settings (banner, hours, policies) + rating + GPS location
--
-- The existing `sellers` / `shops` tables are extended in place (no new
-- duplicate tables) so the backend services that already query them keep
-- working unchanged.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- sellers — profile + approval audit (spec §9)
-- ---------------------------------------------------------------------------
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS business_type TEXT;   -- individual / company
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users (id);
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- status: add 'rejected' (spec §9) — old values preserved
DO $$
BEGIN
  ALTER TABLE sellers DROP CONSTRAINT IF EXISTS sellers_status_check;
  ALTER TABLE sellers ADD CONSTRAINT sellers_status_check
    CHECK (status IN ('pending','approved','rejected','suspended'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_sellers_status ON sellers (status);

-- ---------------------------------------------------------------------------
-- shops — store settings + rating + location (spec §10, §11, §12)
-- ---------------------------------------------------------------------------
ALTER TABLE shops ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS business_hours TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS return_policy TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS shipping_policy TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) NOT NULL DEFAULT 0;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS review_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS subdistrict TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS district TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS province TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,7);
ALTER TABLE shops ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7);
ALTER TABLE shops ADD COLUMN IF NOT EXISTS place_id TEXT;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- status: add 'pending' (spec §10)
DO $$
BEGIN
  ALTER TABLE shops DROP CONSTRAINT IF EXISTS shops_status_check;
  ALTER TABLE shops ADD CONSTRAINT shops_status_check
    CHECK (status IN ('pending','active','suspended','closed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE shops DROP CONSTRAINT IF EXISTS shops_rating_check;
  ALTER TABLE shops ADD CONSTRAINT shops_rating_check
    CHECK (rating >= 0 AND rating <= 5);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE shops DROP CONSTRAINT IF EXISTS shops_latitude_check;
  ALTER TABLE shops ADD CONSTRAINT shops_latitude_check
    CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE shops DROP CONSTRAINT IF EXISTS shops_longitude_check;
  ALTER TABLE shops ADD CONSTRAINT shops_longitude_check
    CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_shops_status ON shops (status);
