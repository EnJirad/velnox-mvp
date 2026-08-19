/**
 * Velnox Backend — Employee password authentication (spec §6, §9–§11, §42).
 *
 * VelCenter login: private URL + email/employee-id + password. Password
 * accounts live in the Convex Auth `authAccounts` table as **scrypt hashes**
 * (Password provider) — the company can never view or recover an existing
 * password. HR/owner flows:
 *   - createEmployeeAction        — create an employee + one-time temp password
 *   - resetEmployeePasswordAction — reset to a new one-time temp password
 *   - setOwnPasswordAction        — employee sets a new password (force-change)
 *   - resolveLoginEmailAction     — employee-id / email → canonical account id
 *   - employeeListAction          — staff rows + permissions for the center UI
 *
 * Security rules enforced here:
 *   - Only the company owner can create/reset employees (spec §42).
 *   - The temporary password is returned EXACTLY ONCE to the owner; only the
 *     hash is stored. It is never logged (audit records omit it entirely).
 *   - mustChangePassword is set on every create/reset and only cleared after
 *     setOwnPasswordAction proves the employee knows the temp credential
 *     (they must be signed in with it to call it).
 */
"use node";

import { serializedAction as action } from "./lib/serialize";
import type { ActionCtx } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { createAccount, modifyAccountCredentials } from "@convex-dev/auth/server";
import { getDb } from "../backend/db";
import { AppError } from "../backend/errors";
import { audit } from "../backend/audit";
import { upsertStaffProfile } from "../backend/permissions";
import { createNotification } from "../backend/notifications";
import {
  generateTemporaryPassword,
  validatePasswordStrength,
} from "../backend/passwords";
import { enforceRateLimit } from "./rateLimit";
import type { Department, Permission, Role } from "../backend/types";

const PASSWORD_PROVIDER = "password";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Shape of the Convex auth user doc this module reads/writes. */
type ConvexUserDoc = {
  _id: string;
  email?: string;
  name?: string;
  role?: string;
  department?: string;
  mustChangePassword?: boolean;
};

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Owner gate (spec §42: only the company owner manages employees). */
async function requireOwner(ctx: ActionCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new AppError("AUTH_REQUIRED", "กรุณาเข้าสู่ระบบก่อน");
  const db = getDb();
  const rows = await db("SELECT id, role FROM users WHERE convex_id = $1", [identity.subject]);
  if (!rows[0] || rows[0].role !== "owner") {
    throw new AppError("FORBIDDEN", "เฉพาะเจ้าของบริษัทเท่านั้นที่จัดการพนักงานได้");
  }
  return { identity, user: rows[0] };
}

/**
 * Set the scrypt password hash for an employee account (create or overwrite).
 * - no account yet → createAccount (new user; links to an existing user with
 *   the same verified email via shouldLinkViaEmail)
 * - account exists → modifyAccountCredentials (password reset)
 */
async function setEmployeePassword(
  ctx: ActionCtx,
  input: { email: string; password: string; name?: string; role?: Role; department?: Department },
): Promise<{ userId: string; created: boolean }> {
  const exists = (await ctx.runQuery(api.employeeAuthHelpers._passwordAccountExists, {
    email: input.email,
  })) as boolean;
  if (exists) {
    await modifyAccountCredentials(ctx, {
      provider: PASSWORD_PROVIDER,
      account: { id: input.email, secret: input.password },
    });
    const user = (await ctx.runQuery(api.employeeAuthHelpers._getUserByEmail, {
      email: input.email,
    })) as ConvexUserDoc | null;
    return { userId: user?._id ?? "", created: false };
  }
  const created = await createAccount(ctx, {
    provider: PASSWORD_PROVIDER,
    account: { id: input.email, secret: input.password },
    profile: {
      name: input.name ?? input.email.split("@")[0],
      email: input.email,
      role: input.role,
      department: input.department,
      mustChangePassword: true,
    },
    shouldLinkViaEmail: true,
  });
  return { userId: created.user._id, created: true };
}

