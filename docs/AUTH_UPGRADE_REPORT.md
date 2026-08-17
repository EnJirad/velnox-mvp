# Velnox — Production-Grade Authentication / Login UX Upgrade

> Date: 2026-08-17
> Scope: Email OTP 2-step sign-in (password-less for customers), production-grade
> UX for VelShop / VelSeller / VelCenter. No fake UI — every action calls the
> real Convex Auth backend (`auth:signIn`), which sends real OTP emails through
> Resend and creates real sessions.

---

## 1. AUTH FLOW

Customer sign-in is now a strict 2-step Email OTP flow, backed 100% by Convex Auth:

```
Email input
  → normalize (trim + lowercase) + validate
  → signIn("email-otp", { email })          ← real backend action
  → backend rate limit (3 requests / 15 min per address)
  → backend generates 6-digit OTP (crypto.random, 15-min expiry)
  → Resend HTTPS API (masked-recipient logging only)
  → ONLY IF the backend accepts the email → OTP verification screen
  → user enters code → signIn("email-otp", { email, code })
  → Convex Auth verifies (single-use, sha256-hashed, 10 failed attempts/hour)
  → real session created → role-based redirect
```

**Critical rule enforced:** the UI advances to the OTP screen only after
`await signIn(...)` resolves. `sendVerificationRequest` throws on any failure
(rate limit, provider/config error, network), so a failed send NEVER shows the
OTP screen — the user stays on the email step with a clear message.

**Google Sign-in:** NOT shown — the installed `@convex-dev/auth` (0.0.95) ships
no Google/OAuth provider factory (only Email, Password, Phone, Anonymous), and
the spec explicitly allows Google only "ถ้า backend รองรับจริง". Showing a
button whose backend can't complete the flow would be fake UI. Adding Google
requires upgrading `@convex-dev/auth` and setting `GOOGLE_CLIENT_ID` /
`GOOGLE_CLIENT_SECRET` (+ `auth.config.ts` entry) — see Known Limitations.

## 2. OTP DELIVERY

- Provider: `convex/auth/emailOtp.ts` (unchanged — already production-grade).
- OTP: 6 numeric digits from `crypto.getRandomValues`; lifetime 15 minutes
  (`maxAge`), matching the email copy and the client-side expiry mirror.
- Email: branded HTML (inline styles), Thai copy, security warning, sender
  `EMAIL_FROM` — **required**, must be under a verified Resend domain
  (production: `Velnox <no-reply@velnox.com>`). No sandbox fallback: the
  sandbox sender 403s for every recipient except the account owner. If
  `EMAIL_FROM` is unset, the server logs a safe config error and the user
  sees the generic failure message.
- Key: `FREEBUFF_EMAIL_API_KEY` — server-side Convex env var only, never in
  source, never a `VITE_*` var.

## 3. RESEND STATUS

- After a code is issued, the UI shows a **60-second countdown**
  ("ส่งรหัสอีกครั้งใน 60 วินาที") before the resend action is enabled.
- Resend calls the **real backend** (`signIn("email-otp", { email })`) — no fake
  timers, no bypass. The server rate limit still applies to every resend.
- Resend success: countdown restarts, OTP input cleared, attempts reset.
- Resend failure (rate limited / provider / network): friendly message shown,
  user stays on the OTP screen.

## 4. RATE LIMIT

Both production layers remain fully active:

| Layer | Policy | Where |
|---|---|---|
| OTP email requests | 3 per email / 15 min | `emailOtp.ts` → `rateLimit.hitRateLimit` |
| Failed verification | 10 per hour (Convex Auth built-in) | `verifyCodeAndSignIn` |
| Client resend guard | 60s countdown (UX only) | Auth page |

The frontend shows "ส่งรหัสบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่" when the
backend rejects; it never bypasses or disables the limits.

## 5. SESSION

- After a correct code, `auth:signIn` returns tokens and Convex Auth creates a
  real session (refresh token + access token, stored by the auth client).
- Guest (anonymous) sign-in is preserved and links to the account on upgrade
  (`IdentityMerge`).
- Employee (velcenter staff) password sign-in is preserved unchanged.

## 6. ROLE AUTHORIZATION

- Redirect after sign-in is role-aware: customer → VelShop home; seller →
  VelSeller dashboard; owner/admin/staff → VelCenter.
