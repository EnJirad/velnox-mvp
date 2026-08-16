/**
 * Velnox — Convex scheduled jobs.
 *
 * flush behavioral events to Neon: every 15 minutes, copy new `customerEvents`
 * into the durable Neon `behavioral_events` store (architecture §11, §64).
 * The action is idempotent and cursor-advanced, so retries and overlapping
 * runs are safe.
 */
import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "flush behavioral events to Neon",
  { minutes: 15 },
  api.behavioralEvents.flushToNeon,
);

export default crons;
