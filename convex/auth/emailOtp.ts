/**
 * Velnox — Email OTP provider (production Resend integration).
 *
 * Flow (all server-side, inside the Convex Auth sign-in action):
 *
 *   User email
 *     → auth:signIn (email-otp)
 *     → generateVerificationToken (6-digit OTP, entropy via crypto)
 *     → rate limit check (per email address, 3 requests / 15 min)
 *     → sendVerificationRequest → Resend HTTPS API → user inbox
 *     → user submits code → Convex Auth verifies (single-use, 15-min expiry,
 *       sha256-hashed storage, 10 failed attempts / hour)
 *     → authenticated session
 *
 * The API key is a SERVER-SIDE Convex env var only — never a VITE_* var, never
 * in source. Set on the Convex deployment (https://unique-clownfish-66.convex.cloud):
 *
 *   FREEBUFF_EMAIL_API_KEY  — Resend API key (re_...)
 *   EMAIL_FROM              — sender, e.g. "Velnox <no-reply@velnox.com>"
 *                             (optional; falls back to Resend's sandbox
 *                             sender "Velnox <onboarding@resend.dev>" so the
 *                             flow works before a custom domain is verified)
 *
 * Error contract: technical detail (provider status, error bodies, request
 * ids) is logged server-side ONLY. Users only ever see the generic Thai
 * message — never the env-var name, never a Resend error, never a stack
 * trace, never a request id. The OTP itself and the API key are never logged.
 */
import { Email } from "@convex-dev/auth/providers/Email";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";
import { api } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";

/** OTP lifetime, seconds (matches the copy in the email: "15 นาที"). */
const OTP_MAX_AGE_SECONDS = 60 * 15;

/** Per-address OTP email request limit (abuse / cost protection). */
const OTP_EMAIL_MAX_PER_WINDOW = 3;
const OTP_EMAIL_WINDOW_MS = 15 * 60 * 1000;

/** Shown to the user for ANY provider/configuration failure. */
const SEND_FAILED_MESSAGE = "ไม่สามารถส่งรหัสยืนยันได้ กรุณาลองใหม่อีกครั้ง";

/** Shown when the per-address OTP request limit is exceeded. */
const RATE_LIMITED_MESSAGE = "ส่งรหัสยืนยันบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง";

const RESEND_API_URL = "https://api.resend.com/emails";

/**
 * Mask an email for logs: e***@gmail.com. The recipient is the ONLY
 * personally-identifying field we ever log — never the OTP, never the API
 * key, never the Authorization header.
 */
function maskEmail(email: string): string {
  const [local, domain] = email.trim().toLowerCase().split("@");
  if (!domain) return `${local.slice(0, 1)}***`;
  const head = local.slice(0, Math.min(1, local.length));
  return `${head}***@${domain}`;
}

/**
 * Production-grade branded OTP email (inline styles for mail-client
 * compatibility). No database / internal-architecture details are exposed.
 */
function buildOtpEmailHtml(code: string, expiresInMinutes: number): string {
  const digits = code.split("").join(" ");
  return `
<!doctype html>
<html lang="th">
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
    <div style="background:#f1f5f9;padding:32px 16px;">
      <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">

        <!-- Brand header -->
        <div style="background:#0f172a;padding:24px 28px;">
          <span style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:2px;">VELNOX</span>
          <span style="color:#10b981;font-size:20px;font-weight:800;">.</span>
          <p style="margin:6px 0 0;color:#94a3b8;font-size:12px;letter-spacing:0.5px;">Commerce that remembers you · จำแทนคุณ</p>
        </div>

        <!-- Body -->
        <div style="padding:28px;">
          <h1 style="margin:0 0 8px;color:#0f172a;font-size:20px;font-weight:700;">
            ยืนยันการเข้าสู่ระบบ
          </h1>
          <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.7;">
            ใช้รหัสยืนยัน 6 หลักด้านล่างเพื่อเข้าใช้งาน Velnox
          </p>

          <!-- OTP code -->
          <div style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;padding:20px 16px;text-align:center;">
            <p style="margin:0;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;">รหัสยืนยันของคุณ</p>
            <p style="margin:10px 0 0;color:#0f172a;font-size:34px;font-weight:800;letter-spacing:8px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;">${digits}</p>
          </div>

          <p style="margin:20px 0 0;color:#64748b;font-size:13px;line-height:1.7;">
            รหัสนี้ใช้ได้ภายใน <strong>${expiresInMinutes} นาที</strong> และใช้ได้ครั้งเดียวเท่านั้น
          </p>

          <!-- Security warning -->
          <div style="margin-top:20px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 16px;">
            <p style="margin:0;color:#92400e;font-size:12px;line-height:1.7;">
              <strong>ข้อควรระวัง:</strong> หากคุณไม่ได้เป็นผู้ร้องขอรหัสนี้ กรุณาเพิกเฉยต่ออีเมลฉบับนี้
              และอย่าแชร์รหัสให้ผู้อื่น — ทีมงาน Velnox จะไม่มีวันขอรหัสยืนยันจากคุณ
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div style="background:#f8fafc;padding:16px 28px;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.6;">
            © 2026 Velnox · อีเมลนี้ถูกส่งโดยอัตโนมัติจากระบบยืนยันตัวตน กรุณาอย่าตอบกลับอีเมลนี้
          </p>
        </div>

      </div>
    </div>
  </body>
</html>
`.trim();
}

