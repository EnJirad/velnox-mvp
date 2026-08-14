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
  // base Commerce Core (schema.sql)
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
  // Phase 2 migrations
  "user_profiles",
  "categories",
  "product_variants",
  "carts",
  "cart_items",
  "wishlists",
  "wishlist_items",
  "payment_transactions",
  "shipments",
  "tracking_events",
  "returns",
  "return_items",
  "reviews",
  "velrepeat_orders",
  "seller_balances",
  "seller_payouts",
  "financial_ledger",
  "platform_settings",
  "notifications",
  "audit_logs",
  "staff_profiles",
  "coupons",
  "promotions",
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
    console.log(`✅ All ${REQUIRED_TABLES.length} required tables exist.`);
  }

  // platform_settings seeds (commission/return threshold must not be hard-coded)
  const seeds = await pool.query(`SELECT key FROM platform_settings`);
  const seedKeys = new Set((seeds.rows as { key: string }[]).map((r) => r.key));
  const EXPECTED_SEEDS = [
    "platform_name",
    "currency",
    "platform_commission_percent",
    "shipping_company_percent",
    "return_rate_threshold",
  ];
  const missingSeeds = EXPECTED_SEEDS.filter((k) => !seedKeys.has(k));
  if (missingSeeds.length > 0) {
    console.error(`❌ Missing platform_settings seeds: ${missingSeeds.join(", ")}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ platform_settings seeds present (${EXPECTED_SEEDS.length} keys).`);
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
