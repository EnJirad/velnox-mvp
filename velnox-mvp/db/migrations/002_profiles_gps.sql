-- ============================================================================
-- Velnox — Migration 002: Profiles + GPS
-- ----------------------------------------------------------------------------
-- Phase 2 (Database): Identity layer (spec §6–8).
--   * user_profiles  — extended profile (first/last name, DOB, gender, default address)
--   * users.status   — account status (active/pending/suspended/banned) + soft delete
--   * addresses      — GPS columns (latitude/longitude/place_id) + TH address fields
--
-- Idempotent: safe to run repeatedly. No DROP of data — only ALTER ADD + CREATE.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- users: account status + soft delete
-- ---------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

DO $$
BEGIN
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
  ALTER TABLE users ADD CONSTRAINT users_status_check
    CHECK (status IN ('active','pending','suspended','banned'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);

-- ---------------------------------------------------------------------------
-- addresses: GPS (spec §7) — 3 columns + range checks (spec §8)
--   legacy mapping: city -> province, state -> district (kept; new fields fill in)
-- ---------------------------------------------------------------------------
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS subdistrict TEXT;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS district TEXT;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS province TEXT;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,7);
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7);
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS place_id TEXT;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

DO $$
BEGIN
  ALTER TABLE addresses DROP CONSTRAINT IF EXISTS addresses_latitude_check;
  ALTER TABLE addresses ADD CONSTRAINT addresses_latitude_check
    CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE addresses DROP CONSTRAINT IF EXISTS addresses_longitude_check;
  ALTER TABLE addresses ADD CONSTRAINT addresses_longitude_check
    CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses (user_id);

-- ---------------------------------------------------------------------------
-- user_profiles — 1:1 with users (spec §6). Kept separate so `users` stays lean
-- and matches the Convex auth users table.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  first_name          TEXT,
  last_name           TEXT,
  display_name        TEXT,
  date_of_birth       DATE,
  gender              TEXT
                      CHECK (gender IN ('male','female','other','unspecified')),
  default_address_id  UUID REFERENCES addresses (id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
