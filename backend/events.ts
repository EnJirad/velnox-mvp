/**
 * Velnox Backend — Durable behavioral event store (Neon).
 *
 * Append-only. Receives behavioral events (product views, searches, cart
 * actions, purchases, ...) flushed from the Convex realtime layer so that
 * intelligence history survives a Convex outage (architecture §11, §64).
 *
 * The Convex `customerEvents` table stays the fast realtime store; this table
 * is the durable, rebuildable copy. `event_flush_cursor` records how far the
 * Convex → Neon flush has advanced so the cron only rescans recent events.
 *
 * Only ever used from server-side code (Convex node actions + db scripts).
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- JSONB payloads */
import type { Db } from "./db";

export interface BehavioralEventInput {
  /** source row id (Convex customerEvents _id) — dedupe key with `source` */
  sourceEventId: string;
  userId?: string | null;
  anonymousId?: string | null;
  type: string;
  entityId?: string | null;
  value?: string | null;
  context?: Record<string, unknown> | null;
  /** epoch ms when the event occurred */
  occurredAt: number;
}

/**
 * Insert a batch of behavioral events idempotently (ON CONFLICT DO NOTHING).
 * Safe to re-run: the unique (source, source_event_id) constraint drops
 * duplicates, which is what makes the cron flush retry-safe.
 * Returns the number of rows actually inserted.
 */
export async function insertBehavioralEvents(
  db: Db,
  events: BehavioralEventInput[],
  source = "convex_customer_events",
): Promise<number> {
  if (events.length === 0) return 0;
  let inserted = 0;
  // batches of 200 keep parameter limits well inside Postgres' 65535 cap
  for (let i = 0; i < events.length; i += 200) {
    const batch = events.slice(i, i + 200);
    const values: unknown[] = [];
    const rows: string[] = [];
    for (const e of batch) {
      const n = values.length;
      rows.push(
        `($${n + 1}, $${n + 2}, $${n + 3}, $${n + 4}, $${n + 5}, $${n + 6}, $${n + 7}, $${n + 8}, $${n + 9})`,
      );
      values.push(
        source,
        e.sourceEventId,
        e.userId ?? null,
        e.anonymousId ?? null,
        e.type,
        e.entityId ?? null,
        e.value ?? null,
        e.context ? JSON.stringify(e.context) : null,
        new Date(e.occurredAt).toISOString(),
      );
    }
    const res = await db(
      `INSERT INTO behavioral_events
         (source, source_event_id, user_id, anonymous_id, event_type, entity_id, value, context, occurred_at)
       VALUES ${rows.join(", ")}
       ON CONFLICT (source, source_event_id) DO NOTHING
       RETURNING id`,
      values,
    );
    inserted += res.length;
  }
  return inserted;
}

/** How far the Convex → Neon flush has advanced (epoch ms). */
export async function getFlushCursor(db: Db): Promise<number> {
  const rows = await db(
    "SELECT last_event_at FROM event_flush_cursor WHERE id = 1",
  );
  return rows[0] ? Number(rows[0].last_event_at) : 0;
}

/** Advance the flush cursor (monotonic — only ever moves forward). */
export async function setFlushCursor(db: Db, lastEventAt: number): Promise<void> {
  await db(
    `INSERT INTO event_flush_cursor (id, last_event_at, updated_at)
     VALUES (1, $1, now())
     ON CONFLICT (id) DO UPDATE SET last_event_at = GREATEST(event_flush_cursor.last_event_at, EXCLUDED.last_event_at), updated_at = now()`,
    [Math.trunc(lastEventAt)],
  );
}

/** Event counts by type over the last N days (center analytics / rebuild check). */
export async function countBehavioralEvents(
  db: Db,
  sinceDays = 30,
): Promise<{ type: string; count: number }[]> {
  const rows = await db(
    `SELECT event_type AS type, COUNT(*)::int AS count
       FROM behavioral_events
      WHERE occurred_at >= now() - make_interval(days => $1)
      GROUP BY event_type
      ORDER BY count DESC`,
    [sinceDays],
  );
  return rows.map((r) => ({ type: r.type, count: Number(r.count) }));
}

/** Durable events for one user (identity-scoped reads only — “ของใคร ของมัน”). */
export async function listBehavioralEventsForUser(
  db: Db,
  userId: string,
  limit = 100,
): Promise<any[]> {
  const rows = await db(
    `SELECT source_event_id, event_type, entity_id, value, context, occurred_at
       FROM behavioral_events
      WHERE user_id = $1
      ORDER BY occurred_at DESC
      LIMIT $2`,
    [userId, limit],
  );
  return rows;
}
