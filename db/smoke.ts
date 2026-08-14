/**
 * Velnox — Neon schema verification (smoke test).
 *
 * Checks that every Commerce Core table the backend services expect exists,
 * and reports the columns of the core tables so you can confirm the schema
 * matches the code. Exits with code 1 when a table is missing.
 *
 * Usage:
 *   DATABASE_URL=<neon-connection-string> bun run db:smoke
 */
import { getPool } from "../src/backend/db";

const REQUIRED_TABLES = [
  "users",
  "sellers",
  "shops",
  "products",
  "product_images",
  "inventory",
  "addresses",
  "orders",
  "order_items",
  "payments",
  "refunds",
  "commissions",
  "settlements",
  "subscriptions",
] as const;

const pool = getPool();

try {
  const res = await pool.query(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public'`,
  );
  const present = new Set((res.rows as { table_name: string }[]).map((r) => r.table_name));

  const missing = REQUIRED_TABLES.filter((t) => !present.has(t));
  if (missing.length > 0) {
    console.error(`❌ Missing tables (${missing.length}):`);
    for (const t of missing) console.error(`   - ${t}`);
    console.error("Run: DATABASE_URL=<neon-connection-string> bun run db:migrate");
    process.exitCode = 1;
  } else {
    console.log(`✅ All ${REQUIRED_TABLES.length} Commerce Core tables exist.`);
  }

  const cols = await pool.query(
    `SELECT table_name, column_name, data_type
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ANY($1)
      ORDER BY table_name, ordinal_position`,
    [REQUIRED_TABLES],
  );
  const byTable = new Map<string, string[]>();
  for (const r of cols.rows as { table_name: string; column_name: string; data_type: string }[]) {
    const list = byTable.get(r.table_name) ?? [];
    list.push(`${r.column_name} ${r.data_type}`);
    byTable.set(r.table_name, list);
  }
  for (const t of REQUIRED_TABLES) {
    const list = byTable.get(t) ?? [];
    console.log(`\n${t} (${list.length} cols)`);
    if (list.length > 0) console.log(`   ${list.join("\n   ")}`);
  }
} catch (err) {
  console.error("❌ Smoke check failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
