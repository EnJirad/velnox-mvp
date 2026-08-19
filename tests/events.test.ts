/**
 * Velnox Backend — durable behavioral event store tests (architecture §11, §64).
 *
 * Locks the contract of `backend/events.ts`:
 *   - idempotent bulk insert (ON CONFLICT DO NOTHING, batched by 200)
 *   - monotonic flush cursor (GREATEST, never backwards)
 *   - identity rule: a row carries userId OR anonymousId, never both
 */
import { describe, expect, it } from "vitest";
import {
  getFlushCursor,
  insertBehavioralEvents,
  setFlushCursor,
  type BehavioralEventInput,
} from "../backend/events";

/** Minimal fake Db that records queries and can fake inserted rows. */
function makeFakeDb(rowsPerInsert = 0) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const db = async (sql: string, params?: unknown[]) => {
    calls.push({ sql, params: params ?? [] });
    if (sql.startsWith("INSERT INTO behavioral_events")) {
      // one fake inserted row per VALUES tuple → mimics ON CONFLICT DO NOTHING
      const tuples = (sql.match(/\$\d+/g) ?? []).length / 9;
      return Array.from({ length: tuples }, (_, i) => ({ id: i + 1 }));
    }
    if (sql.startsWith("SELECT last_event_at")) {
      return [{ last_event_at: rowsPerInsert === 0 ? "42" : "0" }];
    }
    return [];
  };
  return { db, calls };
}

const sample = (over: Partial<BehavioralEventInput> = {}): BehavioralEventInput => ({
  sourceEventId: "evt_1",
  userId: "user_1",
  type: "PRODUCT_VIEW",
  entityId: "prod_1",
  value: null,
  context: { price: 99 },
  occurredAt: 1_700_000_000_000,
  ...over,
});

describe("§11 — insertBehavioralEvents (durable event store)", () => {
  it("inserts a batch with ON CONFLICT DO NOTHING (idempotent)", async () => {
    const { db, calls } = makeFakeDb();
    const inserted = await insertBehavioralEvents(db, [sample()]);
    expect(inserted).toBe(1);
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain("INSERT INTO behavioral_events");
    expect(calls[0].sql).toContain("ON CONFLICT (source, source_event_id) DO NOTHING");
    // 9 bound params per event: source, source_event_id, user_id, anonymous_id,
    // event_type, entity_id, value, context, occurred_at
    expect(calls[0].params).toHaveLength(9);
  });

  it("stores userId xor anonymousId (never both)", async () => {
    const { db, calls } = makeFakeDb();
    await insertBehavioralEvents(db, [
      sample({ sourceEventId: "a", userId: "u1", anonymousId: null }),
      sample({ sourceEventId: "b", userId: null, anonymousId: "anon_9" }),
    ]);
    const params = calls[0].params;
    expect(params.slice(0, 18)).toEqual([
      "convex_customer_events", "a", "u1", null, "PRODUCT_VIEW", "prod_1", null,
      JSON.stringify({ price: 99 }), new Date(1_700_000_000_000).toISOString(),
      "convex_customer_events", "b", null, "anon_9", "PRODUCT_VIEW", "prod_1", null,
      JSON.stringify({ price: 99 }), new Date(1_700_000_000_000).toISOString(),
    ]);
  });

  it("serializes context to JSONB and passes occurred_at as ISO", async () => {
    const { db, calls } = makeFakeDb();
    await insertBehavioralEvents(db, [sample()]);
    const p = calls[0].params;
    expect(p[7]).toBe(JSON.stringify({ price: 99 }));
    expect(p[8]).toBe(new Date(1_700_000_000_000).toISOString());
  });

  it("splits large batches into chunks of 200", async () => {
    const { db, calls } = makeFakeDb();
    const events = Array.from({ length: 450 }, (_, i) =>
      sample({ sourceEventId: `evt_${i}`, occurredAt: 1_700_000_000_000 + i }),
    );
    const inserted = await insertBehavioralEvents(db, events);
    expect(inserted).toBe(450);
    expect(calls.map((c) => c.params.length / 9)).toEqual([200, 200, 50]);
  });

  it("returns 0 and runs no query for an empty batch", async () => {
    const { db, calls } = makeFakeDb();
    expect(await insertBehavioralEvents(db, [])).toBe(0);
    expect(calls).toHaveLength(0);
  });
});

describe("§11 — flush cursor (event_flush_cursor)", () => {
  it("reads the persisted cursor as a number", async () => {
    const { db } = makeFakeDb();
    expect(await getFlushCursor(db)).toBe(42);
  });

  it("advances monotonically with GREATEST (never moves backwards)", async () => {
    const { db, calls } = makeFakeDb();
    await setFlushCursor(db, 1_700_000_000_000);
    expect(calls[0].sql).toContain("GREATEST(event_flush_cursor.last_event_at, EXCLUDED.last_event_at)");
  });

  it("truncates fractional timestamps", async () => {
    const { db, calls } = makeFakeDb();
    await setFlushCursor(db, 1_700_000_000_000.999);
    expect(calls[0].params[0]).toBe(1_700_000_000_000);
  });
});
