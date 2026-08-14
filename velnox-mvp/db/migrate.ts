/**
 * Velnox — Neon schema migration runner.
 *
 * Applies db/schema.sql (idempotent: CREATE TABLE IF NOT EXISTS) to the Neon
 * database pointed to by DATABASE_URL, then lists the tables that exist.
 *
 * Usage:
 *   DATABASE_URL=<neon-connection-string> bun run db:migrate
 *
 * The connection string lives in the project Keys/API keys UI — never commit
 * it or read it from a client-side file.
 */
import { readFileSync } from "node:fs";
import { getPool } from "../src/backend/db";

const pool = getPool();

try {
  const sql = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
  await pool.query(sql);

  const res = await pool.query(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name`,
  );
  const tables = (res.rows as { table_name: string }[]).map((r) => r.table_name);
  console.log(`✅ Neon schema applied — ${tables.length} tables in public schema:`);
  for (const t of tables) console.log(`   - ${t}`);
} catch (err) {
  console.error("❌ Migration failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