// ---------------------------------------------------------------------------
// owner actions
// ---------------------------------------------------------------------------

/**
 * Owner: create an employee. Generates a secure temporary password, stores
 * ONLY its scrypt hash, sets mustChangePassword, writes the Neon user +
 * staff_profiles rows, audits, and returns the temp password EXACTLY ONCE.
 */
export const createEmployeeAction = action({
  args: {
    name: v.string(),
    email: v.string(),
    employeeId: v.optional(v.string()),
    department: v.optional(v.string()),
    role: v.optional(v.string()),
    permissions: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { user: owner } = await requireOwner(ctx);
    await enforceRateLimit(ctx, { name: "employee_create", key: owner.id, max: 30, windowMs: 3_600_000 });

    const email = args.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) throw new AppError("VALIDATION_ERROR", "อีเมลไม่ถูกต้อง");
    const role = (args.role ?? "staff") as Role;
    if (role !== "staff" && role !== "admin") {
      throw new AppError("VALIDATION_ERROR", "บทบาทพนักงานต้องเป็น staff หรือ admin");
    }
    const department = (args.department ?? null) as Department | null;
    const permissions = (args.permissions ?? []) as Permission[];
    const employeeId = args.employeeId?.trim() || null;

    const tempPassword = generateTemporaryPassword();
    const db = getDb();

    const { userId, created } = await setEmployeePassword(ctx, {
      email,
      password: tempPassword,
      name: args.name.trim(),
      role,
      department: department ?? undefined,
    });
    if (!created) {
      // existing user — refresh role/department/force-change on the Convex doc
      await ctx.runMutation(api.employeeAuthHelpers._patchUser, {
        userId: userId as any,
        role,
        department: department ?? undefined,
        mustChangePassword: true,
      });
    }
    if (!userId) throw new AppError("INTERNAL_ERROR", "สร้างบัญชีพนักงานไม่สำเร็จ");

    // Neon business attributes (employee id, role, department, permissions)
    await db(
      `INSERT INTO users (convex_id, email, name, role, department, employee_id, password_updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (convex_id) DO UPDATE SET
         email = EXCLUDED.email, name = EXCLUDED.name, role = EXCLUDED.role,
         department = EXCLUDED.department, employee_id = EXCLUDED.employee_id,
         password_updated_at = now()`,
      [userId, email, args.name.trim(), role, department, employeeId],
    );
    await upsertStaffProfile(db, { userId, department, permissions });

    await audit(db, {
      actorId: owner.id,
      actorRole: "owner",
      action: "OWNER_CREATED_EMPLOYEE",
      entityType: "employee",
      entityId: userId,
      after: { email, role, department, employeeId, hasPassword: true },
      // NOTE: tempPassword is deliberately NOT included anywhere here.
    });
    await recordEvent(ctx, "EmployeeCreated", userId, { email, role, department });
    try {
      await createNotification(db, {
        userId,
        type: "system",
        title: "บัญชีพนักงานของคุณถูกสร้าง",
        message: `เข้าสู่ระบบ velcenter ด้วยรหัสชั่วคราวจากเจ้าของบริษัท แล้วตั้งรหัสใหม่ทันที (${email})`,
      });
    } catch (err) {
      console.error("[employeeAuth] notification failed:", err);
    }

    // Shown once to the owner — never persisted.
    return { tempPassword, userId, email };
  },
});

/**
 * Owner: reset an employee's password. New one-time temp password, hash
 * overwritten, mustChangePassword forced, audit logged, returned once.
 */
