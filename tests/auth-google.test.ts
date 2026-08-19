/**
 * Velnox — Google OAuth sign-in tests (production auth rebuild).
 *
 * Covers the pure, unit-testable surfaces of the Google-first login:
 *   - buildGoogleRedirectTo — the absolute `redirectTo` sent to Convex Auth
 *     so the OAuth callback returns the browser to the SAME frontend origin.
 *   - classifyGoogleError — safe, user-facing error kinds (never internals).
 *   - cancellation detection (GOOGLE_AUTH_START marker) helpers.
 *   - convex/auth_redirect.ts — the backend post-OAuth redirect allowlist
 *     (multi-frontend: velshop/velseller/velcenter.vercel.app + local dev).
 *
 * The real OAuth exchange (Google → Convex callback → session) is exercised
 * end-to-end only in the browser; these tests lock the deterministic logic.
 */
import { describe, expect, it } from "vitest";
import {
  GOOGLE_AUTH_START_MAX_AGE_MS,
  buildGoogleRedirectTo,
  classifyGoogleError,
  hasPendingOAuthCode,
  recentGoogleAuthStart,
} from "../packages/shared/src/lib/auth-flow";
import {
  DEFAULT_OAUTH_ORIGINS,
  allowedOAuthOrigins,
  resolveOAuthRedirect,
} from "../convex/auth_redirect";

// ---------------------------------------------------------------------------
// buildGoogleRedirectTo
// ---------------------------------------------------------------------------

describe("buildGoogleRedirectTo", () => {
  it("returns the auth page on the given origin", () => {
    expect(buildGoogleRedirectTo("https://velshop.vercel.app", null)).toBe(
      "https://velshop.vercel.app/auth",
    );
  });

  it("keeps a safe relative returnTo as a query param", () => {
    expect(buildGoogleRedirectTo("https://velshop.vercel.app", "/checkout")).toBe(
      "https://velshop.vercel.app/auth?returnTo=%2Fcheckout",
    );
  });

  it("drops returnTo values that are not safe relative paths (open-redirect guard)", () => {
    expect(buildGoogleRedirectTo("https://velshop.vercel.app", "https://evil.example")).toBe(
      "https://velshop.vercel.app/auth",
    );
    expect(buildGoogleRedirectTo("https://velshop.vercel.app", "//evil.example")).toBe(
      "https://velshop.vercel.app/auth",
    );
    expect(buildGoogleRedirectTo("https://velshop.vercel.app", "")).toBe(
      "https://velshop.vercel.app/auth",
    );
    expect(buildGoogleRedirectTo("https://velshop.vercel.app", undefined)).toBe(
      "https://velshop.vercel.app/auth",
    );
  });

  it("handles an origin with a trailing slash", () => {
    expect(buildGoogleRedirectTo("https://velseller.vercel.app/", "/seller/goals")).toBe(
      "https://velseller.vercel.app/auth?returnTo=%2Fseller%2Fgoals",
    );
  });
});

// ---------------------------------------------------------------------------
// classifyGoogleError
// ---------------------------------------------------------------------------

describe("classifyGoogleError", () => {
  it("maps transport failures to the network kind", () => {
    expect(classifyGoogleError(new Error("Failed to fetch"))).toBe("network");
    expect(classifyGoogleError(new Error("NetworkError when attempting to fetch resource."))).toBe(
      "network",
    );
    expect(classifyGoogleError(undefined)).toBe("network");
  });

  it("maps cancellation signals to the cancelled kind", () => {
    expect(classifyGoogleError(new Error("OAuth sign-in cancelled"))).toBe("cancelled");
  });

  it("keeps unknown errors generic — never leaks internals", () => {
    expect(classifyGoogleError(new Error("Unexpected server response"))).toBe("generic");
    expect(classifyGoogleError("some string")).toBe("generic");
  });
});

// ---------------------------------------------------------------------------
// cancellation marker helpers
// ---------------------------------------------------------------------------

