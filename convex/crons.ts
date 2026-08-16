/**
 * Velnox — Convex scheduled jobs.
 *
 * flush behavioral events to Neon: every 15 minutes, copy new `customerEvents`
 * into the durable Neon `behavioral_events` store (architecture §11, §64).
 * The action (`api.memory.flushToNeon`) is idempotent and cursor-advanced, so
 * retries and overlapping runs are safe.
 */
import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "flush behavioral events to Neon",
  { minutes: 15 },
  api.memory.flushToNeon,
);

// VelRepeat (spec §19, §47): every 6 hours, turn every ACTIVE subscription
// whose next_order_date has arrived into a real order (idempotent per
// subscription + due date, so overlapping runs cannot duplicate). Runs
// without a user context; the action rejects any signed-in caller and is
// globally rate-limited (1 run / 6h window), so only the scheduler can drive
// it and overlapping runs are safe.
crons.interval(
  "process due VelRepeat subscriptions",
  { hours: 6 },
  api.commerce.processAllDueSubscriptions,
);

export default crons;
