/**
 * Velnox — Neon Commerce Core migration runner
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." bun run db:migrate
 *
 * Reads db/schema.sql (idempotent) and applies it inside a transaction,
 * then verifies the 14 commerce tables exist.
 */
import { Pool } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_TABLES = [
  "users",
  "merchants",
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
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "❌ ไม่พบ DATABASE_URL — กรุณาใส่ connection string ของ Neon ใน Keys/API keys UI\n" +
        "   จากนั้นรัน: bun run db:migrate",
    );
    process.exit(1);
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const schemaSql = readFileSync(join(here, "schema.sql"), "utf8");

  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    console.log("🚀 กำลัง apply Neon schema...");
    await client.query("BEGIN");
    await client.query(schemaSql);
    await client.query("COMMIT");
    console.log("✅ Schema applied เรียบร้อย");

    // Verify tables
    const { rows } = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
    );
    const existing = new Set(rows.map((r) => r.table_name));
    const missing = EXPECTED_TABLES.filter((t) => !existing.has(t));
    console.log(`📊 พบตาราง ${existing.size} ตารางใน database`);
    if (missing.length === 0) {
      console.log("✅ Commerce Core ตารางครบทั้ง 14");
    } else {
      console.warn("⚠️ ตารางที่ยังไม่พบ:", missing.join(", "));
    }
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Migration ล้มเหลว:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
