/**
 * Velnox Backend — timestamp conversion helper.
 *
 * The pg driver returns `timestamptz` columns as JS `Date` objects. Inside the
 * backend layer that is fine, but the Convex boundary serializes every value
 * returned by an action, and Convex rejects `Date` ("Date ... is not a
 * supported Convex type"). The backend API contract therefore exposes
 * timestamps as Unix milliseconds (number) — `toMs` converts at the row
 * mappers, and `convex/lib/serialize.ts` remains the safety net for any value
 * that still carries a `Date` at the boundary.
 */
export function toMs(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === "number") return value;
  return 0;
}
