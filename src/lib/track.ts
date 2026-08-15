/**
 * Velnox — client-side Customer Memory tracking (docs/Velnox-CPNS.md).
 *
 * “ทุก Interaction คือข้อมูล” — a tiny fire-and-forget wrapper around the
 * `api.memoryEvents.track` mutation. Signed-in users are attributed
 * server-side via their Convex session; signed-out visitors get a random
 * anonymousId that is kept in localStorage (never any PII) so their browsing
 * can still power marketplace popularity.
 *
 * Tracking must never break the shopper's flow: every call is fire-and-forget.
 */
import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { useCallback, useMemo } from "react";

/** Keep in sync with src/convex/memoryEvents.ts EVENT_TYPES. */
export type CustomerEventType =
  | "PRODUCT_VIEW"
  | "PRODUCT_CLICK"
  | "SEARCH"
  | "CATEGORY_VIEW"
  | "SHOP_VIEW"
  | "INTEREST"
  | "WISHLIST_ADD"
  | "WISHLIST_REMOVE"
  | "CART_ADD"
  | "CART_REMOVE"
  | "CHECKOUT_START"
  | "PURCHASE"
  | "REORDER"
  | "VELREPEAT_START";

const ANON_KEY = "velnox_anon_id";

export function getAnonymousId(): string {
  try {
    let id = window.localStorage.getItem(ANON_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

export interface TrackOptions {
  entityId?: string;
  value?: string;
  context?: Record<string, unknown>;
}

export interface Tracking {
  track: (type: CustomerEventType, options?: TrackOptions) => void;
}

/**
 * Hook returning a stable `track` function. Call it from anywhere in the shop;
 * the Convex mutation resolves the authenticated identity itself.
 */
export function useTracking(): Tracking {
  const trackMutation = useMutation(api.memoryEvents.track);
  const anonymousId = useMemo(() => getAnonymousId(), []);

  const track = useCallback(
    (type: CustomerEventType, options?: TrackOptions) => {
      trackMutation({
        type,
        entityId: options?.entityId,
        value: options?.value,
        context: options?.context,
        anonymousId,
      }).catch(() => {
        // fire-and-forget — tracking failures are invisible to the shopper
      });
    },
    [trackMutation, anonymousId],
  );

  return useMemo(() => ({ track }), [track]);
}
