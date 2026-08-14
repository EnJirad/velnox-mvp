/**
 * Velnox — Neon schema migration runner.
 *
 * Applies, in order:
 *   1. db/schema.sql            — base Commerce Core (idempotent)
 *   2. db/migrations/*.sql      — Phase 2+ numbered migrations (idempotent)
 *
 * Every SQL file is written to be safe to run repeatedly (CREATE TABLE IF NOT
 * EXISTS, ALTER ... ADD COLUMN IF NOT EXISTS, guarded CHECK swaps), so this is
 * a single-command migration system.
 *
 * Usage:
 *   DATABASE_URL=<neon-connection-string> bun run db:migrate
 *
 * The connection string lives in the project Keys/API keys UI — never commit
 * it or read it from a client-side file.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getPool } from "../src/backend/db";

const pool = getPool();

const runFile = async (label: string, sql: string) => {
  await pool.query(sql);
  console.log(`   ✅ ${label}`);
};

try {
  console.log("Applying Neon schema…");

  // 1. base schema
  await runFile("db/schema.sql (base Commerce Core)", readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));

  // 2. numbered migrations (sorted by filename)
  const migrationsDir = new URL("./migrations/", import.meta.url);
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    await runFile(`db/migrations/${f}`, readFileSync(join(migrationsDir.pathname, f), "utf8"));
  }

  const res = await pool.query(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name`,
  );
  const tables = (res.rows as { table_name: string }[]).map((r) => r.table_name);
  console.log(`\n✅ Neon schema applied — ${tables.length} tables in public schema:`);
  for (const t of tables) console.log(`   - ${t}`);
} catch (err) {
  console.error("❌ Migration failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
