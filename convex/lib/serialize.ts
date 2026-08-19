/**
 * Velnox — Central Convex-boundary serializer (spec "systemic Date fix").
 *
 * WHY THIS EXISTS
 *   Neon/PostgreSQL rows come back from the pg driver with `timestamptz`
 *   columns as JS `Date` objects. Convex rejects `Date` in returned values
 *   ("Date ... is not a supported Convex type"), which made every VelSeller /
 *   VelCenter action that returns Neon data fail at the boundary.
 *
 *   The DB layer keeps `Date` (backend code relies on it: `instanceof Date`,
 *   `new Date(...)`, `.toISOString()`). The CONVEX BOUNDARY converts:
 *     Date → Unix timestamp milliseconds (number)
 *   recursively, preserving arrays, nested objects, null, undefined, strings,
 *   numbers and booleans. Nothing is stringified wholesale, no field is
 *   dropped, no JSON round-trip.
 *
 *   `serializedAction` is a drop-in replacement for the generated `action`
 *   builder: it runs the handler, passes the result through serializeForConvex
 *   and registers the wrapped handler. The public type is exactly the Convex
 *   `action` builder, so args/returns inference (and the generated api types)
 *   are unchanged — the cast below is the single, documented seam.
 */
import { action as rawAction } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";

// ---------------------------------------------------------------------------
// serializer
// ---------------------------------------------------------------------------

export type Serialized<T> = T extends Date
  ? number
  : T extends readonly (infer U)[]
    ? Serialized<U>[]
    : T extends object
      ? { [K in keyof T]: Serialized<T[K]> }
      : T;

/**
 * Recursively convert a value into a Convex-safe representation:
 *   - Date        → number (Unix ms via getTime())
 *   - arrays      → mapped element-wise
 *   - plain objects → mapped key-wise (undefined values → null; Convex has no
 *     `undefined` in returned values)
 *   - everything else (string/number/boolean/null/bigint) → passed through
 * Convex `Id` values are branded strings and pass through untouched.
 */
export function serializeForConvex<T>(value: T): Serialized<T> {
  if (value instanceof Date) return value.getTime() as Serialized<T>;
  if (Array.isArray(value)) {
    return value.map((item) => serializeForConvex(item)) as Serialized<T>;
  }
  if (value !== null && typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    // Only plain objects are walked. Class instances (e.g. Convex Id, Buffer)
    // are returned as-is — they are either already Convex-safe or not meant
    // to cross the boundary.
    if (proto !== Object.prototype && proto !== null) return value as Serialized<T>;
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = item === undefined ? null : serializeForConvex(item);
    }
    return out as Serialized<T>;
  }
  return value as Serialized<T>;
}

// ---------------------------------------------------------------------------
// serialized action builder (drop-in replacement for `action`)
// ---------------------------------------------------------------------------

/**
 * Convex `action` that serializes every return value at the boundary.
 *
 * Type note: `typeof rawAction` is the Convex `ActionBuilder` generic call
 * signature; it cannot be reconstructed without a cast. Casting the wrapper to
 * `typeof rawAction` keeps every call site and the generated `api` types
 * identical to before — the cast is the one place that acknowledges the
 * builder's shape.
 */
export const serializedAction: typeof rawAction = ((
  func: Parameters<typeof rawAction>[0],
) => {
  const { handler, ...rest } = func as { handler: (ctx: ActionCtx, args: never) => unknown; [k: string]: unknown };
  return rawAction({
    ...rest,
    handler: async (ctx: ActionCtx, args: never) =>
      serializeForConvex(await (handler as (ctx: ActionCtx, args: never) => Promise<unknown>)(ctx, args)),
  });
}) as typeof rawAction;
