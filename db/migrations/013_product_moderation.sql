-- ============================================================================
-- Velnox — Migration 013: Seller + product moderation
-- ----------------------------------------------------------------------------
-- Spec §16–17 / §37: products move through a real review pipeline
-- (draft -> pending_review -> published | rejected) and the seller must see
-- the rejection reason. Also stores the seller-application rejection reason
-- (spec §36) and keeps the authoritative schema.sql in sync.
--
-- Safe: idempotent ADD COLUMN IF NOT EXISTS + constraint re-create — run via:
--   DATABASE_URL=... bun run db:migrate
-- ============================================================================

-- ---------------------------------------------------------------------------
-- sellers — rejection reason for the application review (spec §36)
-- ---------------------------------------------------------------------------
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- ---------------------------------------------------------------------------
-- products — moderation pipeline + rejection reason (spec §16–17, §37)
-- ---------------------------------------------------------------------------
ALTER TABLE products ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

DO $$
BEGIN
  ALTER TABLE products DROP CONSTRAINT IF EXISTS products_status_check;
  ALTER TABLE products ADD CONSTRAINT products_status_check
    CHECK (status IN ('draft','pending_review','published','rejected','archived'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_status ON products (status);
