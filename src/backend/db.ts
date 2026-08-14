/**
 * Velnox Backend — Neon database access
 *
 * Two access paths:
 *  - getDb():    HTTP client (neon) — fast, stateless; for simple reads/writes
 *  - getPool() + withTransaction(): WebSocket Pool — for multi-statement
 *    atomic flows (createOrder, refund, ...) because the HTTP driver does NOT
 *    support reliable transactions.
 *
 * Only ever used from server-side code (Convex node actions + db scripts).
 * DATABASE_URL lives in the project Keys/API keys UI and is never bundled
 * to the client.
 */
import { neonConfig, Pool, type PoolClient } from "@neondatabase/serverless";
import WebSocket from "ws";

// Node < 22 has no global WebSocket — the Neon WebSocket driver needs a
// constructor. Bun (db scripts) has one natively; Convex node runtime may not.
if (typeof globalThis.WebSocket === "undefined") {
  neonConfig.webSocketConstructor = WebSocket as unknown as typeof neonConfig.webSocketConstructor;
}

let pool: Pool | null = null;

export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not configured — add your Neon connection string in the project Keys/API keys UI.",
    );
  }
  return url;
}

export type Db = (sql: string, params?: unknown[]) => Promise<any[]>;
export type Tx = PoolClient;

/** Simple query helper: returns raw rows. */
export function getDb(): Db {
  const p = getPool();
  return async (sql: string, params?: unknown[]) => {
    const res = await p.query(sql, params as any[]);
    return res.rows;
  };
}

/** WebSocket Pool — for transactions. Cached for the lifetime of the process. */
export function getPool(): Pool {
  if (!pool) pool = new Pool({ connectionString: requireDatabaseUrl(), max: 5 });
  return pool;
}

/**
 * Run `fn` inside a real DB transaction (BEGIN/COMMIT/ROLLBACK).
 * Use for anything that must be atomic: order creation, refunds, ...
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
