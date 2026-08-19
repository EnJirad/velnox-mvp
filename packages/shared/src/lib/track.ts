/**
 * Velnox — client-side Customer Memory tracking (Phase 1: Brain Foundation).
 *
 * "ทุก Interaction คือข้อมูล" — a tiny fire-and-forget wrapper around the
 * `api.memoryEvents.track` mutation. Signed-in users are attributed
 * server-side via their Convex session; signed-out visitors get a random
 * anonymousId that is kept in localStorage (never any PII) so their browsing
 * can still power marketplace popularity.
 *
 * Tracking must never break the shopper's flow: every call is fire-and-forget.
 *
 * Phase 1 additions:
 *   - Complete event vocabulary (28 types)
 *   - Session tracking (start/end)
 *   - Batch event sending
 */
import { api } from "@convex/_generated/api";
import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { useCallback, useEffect, useMemo, useRef } from "react";

/**
 * Complete event vocabulary — keep in sync with convex/memoryEvents.ts
 * and customer-memory-core.ts.
 *
 * The track function accepts `string` for forward-compatibility; validation
 * happens server-side in the mutation.
 */
export type CustomerEventType = string;

const ANON_KEY = "velnox_anon_id";
const SESSION_KEY = "velnox_session_id";

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

function getSessionId(): string {
  try {
    let id = window.localStorage.getItem(SESSION_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(SESSION_KEY, id);
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
  startSession: (device?: string, platform?: string) => void;
  endSession: () => void;
}

/**
 * Hook returning a stable `track` function. Call it from anywhere in the shop;
 * the Convex mutation resolves the authenticated identity itself.
 *
 * Phase 1: also manages session lifecycle.
 */
export function useTracking(): Tracking {
  const trackMutation = useMutation(api.memoryEvents.track);
  const startSessionMutation = useMutation(api.memoryEvents.startSession);
  const endSessionMutation = useMutation(api.memoryEvents.endSession);
  const anonymousId = useMemo(() => getAnonymousId(), []);
  const sessionStarted = useRef(false);

  // Auto-start session on first track call
  const ensureSession = useCallback(() => {
    if (sessionStarted.current) return;
    sessionStarted.current = true;
    startSessionMutation({
      device: typeof navigator !== "undefined" ? navigator.userAgent?.slice(0, 100) : undefined,
      platform: "velshop",
      anonymousId,
    }).catch(() => {
      // fire-and-forget
    });
  }, [startSessionMutation, anonymousId]);

  const track = useCallback(
    (type: CustomerEventType, options?: TrackOptions) => {
      ensureSession();
      trackMutation({
        type,
        entityId: options?.entityId,
        value: options?.value,
        context: options?.context,
        anonymousId,
        sessionId: getSessionId(),
      }).catch(() => {
        // fire-and-forget — tracking failures are invisible to the shopper
      });
    },
    [trackMutation, anonymousId, ensureSession],
  );

  const startSession = useCallback(
    (device?: string, platform?: string) => {
      if (sessionStarted.current) return;
      sessionStarted.current = true;
      startSessionMutation({
        device,
        platform: platform ?? "velshop",
        anonymousId,
      }).catch(() => {});
    },
    [startSessionMutation, anonymousId],
  );

  const endSession = useCallback(() => {
    const sessionId = getSessionId();
    if (!sessionId) return;
    endSessionMutation({ sessionId: sessionId as any }).catch(() => {});
    sessionStarted.current = false;
    try {
      window.localStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
  }, [endSessionMutation]);

  // End session on page unload
  useEffect(() => {
    const handleUnload = () => {
      endSession();
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [endSession]);

  return useMemo(() => ({ track, startSession, endSession }), [track, startSession, endSession]);
}

/**
 * Guest → account identity merge (CPNS §5).
 *
 * Mount inside the ConvexAuthProvider (once per site). When the browser
 * transitions from signed-out to signed-in, this claims the guest's anonymous
 * behavioural history (localStorage anonymousId) for the account so Velnox
 * does not lose what the guest browsed before signing up. Fire-and-forget:
 * a failure here must never block the authenticated experience.
 */
export function IdentityMerge() {
  const { isAuthenticated } = useConvexAuth();
  const merge = useMutation(api.memoryEvents.mergeAnonymousToUser);
  const attempts = useRef(0);

  useEffect(() => {
    if (!isAuthenticated || attempts.current >= 3) return;
    const anonId = getAnonymousId();
    if (!anonId) {
      attempts.current = 3;
      return;
    }
    attempts.current += 1;
    merge({ anonymousId: anonId })
      .then(() => {
        try {
          window.localStorage.removeItem(ANON_KEY); // claim happened — drop the guest id
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        // retried on the next effect run (up to 3 attempts); never throws upward
      });
  }, [isAuthenticated, merge]);

  return null;
}
