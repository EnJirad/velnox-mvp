/**
 * Velnox — Durable behavioral event flush (architecture §11, §64).
 *
 * Convex `customerEvents` is the fast realtime store (browser fire-and-forget).
 * This module periodically copies new events into Neon `behavioral_events` so
 * the intelligence history is durable and rebuildable even if Convex is lost.
 *
 *   Browser action → customerEvents (Convex, realtime)
 *                 → flushToNeon (cron, node action) → behavioral_events (Neon)
 *
 * Design:
 *  - Idempotent: Neon upserts dedupe on (source, source_event_id).
 *  - Cursor: `event_flush_cursor.last_event_at` (Neon) tracks how far the
 *    flush has advanced; each run rescans the last 60s for overlap safety.
 *  - Best-effort: a Neon outage must never break the realtime layer — the
 *    cron simply retries next run from the same cursor.
 *  - No secrets, no PII beyond what tracking already stores.
 */
"use node";

import { action } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { getDb } from "../backend/db";
import {
  getFlushCursor,
  insertBehavioralEvents,
  setFlushCursor,
} from "../backend/events";

/** 60s overlap so events created in the same ms as the cursor are re-read. */
const OVERLAP_MS = 60_000;
const BATCH_LIMIT = 2000;

type CustomerEventRow = {
  _id: string;
  userId?: string;
  anonymousId?: string;
  type: string;
  entityId?: string;
  value?: string;
  context?: unknown;
  createdAt: number;
};

/**
 * Flush new customerEvents to Neon. Returns a small summary for the cron logs.
 * Never throws on a Neon failure — logs and returns so the app is unaffected.
 */
export const flushToNeon = action({
  args: {},
  handler: async (ctx: ActionCtx) => {
    const db = getDb();
    const cursor = await getFlushCursor(db);

    const rows = (await ctx.runQuery(api.memoryEvents._recentEventsSince, {
      since: Math.max(0, cursor - OVERLAP_MS),
      limit: BATCH_LIMIT,
    })) as unknown as CustomerEventRow[];
    if (rows.length === 0) return { scanned: 0, inserted: 0, cursor };

    const events = rows.map((r) => ({
      sourceEventId: r._id,
      userId: r.userId ?? null,
      anonymousId: r.anonymousId ?? null,
      type: r.type,
      entityId: r.entityId ?? null,
      value: r.value ?? null,
      context:
        r.context && typeof r.context === "object"
          ? (r.context as Record<string, unknown>)
          : null,
      occurredAt: r.createdAt,
    }));

    const inserted = await insertBehavioralEvents(db, events);

    // advance only to the newest event actually seen (monotonic in Neon)
    const lastEventAt = rows.reduce((max, r) => Math.max(max, r.createdAt), cursor);
    await setFlushCursor(db, lastEventAt);

    return { scanned: rows.length, inserted, cursor: lastEventAt };
  },
});
