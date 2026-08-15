/**
 * Velnox — error monitoring (spec §46–47).
 *
 * Wraps Sentry so the app runs perfectly without it: when VITE_SENTRY_DSN is
 * not configured, every call is a no-op and the bundle overhead is skipped.
 * Configure by adding VITE_SENTRY_DSN to the project Keys/API keys UI.
 */
import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

export const isMonitoringEnabled = Boolean(dsn);

/** Call once per app entry (before render). Safe to call multiple times. */
export function initMonitoring(): void {
  if (!dsn || window.__VELNOX_SENTRY_INIT__) return;
  window.__VELNOX_SENTRY_INIT__ = true;
  Sentry.init({
    dsn,
    environment: import.meta.env.PROD ? "production" : "development",
    tracesSampleRate: 0.1,
    // never send PII from the browser; the Convex side tracks user id via tags
    sendDefaultPii: false,
  });
}

/** Report an unexpected error (used by RootErrorBoundary). No-op without DSN. */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (!dsn) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

declare global {
  interface Window {
    __VELNOX_SENTRY_INIT__?: boolean;
  }
}