export const resetEmployeePasswordAction = action({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const { user: owner } = await requireOwner(ctx);
    await enforceRateLimit(ctx, { name: "employee_reset", key: owner.id, max: 30, windowMs: 3_600_000 });

    const user = (await ctx.runQuery(api.employeeAuthHelpers._getUserById, {
      userId: args.userId as any,
    })) as ConvexUserDoc | null;
    if (!user) throw new AppError("NOT_FOUND", "ไม่พบพนักงาน");
    const email = user.email;
    if (!email) throw new AppError("VALIDATION_ERROR", "พนักงานคนนี้ไม่มีอีเมลสำหรับล็อกอิน");

    const tempPassword = generateTemporaryPassword();
    const db = getDb();
    await setEmployeePassword(ctx, { email, password: tempPassword });
    await ctx.runMutation(api.employeeAuthHelpers._patchUser, {
      userId: args.userId as any,
      mustChangePassword: true,
    });
    await db("UPDATE users SET password_updated_at = now() WHERE convex_id = $1", [args.userId]);

    const neon = await db("SELECT id FROM users WHERE convex_id = $1", [args.userId]);
    await audit(db, {
      actorId: owner.id,
      actorRole: "owner",
      action: "OWNER_RESET_EMPLOYEE_PASSWORD",
      entityType: "employee",
      entityId: args.userId,
      after: { forcedChange: true },
    });
    await recordEvent(ctx, "EmployeePasswordReset", args.userId, {});
    if (neon[0]) {
      try {
        await createNotification(db, {
          userId: neon[0].id,
          type: "system",
          title: "รหัสผ่านของคุณถูกรีเซ็ต",
          message: "กรุณาเข้าสู่ระบบด้วยรหัสชั่วคราวจากเจ้าของบริษัท แล้วตั้งรหัสใหม่ทันที",
        });
      } catch (err) {
        console.error("[employeeAuth] notification failed:", err);
      }
    }
    return { tempPassword, userId: args.userId, email };
  },
});

/**
 * Owner: disable / re-enable an employee (staff_profiles.status) — spec §42.
 */
export const setEmployeeActiveAction = action({
  args: { userId: v.string(), active: v.boolean() },
  handler: async (ctx, args) => {
    const { user: owner } = await requireOwner(ctx);
    const db = getDb();
    const rows = await db("SELECT id FROM users WHERE convex_id = $1", [args.userId]);
    if (!rows[0]) throw new AppError("NOT_FOUND", "ไม่พบพนักงาน");
    await db("UPDATE staff_profiles SET status = $2, updated_at = now() WHERE user_id = $1", [
      rows[0].id,
      args.active ? "active" : "inactive",
    ]);
    await audit(db, {
      actorId: owner.id,
      actorRole: "owner",
      action: args.active ? "OWNER_ENABLED_EMPLOYEE" : "OWNER_DISABLED_EMPLOYEE",
      entityType: "employee",
      entityId: args.userId,
      after: { active: args.active },
    });
    await recordEvent(ctx, args.active ? "EmployeeEnabled" : "EmployeeDisabled", args.userId, {});
    return { ok: true };
  },
});

/**
 * Owner: list employees with their staff permissions (center staff tab).
 * Returns the Convex user id so role/department changes can go through the
 * existing api.users.setUserAccess path.
 */
export const employeeListAction = action({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    const db = getDb();
    const rows = await db(
      `SELECT u.convex_id, u.email, u.name, u.role, u.department, u.employee_id, u.created_at,
              sp.permissions, sp.status AS staff_status
       FROM users u
       LEFT JOIN staff_profiles sp ON sp.user_id = u.id
       WHERE u.role IN ('staff','admin')
       ORDER BY u.created_at ASC`,
    );
    const employees: Record<string, unknown>[] = [];
    for (const r of rows) {
      const convexUser = (r.convex_id
        ? await ctx.runQuery(api.employeeAuthHelpers._getUserById, { userId: r.convex_id })
        : null) as ConvexUserDoc | null;
      employees.push({
        userId: r.convex_id,
        neonId: r.id,
        email: r.email,
        name: r.name,
        role: r.role,
        department: r.department ?? null,
        employeeId: r.employee_id ?? null,
        permissions: Array.isArray(r.permissions) ? r.permissions : [],
        active: r.staff_status !== "inactive",
        mustChangePassword: (convexUser as { mustChangePassword?: boolean } | null)?.mustChangePassword ?? false,
        createdAt: new Date(r.created_at).getTime(),
      });
    }
    return employees;
  },
});

