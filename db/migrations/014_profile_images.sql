-- ============================================================================
-- Velnox — Migration 014: Customer profile images (avatar + cover)
-- ----------------------------------------------------------------------------
-- Spec §75–§81 / §90: VelShop customers can upload a profile photo and a
-- cover photo. Binary files never touch Neon — they go straight to the
-- existing Cloudinary storage (signed upload, same as product images) and
-- this table only keeps the canonical CDN URLs (metadata, not binary).
--
-- Safe: idempotent ADD COLUMN IF NOT EXISTS — re-runnable like every other
-- migration in this repo (run via: DATABASE_URL=... bun run db:migrate).
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_url TEXT;