- The frontend redirect is a convenience only — every protected route is gated
  by `RequireRole` and every sensitive backend call re-checks identity +
  permissions server-side. Frontend role is never trusted alone.

## 7. MOBILE UX (app-like)

- OTP slots are large touch targets (`h-14 w-11`, 56×44px) with `inputMode="numeric"`
  for the numeric keyboard; autofocus, paste 6 digits, auto-advance, backspace,
  and auto-submit on the 6th digit all work natively through `input-otp`.
- Full-width buttons ≥ 44px tall (email submit, verify, resend, change email).
- Safe-area padding (`env(safe-area-inset-bottom)`), no horizontal overflow
  (6 slots + gaps ≈ 304px < card width), no floating text.

## 8. DESKTOP UX

- Centered auth card (`max-w-[400px]`), same flow, larger text inputs,
  compact OTP slots (`sm:h-12 sm:w-10`), professional spacing/typography.
- One auth implementation shared by all three apps (`packages/shared/src/pages/Auth.tsx`).

## 9. TEST RESULTS

- New suite `tests/auth-flow.test.ts` (25 assertions across 8 describe blocks):
  email normalization/validation, `maskEmail` (`j***@gmail.com`),
  `isCompleteOtp`, `classifySendError` (rate-limited / send-failed / network /
  generic), `classifyVerifyError` (expired / wrong code / too many attempts /
  network), resend countdown tick, OTP lifetime constant parity with the backend.
- Full suite: **159 pass / 0 fail** (includes locale-key parity across th/en/my).

## 10. BUILD RESULTS

- `bun tsc -b --noEmit` — 0 errors.
- `bun run build` (convex codegen + tsc + shop build) — passed.
- `build:seller`, `build:center`, `build:corporate` — all passed (shared auth
  page compiles into every app).

## 11. DEPLOYMENT RESULTS

- No new Convex deployment was created (per instruction). All three frontends
  keep pointing at the same backend; the platform-managed Convex deployment
  pushes function changes automatically (none were needed — `emailOtp.ts` was
  already production-grade; this upgrade is frontend + tests only).
- Env vars to set on the deployment (via the Keys/API keys UI — never in
  source): `FREEBUFF_EMAIL_API_KEY`, `EMAIL_FROM` (optional), and confirm
  `VITE_CONVEX_URL` points at the production backend for all three apps.

---

## Files changed

| File | Change |
|---|---|
| `packages/shared/src/pages/Auth.tsx` | Rewritten: 2-step OTP flow, masked email, 60s countdown, auto-submit, change-email, differentiated errors, mobile/desktop responsive |
| `packages/shared/src/lib/auth-flow.ts` | NEW: pure, tested helpers (normalize/validate/mask/classify/countdown) |
| `packages/shared/src/lib/i18n/locales/th.ts` | 15 new auth keys (Thai) |
| `packages/shared/src/lib/i18n/locales/en.ts` | 15 new auth keys (English) |
| `packages/shared/src/lib/i18n/locales/index.ts` | Burmese auth patch (see note below) |
| `packages/shared/src/lib/i18n/locales/my.ts` | Header note + untyped export (Burmese file body untouched) |
| `tests/auth-flow.test.ts` | NEW: 25 auth-flow assertions |

## Known limitations

1. **Google Sign-in** — not implemented: `@convex-dev/auth@0.0.95` has no OAuth
   provider factory. Requires a library upgrade + Google OAuth keys + an
   `auth.config.ts` entry. Do this as a separate, careful change.
2. **Burmese locale keys** — `my.ts` (56 KB) sits beyond the file-editor's safe
   read window, so the 15 new keys are merged in `locales/index.ts` as an
   explicit `myAuthPatch` (documented, key-parity test enforces correctness).
   Merge into `my.ts` when the file can be rewritten wholesale.
3. **Expiry / attempt differentiation** — Convex Auth reports every
   verification failure as "Could not verify code", so the client combines the
   server signal with local facts (client-side 15-min expiry mirror, attempt
   counter) to choose the most truthful message. The backend still enforces
   expiry, single-use and the 10/hour brute-force limit authoritatively.
4. **Live E2E of email delivery** requires the Convex env var
   `FREEBUFF_EMAIL_API_KEY` to be set on the production deployment (managed via
   the Keys UI) — without it the backend correctly refuses to send and the UI
   shows "ไม่สามารถส่งรหัสได้ กรุณาลองใหม่".