// ---------------------------------------------------------------------------
// employee actions
// ---------------------------------------------------------------------------

/**
 * Signed-in employee: set their own password. Only allowed while
 * mustChangePassword is true (set by the owner on create/reset) — this proves
 * the caller holds the one-time credential and prevents arbitrary use of a
 * stale session to rotate someone's password.
 */
export const setOwnPasswordAction = action({
  args: { newPassword: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new AppError("AUTH_REQUIRED", "กรุณาเข้าสู่ระบบก่อน");
    const user = (await ctx.runQuery(api.employeeAuthHelpers._getUserById, {
      userId: identity.subject as any,
    })) as ConvexUserDoc | null;
    if (!user) throw new AppError("NOT_FOUND", "ไม่พบผู้ใช้");
    const email = user.email;
    if (!email) throw new AppError("VALIDATION_ERROR", "บัญชีนี้ไม่มีอีเมลสำหรับเปลี่ยนรหัสผ่าน");

    const issues = validatePasswordStrength(args.newPassword);
    if (issues.length > 0) throw new AppError("VALIDATION_ERROR", issues[0].message);

    const mustChange = user.mustChangePassword;
    if (mustChange !== true) {
      throw new AppError("FORBIDDEN", "ไม่สามารถเปลี่ยนรหัสผ่านได้ในขณะนี้");
    }

    const db = getDb();
    await enforceRateLimit(ctx, { name: "password_change", key: identity.subject, max: 10, windowMs: 3_600_000 });
    await setEmployeePassword(ctx, { email, password: args.newPassword });
    await ctx.runMutation(api.employeeAuthHelpers._patchUser, {
      userId: identity.subject as any,
      mustChangePassword: false,
    });

    const neon = await db("SELECT id FROM users WHERE convex_id = $1", [identity.subject]);
    await audit(db, {
      actorId: neon[0]?.id ?? identity.subject,
      actorRole: user.role ?? "staff",
      action: "EMPLOYEE_CHANGED_OWN_PASSWORD",
      entityType: "employee",
      entityId: identity.subject,
      after: { forcedChangeCleared: true },
    });
    return { ok: true };
  },
});

/**
 * Resolve the login identifier (employee id or email) to the canonical
 * account email BEFORE signIn("password", ...). Only resolves for users who
 * have an active staff_profile — shop customers are never resolvable here.
 */
export const resolveLoginEmailAction = action({
  args: { identifier: v.string() },
  handler: async (_ctx, args) => {
    const identifier = args.identifier.trim().toLowerCase();
    if (!identifier) throw new AppError("VALIDATION_ERROR", "กรอกรหัสพนักงานหรืออีเมล");
    const db = getDb();
    const rows = await db(
      `SELECT u.email FROM users u
       JOIN staff_profiles sp ON sp.user_id = u.id AND sp.status = 'active'
       WHERE u.employee_id = $1 OR lower(u.email) = $2
       LIMIT 1`,
      [identifier, identifier],
    );
    if (!rows[0]?.email) throw new AppError("NOT_FOUND", "ไม่พบพนักงานในระบบ");
    return { email: rows[0].email };
  },
});

async function recordEvent(
  ctx: ActionCtx,
  type: string,
  entityId: string,
  payload: Record<string, unknown> = {},
) {
  try {
    await ctx.runMutation(api.intelligence.recordBusinessEvent, { type, entityId, payload });
  } catch (err) {
    console.error(`[employeeAuth] event ${type} failed:`, err);
  }
}
