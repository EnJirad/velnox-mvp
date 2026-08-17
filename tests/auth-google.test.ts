/**
 * Velnox — Google OAuth sign-in tests (production auth rebuild).
 *
 * Covers the pure, unit-testable surfaces of the Google-first login:
 *   - buildGoogleRedirectTo — the absolute `redirectTo` sent to Convex Auth
 *     so the OAuth callback returns the browser to the SAME frontend origin.
 *   - classifyGoogleError — safe, user-facing error kinds (never internals).
 *   - cancellation detection (GOOGLE_AUTH_START marker) helpers.
 *   - convex/auth_redirect.ts — the backend post-OAuth redirect allowlist
 *     (multi-frontend: shop/seller/center/corporate + local dev).
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
    expect(buildGoogleRedirectTo("https://shop.velnox.com", null)).toBe(
      "https://shop.velnox.com/auth",
    );
  });

  it("keeps a safe relative returnTo as a query param", () => {
    expect(buildGoogleRedirectTo("https://shop.velnox.com", "/checkout")).toBe(
      "https://shop.velnox.com/auth?returnTo=%2Fcheckout",
    );
  });

  it("drops returnTo values that are not safe relative paths (open-redirect guard)", () => {
    expect(buildGoogleRedirectTo("https://shop.velnox.com", "https://evil.example")).toBe(
      "https://shop.velnox.com/auth",
    );
    expect(buildGoogleRedirectTo("https://shop.velnox.com", "//evil.example")).toBe(
      "https://shop.velnox.com/auth",
    );
    expect(buildGoogleRedirectTo("https://shop.velnox.com", "")).toBe(
      "https://shop.velnox.com/auth",
    );
    expect(buildGoogleRedirectTo("https://shop.velnox.com", undefined)).toBe(
      "https://shop.velnox.com/auth",
    );
  });

  it("handles an origin with a trailing slash", () => {
    expect(buildGoogleRedirectTo("https://seller.velnox.com/", "/seller/goals")).toBe(
      "https://seller.velnox.com/auth?returnTo=%2Fseller%2Fgoals",
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
  it("defaults to the four platform origins plus local dev", () => {
    expect(allowedOAuthOrigins({})).toEqual([...DEFAULT_OAUTH_ORIGINS]);
  });

  it("uses AUTH_ALLOWED_ORIGINS (JSON array) when provided", () => {
    const env = { AUTH_ALLOWED_ORIGINS: '["https://shop.velnox.com","https://preview.example.com"]' };
    expect(allowedOAuthOrigins(env)).toEqual([
      "https://shop.velnox.com",
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
      resolveOAuthRedirect("https://shop.velnox.com/auth?returnTo=%2Fcheckout", {}),
    ).toBe("https://shop.velnox.com/auth?returnTo=%2Fcheckout");
  });

  it("resolves a relative path against SITE_URL", () => {
    expect(resolveOAuthRedirect("/seller/goals", { SITE_URL: "https://seller.velnox.com" })).toBe(
      "https://seller.velnox.com/seller/goals",
    );
  });

  it("falls back to /auth for unknown origins (open-redirect guard)", () => {
    expect(resolveOAuthRedirect("https://evil.example/phish", {})).toBe(
      "https://shop.velnox.com/auth",
    );
  });

  it("falls back to /auth for malformed destinations", () => {
    expect(resolveOAuthRedirect("not a url", {})).toBe("https://shop.velnox.com/auth");
    expect(resolveOAuthRedirect(undefined, {})).toBe("https://shop.velnox.com/auth");
    expect(resolveOAuthRedirect("", {})).toBe("https://shop.velnox.com/auth");
  });

  it("respects AUTH_ALLOWED_ORIGINS when set", () => {
    const env = { AUTH_ALLOWED_ORIGINS: '["https://preview.example.com"]' };
    expect(resolveOAuthRedirect("https://preview.example.com/auth", env)).toBe(
      "https://preview.example.com/auth",
    );
    // The production domains are NOT in the override list → the destination
    // is forced to the safe fallback auth page (on the shop origin).
    expect(resolveOAuthRedirect("https://shop.velnox.com/dashboard", env)).toBe(
      "https://shop.velnox.com/auth",
    );
  });
});
