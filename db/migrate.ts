/**
 * Velnox Neon migration runner.
 *
 *   DATABASE_URL=postgresql://... bun run db:migrate
 *
 * 1. If a legacy `merchants` table exists (from the Merchant-era schema),
 *    rename it to `sellers` and rename `merchant_id` columns in dependent
 *    tables — data is preserved, never dropped.
 * 2. Apply db/schema.sql (idempotent: CREATE ... IF NOT EXISTS).
 *
 * Safe to re-run at any time.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Pool } from "@neondatabase/serverless";
import WebSocket from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "❌ DATABASE_URL is not set. Run with:\n\n" +
        "  DATABASE_URL='postgresql://...' bun run db:migrate\n",
    );
    process.exit(1);
  }

  if (typeof (globalThis as any).WebSocket === "undefined") {
    const { neonConfig } = await import("@neondatabase/serverless");
    neonConfig.webSocketConstructor = WebSocket as any;
  }

  const pool = new Pool({ connectionString: url, max: 1 });
  const client = await pool.connect();
  try {
    console.log("🔌 Connected to Neon.");

    // ---- 1. legacy merchants -> sellers migration (data-preserving) ----
    const hasMerchants = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'merchants'`,
    );
    if (hasMerchants.rows.length > 0) {
      const hasSellers = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sellers'`,
      );
      if (hasSellers.rows.length === 0) {
        console.log("🔄 Migrating legacy `merchants` -> `sellers` …");
        await client.query("ALTER TABLE merchants RENAME TO sellers");
        // Rename merchant_id -> seller_id in every dependent table that has it.
        const cols = await client.query(
          `SELECT table_name, column_name FROM information_schema.columns
           WHERE table_schema = 'public' AND column_name = 'merchant_id'`,
        );
        for (const { table_name, column_name } of cols.rows) {
          await client.query(
            `ALTER TABLE "${table_name}" RENAME COLUMN "${column_name}" TO seller_id`,
          );
          console.log(`   • ${table_name}.merchant_id -> seller_id`);
        }
      } else {
        console.log("ℹ️  Both `merchants` and `sellers` exist — skipping rename.");
      }
    }

    // ---- 2. apply schema ----
    console.log("📦 Applying db/schema.sql …");
    const schemaSql = readFileSync(path.join(__dirname, "schema.sql"), "utf8");
    await client.query(schemaSql);
    console.log("✅ Schema applied (idempotent — re-runnable).");

    // ---- summary ----
    const tables = await client.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
    );
    console.log(`\n📋 Tables (${tables.rows.length}): ${tables.rows.map((r) => r.table_name).join(", ")}`);
    console.log("\n🎉 Velnox Commerce Core is ready on Neon.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("❌ Migration failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
