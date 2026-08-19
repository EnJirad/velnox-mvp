/**
 * Velnox — Convex scheduled jobs.
 *
 * Phase 1 additions:
 *   - Signal computation: after Convex codegen, enable the brain cron
 *     that computes customer signals every 30 minutes.
 *
 * NOTE: The `api.brain.computeSignalsBatch` cron is temporarily commented out
 * until Convex codegen runs and registers the new brain module. Enable it
 * after running `bun convex dev --once`.
 */
import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

// ---------------------------------------------------------------------------
// Event flush (existing)
// ---------------------------------------------------------------------------
// flush behavioral events to Neon: every 15 minutes, copy new `customerEvents`
// into the durable Neon `behavioral_events` store (architecture §11, §64).
crons.interval(
  "flush behavioral events to Neon",
  { minutes: 15 },
  api.memory.flushToNeon,
);

// ---------------------------------------------------------------------------
// VelRepeat (existing)
// ---------------------------------------------------------------------------
// every 6 hours, turn every ACTIVE subscription whose next_order_date has
// arrived into a real order (idempotent per subscription + due date).
crons.interval(
  "process due VelRepeat subscriptions",
  { hours: 6 },
  api.commerce.processAllDueSubscriptions,
);

// ---------------------------------------------------------------------------
// Signal computation (Phase 1: Brain Foundation)
// ---------------------------------------------------------------------------
// Every 30 minutes, compute customer signals for users with new events.
// Requires: Convex codegen (`bun convex dev --once`) to register the brain module,
// and the customer_signals table (migration 012) in Neon.
crons.interval(
  "compute customer signals",
  { minutes: 30 },
  api.brain.computeSignalsBatch,
);

export default crons;
