/**
 * Velnox — OAuth post-sign-in redirect policy (pure, unit-testable).
 *
 * Velnox runs THREE production frontends (velshop.vercel.app ·
 * velseller.vercel.app · velcenter.vercel.app) against ONE Convex deployment.
 * Convex Auth's default redirect callback only allows URLs under the single
 * `SITE_URL` env var — not enough for a multi-domain platform. This module
 * implements the allowlist used by `callbacks.redirect` in convex/auth.ts:
 * after Google OAuth completes, the browser is only ever sent back to an
 * origin listed here (or to the safe /auth fallback).
 *
 * Security contract:
 *  - Only http(s) origins in the allowlist are accepted — nothing else.
 *  - Relative `redirectTo` values resolve against SITE_URL (or the shop
 *    fallback) so a relative path can never escape the allowlist.
 *  - Malformed or unknown destinations fall back to the auth page instead of
 *    erroring — the OAuth session itself is created regardless, and the app's
 *    own role-based redirect takes over after the frontend sees the session.
 */
export const DEFAULT_OAUTH_ORIGINS: readonly string[] = [
  // Current production frontends (Vercel). Custom domains (velnox.com,
  // shop/seller/center.velnox.com) will replace these once they are set up —
  // add them to this list or to AUTH_ALLOWED_ORIGINS at that time.
  "https://velshop.vercel.app",
  "https://velseller.vercel.app",
  "https://velcenter.vercel.app",
  // Local development (Vite dev servers + preview)
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:4173",
];

/** Fallback origin when SITE_URL is not configured (must be an allowlisted origin). */
export const OAUTH_FALLBACK_ORIGIN = "https://velshop.vercel.app";

/** Path of the auth page used as the safe fallback destination. */
export const OAUTH_FALLBACK_PATH = "/auth";

/**
 * Origins the OAuth callback may send the browser back to. Defaults to the
 * three production frontends plus local dev servers. Deployments can override
 * with the `AUTH_ALLOWED_ORIGINS` Convex env var — a JSON array of origins,
 * e.g. '["https://velshop.vercel.app","https://preview.example.com"]'.
 * The env var REPLACES the defaults (it is the explicit production list).
 */
export function allowedOAuthOrigins(
  env: Record<string, string | undefined>,
): string[] {
  const raw = env.AUTH_ALLOWED_ORIGINS;
  if (raw !== undefined && raw !== "") {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const origins = parsed
          .map((value) => String(value).trim().replace(/\/+$/, ""))
          .filter((origin) => /^https?:\/\/.+/.test(origin));
        if (origins.length > 0) return origins;
      }
    } catch {
      // Malformed env — fall through to the built-in defaults.
    }
  }
  return [...DEFAULT_OAUTH_ORIGINS];
}

/**
 * Resolve the destination after a successful Google OAuth callback.
 *
 * @param redirectTo what the frontend passed to signIn("google", ...) — an
 *   absolute URL (recommended, so the browser returns to the same frontend
 *   origin) or a relative path.
 * @param env the server environment (process.env on the Convex runtime).
 */
export function resolveOAuthRedirect(
  redirectTo: string | undefined,
  env: Record<string, string | undefined>,
): string {
  const fallbackOrigin = (env.SITE_URL ?? OAUTH_FALLBACK_ORIGIN).replace(/\/+$/, "");
  const origins = allowedOAuthOrigins(env);

  if (typeof redirectTo === "string") {
    const trimmed = redirectTo.trim();
    // Only accept a relative path or an explicit http(s) URL. Anything else
    // ("not a url", "javascript:...", etc.) is malformed — `new URL` would
    // silently resolve such strings as a relative path, which is not a
    // destination we should send the browser to.
    const isRelativePath = trimmed.startsWith("/");
    const isHttpUrl = /^https?:\/\//i.test(trimmed);
    if (trimmed !== "" && (isRelativePath || isHttpUrl)) {
      try {
        const resolved = new URL(trimmed, `${fallbackOrigin}/`);
        if (origins.includes(resolved.origin)) {
          return resolved.toString();
        }
      } catch {
        // Malformed destination — fall through to the safe fallback.
      }
    }
  }
  return `${fallbackOrigin}${OAUTH_FALLBACK_PATH}`;
}
