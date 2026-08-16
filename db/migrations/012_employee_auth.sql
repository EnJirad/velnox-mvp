-- ============================================================================
-- Velnox — Migration 012: Employee password authentication
-- ----------------------------------------------------------------------------
-- Spec §9–§11 / §42: VelCenter employees log in with a private URL +
-- email/employee-id + password. Password hashes live ONLY in the Convex Auth
-- `authAccounts` table (scrypt) — never here, never plaintext, and never
-- viewable by the company. This migration adds the business attributes the
-- owner/HR flow needs:
--
--   users.employee_id          — human-friendly employee id accepted at login
--   users.password_updated_at  — audit metadata (NOT the hash — no password
--                                data is ever stored in Neon)
--
-- Safe: idempotent ADD COLUMN IF NOT EXISTS — re-runnable like every other
-- migration in this repo (run via: DATABASE_URL=... bun run db:migrate).
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_updated_at TIMESTAMPTZ;

-- Logins resolve employee_id → email; a unique index keeps ids unambiguous.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_employee_id ON users (employee_id)
  WHERE employee_id IS NOT NULL;