describe("Google flow cancellation marker", () => {
  it("ignores a missing marker", () => {
    expect(recentGoogleAuthStart(null, Date.now())).toBeNull();
  });

  it("reports a recent marker (returns its timestamp)", () => {
    const now = Date.now();
    expect(recentGoogleAuthStart(String(now - 1000), now)).toBe(now - 1000);
  });

  it("ignores stale markers (tab closed mid-flow, reopened later)", () => {
    const now = Date.now();
    expect(
      recentGoogleAuthStart(String(now - GOOGLE_AUTH_START_MAX_AGE_MS - 1), now),
    ).toBeNull();
  });

  it("ignores malformed markers", () => {
    expect(recentGoogleAuthStart("not-a-number", Date.now())).toBeNull();
    expect(recentGoogleAuthStart("", Date.now())).toBeNull();
  });

  it("detects an in-flight OAuth code in the URL", () => {
    expect(hasPendingOAuthCode("?code=12345678")).toBe(true);
    expect(hasPendingOAuthCode("?returnTo=%2Fcheckout&code=12345678")).toBe(true);
    expect(hasPendingOAuthCode("?returnTo=%2Fcheckout")).toBe(false);
    expect(hasPendingOAuthCode("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// backend redirect policy (convex/auth_redirect.ts)
// ---------------------------------------------------------------------------

describe("allowedOAuthOrigins", () => {
  it("defaults to the three production frontends plus local dev", () => {
    expect(allowedOAuthOrigins({})).toEqual([...DEFAULT_OAUTH_ORIGINS]);
  });

  it("uses AUTH_ALLOWED_ORIGINS (JSON array) when provided", () => {
    const env = { AUTH_ALLOWED_ORIGINS: '["https://velshop.vercel.app","https://preview.example.com"]' };
    expect(allowedOAuthOrigins(env)).toEqual([
      "https://velshop.vercel.app",
      "https://preview.example.com",
    ]);
  });

  it("ignores malformed or empty AUTH_ALLOWED_ORIGINS", () => {
    expect(allowedOAuthOrigins({ AUTH_ALLOWED_ORIGINS: "not json" })).toEqual([
      ...DEFAULT_OAUTH_ORIGINS,
    ]);
    expect(allowedOAuthOrigins({ AUTH_ALLOWED_ORIGINS: "[]" })).toEqual([...DEFAULT_OAUTH_ORIGINS]);
  });

  it("filters out non-http values from the env list", () => {
    const env = { AUTH_ALLOWED_ORIGINS: '["https://ok.example","javascript:alert(1)","ftp://x"]' };
    expect(allowedOAuthOrigins(env)).toEqual(["https://ok.example"]);
  });
});

describe("resolveOAuthRedirect", () => {
  it("returns an allowlisted absolute destination as-is", () => {
    expect(
      resolveOAuthRedirect("https://velshop.vercel.app/auth?returnTo=%2Fcheckout", {}),
    ).toBe("https://velshop.vercel.app/auth?returnTo=%2Fcheckout");
  });

  it("accepts every production frontend origin", () => {
    expect(resolveOAuthRedirect("https://velseller.vercel.app/auth?returnTo=%2Fseller%2Fgoals", {})).toBe(
      "https://velseller.vercel.app/auth?returnTo=%2Fseller%2Fgoals",
    );
    expect(resolveOAuthRedirect("https://velcenter.vercel.app/auth", {})).toBe(
      "https://velcenter.vercel.app/auth",
    );
  });

  it("resolves a relative path against SITE_URL", () => {
    expect(resolveOAuthRedirect("/seller/goals", { SITE_URL: "https://velseller.vercel.app" })).toBe(
      "https://velseller.vercel.app/seller/goals",
    );
  });

  it("falls back to /auth for unknown origins (open-redirect guard)", () => {
    expect(resolveOAuthRedirect("https://evil.example/phish", {})).toBe(
      "https://velshop.vercel.app/auth",
    );
    // The old custom-domain origins are no longer allowlisted by default.
    expect(resolveOAuthRedirect("https://shop.velnox.com/dashboard", {})).toBe(
      "https://velshop.vercel.app/auth",
    );
  });

  it("falls back to /auth for malformed destinations", () => {
    expect(resolveOAuthRedirect("not a url", {})).toBe("https://velshop.vercel.app/auth");
    expect(resolveOAuthRedirect(undefined, {})).toBe("https://velshop.vercel.app/auth");
    expect(resolveOAuthRedirect("", {})).toBe("https://velshop.vercel.app/auth");
  });

  it("respects AUTH_ALLOWED_ORIGINS when set", () => {
    const env = { AUTH_ALLOWED_ORIGINS: '["https://preview.example.com"]' };
    expect(resolveOAuthRedirect("https://preview.example.com/auth", env)).toBe(
      "https://preview.example.com/auth",
    );
    // Origins NOT in the override list are forced to the safe fallback auth
    // page (on the shop origin).
    expect(resolveOAuthRedirect("https://velshop.vercel.app/dashboard", env)).toBe(
      "https://velshop.vercel.app/auth",
    );
  });
});
