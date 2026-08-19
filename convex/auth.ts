// Velnox auth providers — Convex Auth (the project's authentication layer).
//
// THIS FILE IS READ ONLY. Do not touch this file unless you are correctly
// adding a new auth provider in accordance to the vly auth documentation.
//
// Provider state (2026-08):
//   - Google OAuth (ON): primary sign-in for customers, sellers and company
//     staff. Real Google Account Chooser flow via Convex Auth OAuth support
//     (provider from @auth/core, which @convex-dev/auth is built on). Client
//     ID/secret are SERVER-SIDE Convex env vars only:
//       GOOGLE_CLIENT_ID · GOOGLE_CLIENT_SECRET
//     The OAuth callback lives at CONVEX_SITE_URL/api/auth/callback/google.
//     After the callback, the browser returns to the frontend origin that
//     started the flow (allowlist in ./auth-redirect via callbacks.redirect).
//   - Email OTP (OFF by default): backend implementation kept for the future,
//     gated behind the EMAIL_OTP_ENABLED Convex env var ("true" to enable).
//     The UI no longer offers email/OTP sign-in.
//   - Password (registered, not exposed in UI): backs the existing
//     employeeAuth flows (velcenter staff accounts created/reset by the
//     company owner) — the Convex Auth Password provider must stay registered
//     for createAccount/modifyAccountCredentials to work. No password form is
//     rendered anywhere in the UI.
//   - Anonymous (ON): guest browsing (Velnox customer memory relies on the
//     anonymous identity, merged into the account on sign-in).

import { convexAuth } from "@convex-dev/auth/server";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { Password } from "@convex-dev/auth/providers/Password";
import Google from "@auth/core/providers/google";
import { emailOtp } from "./auth/emailOtp";
import { resolveOAuthRedirect } from "./auth_redirect";

// Google OAuth — client ID is public by design; the SECRET must only ever
// live in the Convex deployment env (Keys/API keys UI), never in VITE_* or
// in source. Explicit options win over the AUTH_GOOGLE_ID/SECRET fallback
// that @auth/core would otherwise read, so the required env contract is
// GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.
const googleProvider = Google({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
});

// Email OTP feature flag — default OFF (Google OAuth is the primary flow).
const emailOtpEnabled = process.env.EMAIL_OTP_ENABLED === "true";

// Password provider (spec §9–§11): employee accounts for velcenter log in with
// email/employee-id + password. Passwords are stored ONLY as scrypt hashes by
// the auth library (Lucia) — never plaintext, never reversible, and the
// company can never view an existing password. HR only ever sees a one-time
// temporary credential shown at creation/reset time (see convex/employeeAuth.ts).
const passwordProvider = Password({
  id: "password",
  // Server-side minimum: 8 chars with a letter and a digit (same policy as
  // backend/passwords.ts validatePasswordStrength, enforced again at sign-up).
  validatePasswordRequirements(password: string) {
    if (password.length < 8) throw new Error("รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร");
    if (!/[a-zA-Z]/.test(password)) throw new Error("รหัสผ่านต้องมีตัวอักษร");
    if (!/[0-9]/.test(password)) throw new Error("รหัสผ่านต้องมีตัวเลข");
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    googleProvider,
    ...(emailOtpEnabled ? [emailOtp] : []),
    Anonymous,
    passwordProvider,
  ],
  callbacks: {
    // Multi-frontend OAuth return: after Google's callback, Convex Auth
    // redirects the browser to the destination this callback returns. Velnox
    // has 4 frontend origins on 4 domains — the default callback only allows
    // the single SITE_URL, so we validate against the platform allowlist
    // (convex/auth-redirect.ts). Unknown destinations fall back to /auth.
    async redirect({ redirectTo }) {
      return resolveOAuthRedirect(redirectTo, process.env);
    },
  },
});
