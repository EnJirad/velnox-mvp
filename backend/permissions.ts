/**
 * Velnox Backend — Staff Permissions (spec §46–47).
 *
 * VelCenter access is role + department + granular permission based. A staff
 * member's permission codes live in `staff_profiles.permissions` (JSONB array).
 * Admin/owner implicitly hold every permission. Enforced server-side.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- DB row access */
import type { Db } from "./db";
import { AppError } from "./errors";
import { PERMISSIONS, type Department, type Permission, type Role } from "./types";

/** Roles that implicitly hold every permission. */
const GLOBAL_ROLES: Role[] = ["owner", "admin"];

export async function getStaffProfile(db: Db, userId: string): Promise<{ department: Department | null; permissions: Permission[] } | null> {
  const rows = await db(
    "SELECT department, permissions FROM staff_profiles WHERE user_id = $1 AND status = 'active' LIMIT 1",
    [userId],
  );
  if (!rows[0]) return null;
  const perms: unknown[] = Array.isArray(rows[0].permissions) ? rows[0].permissions : [];
  return {
    department: rows[0].department ?? null,
    permissions: perms.filter((p): p is Permission => typeof p === "string" && (PERMISSIONS as readonly string[]).includes(p)),
  };
}

/** Upsert a staff profile (owner manages roles via VelCenter). */
export async function upsertStaffProfile(
  db: Db,
  input: { userId: string; department?: Department | null; permissions?: Permission[] },
): Promise<void> {
  await db(
    `INSERT INTO staff_profiles (user_id, department, permissions)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (user_id) DO UPDATE SET
       department = COALESCE(EXCLUDED.department, staff_profiles.department),
       permissions = EXCLUDED.permissions,
       updated_at = now()`,
    [input.userId, input.department ?? null, JSON.stringify(input.permissions ?? [])],
  );
}

/** Check whether a role+profile grants a permission. */
export function hasPermission(role: Role, profile: { permissions: Permission[] } | null, permission: Permission): boolean {
  if (GLOBAL_ROLES.includes(role)) return true;
  return profile?.permissions.includes(permission) ?? false;
}

/**
 * Require a permission for the given user; throws FORBIDDEN otherwise.
 * Used inside node actions (server-side only — never trust the frontend role).
 */
export async function requirePermission(
  db: Db,
  input: { userId: string; role: Role; permission: Permission },
): Promise<void> {
  if (GLOBAL_ROLES.includes(input.role)) return;
  const profile = await getStaffProfile(db, input.userId);
  if (!hasPermission(input.role, profile, input.permission)) {
    throw new AppError("FORBIDDEN", "คุณไม่มีสิทธิ์ดำเนินการนี้ (permission required)");
  }
}

/** Permission catalog for the VelCenter UI (spec §47). */
export const PERMISSION_CATALOG: { code: Permission; label: string; description: string }[] = [
  { code: "VIEW_USERS", label: "ดูผู้ใช้", description: "เห็นรายชื่อผู้ใช้ทั้งหมด" },
  { code: "EDIT_USERS", label: "แก้ไขผู้ใช้", description: "แก้ข้อมูลผู้ใช้" },
  { code: "VIEW_SELLERS", label: "ดูร้านค้า", description: "เห็นรายชื่อและรายละเอียดร้านค้า" },
  { code: "APPROVE_SELLERS", label: "อนุมัติร้านค้า", description: "อนุมัติ/ปฏิเสธร้านค้าใหม่" },
  { code: "SUSPEND_SELLERS", label: "ระงับร้านค้า", description: "ระงับ/เปิดร้านค้า" },
  { code: "VIEW_PRODUCTS", label: "ดูสินค้า", description: "เห็นสินค้าทั้งหมด" },
  { code: "APPROVE_PRODUCTS", label: "อนุมัติสินค้า", description: "อนุมัติ/ปฏิเสธสินค้า" },
  { code: "SUSPEND_PRODUCTS", label: "ระงับสินค้า", description: "ซ่อน/ระงับสินค้า" },
  { code: "VIEW_ORDERS", label: "ดูออเดอร์", description: "เห็นออเดอร์ทั้งหมด" },
  { code: "MANAGE_ORDERS", label: "จัดการออเดอร์", description: "เปลี่ยนสถานะออเดอร์" },
  { code: "VIEW_FINANCE", label: "ดูการเงิน", description: "เห็นรายงานรายได้/ค่าธรรมเนียม" },
  { code: "MANAGE_PAYOUTS", label: "จัดการจ่ายเงินร้านค้า", description: "อนุมัติจ่ายเงินร้านค้า" },
  { code: "MANAGE_PLATFORM_SETTINGS", label: "ตั้งค่าระบบ", description: "แก้ platform settings" },
];