export const emailOtp = Email({
  id: "email-otp",
  maxAge: OTP_MAX_AGE_SECONDS,

  // This function can be asynchronous
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes: Uint8Array) {
        crypto.getRandomValues(bytes);
      },
    };
    const alphabet = "0123456789";
    return generateRandomString(random, alphabet, 6);
  },

  // NOTE: the Convex Auth runtime invokes this with `(params, ctx)` — the
  // second argument is passed despite the Auth.js-typed signature declaring
  // only one. It is declared optional here so the assignment stays
  // type-compatible; at runtime ctx is always provided by the sign-in action.
  async sendVerificationRequest(
    { identifier: email, token, expires },
    ctx?: ActionCtx,
  ) {
    const rateLimit = await ctx?.runMutation(api.rateLimit.hitRateLimit, {
      name: "otp-email",
      key: email.trim().toLowerCase(),
      max: OTP_EMAIL_MAX_PER_WINDOW,
      windowMs: OTP_EMAIL_WINDOW_MS,
    });
    if (rateLimit && !rateLimit.allowed) {
      // Expected abuse signal — log the masked address (never the code).
      console.error(`[EMAIL OTP] Request rate limit exceeded for ${maskEmail(email)}`);
      throw new Error(RATE_LIMITED_MESSAGE);
    }

    // Server-side secrets only — never in source, never VITE_*.
    const apiKey = process.env.FREEBUFF_EMAIL_API_KEY;
    if (!apiKey) {
      // Technical detail goes to the server log; the user sees only the
      // generic message (never the env-var name).
      console.error(
        "[auth] FREEBUFF_EMAIL_API_KEY is not set on the Convex deployment — OTP email cannot be sent",
      );
      throw new Error(SEND_FAILED_MESSAGE);
    }
    // EMAIL_FROM is optional: falls back to Resend's sandbox sender so the
    // flow works before a custom domain is verified. Production should set a
    // verified sender, e.g. "Velnox <no-reply@velnox.com>".
    const from = process.env.EMAIL_FROM || "Velnox <onboarding@resend.dev>";
    const expiresInMinutes = Math.max(
      1,
      Math.round((expires.getTime() - Date.now()) / 60000),
    );

    try {
      const res = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [email],
          subject: "รหัสยืนยันการเข้าสู่ระบบ Velnox",
          html: buildOtpEmailHtml(token, expiresInMinutes),
        }),
      });

      if (!res.ok) {
        // ---- Diagnostic block: capture the REAL Resend failure ------------
        // Parse the safe Resend error fields (name/message/statusCode). Never
        // log the API key, the OTP, the Authorization header or the raw body
        // (it can echo request data). Recipient is masked.
        let errorMessage = "";
        let errorCode = "";
        try {
          const parsed = (await res.json()) as {
            name?: string;
            message?: string;
            statusCode?: number;
          };
          errorCode = parsed.name ?? "";
          errorMessage = parsed.message ?? "";
        } catch {
          const text = (await res.text().catch(() => "")).slice(0, 300);
          if (text) errorMessage = text;
        }
        console.error(
          `[EMAIL OTP] Resend request failed\n` +
            `status: ${res.status}\n` +
            `error: ${errorMessage || "(no error message)"}\n` +
            (errorCode ? `code: ${errorCode}\n` : "") +
            `recipient: ${maskEmail(email)}`,
        );
        throw new Error(SEND_FAILED_MESSAGE);
      }
      // Success — log the delivery acceptance (Resend email id is safe) with
      // a masked recipient so a login test can be traced end-to-end.
      try {
        const accepted = (await res.json()) as { id?: string };
        console.info(
          `[EMAIL OTP] Resend accepted email (id: ${accepted.id ?? "unknown"}) recipient: ${maskEmail(email)}`,
        );
      } catch {
        // body may be empty on success — not an error
      }
    } catch (error) {
      if (error instanceof Error && error.message === SEND_FAILED_MESSAGE) {
        throw error;
      }
      // Network / transport failure — technical detail stays server-side.
      console.error(
        `[EMAIL OTP] Resend transport error: ${error instanceof Error ? error.message : "unknown"} recipient: ${maskEmail(email)}`,
      );
      throw new Error(SEND_FAILED_MESSAGE);
    }
  },
});
