/**
 * Velnox Backend — Platform Settings (spec §32, §42).
 *
 * Key/value JSONB rows. Business rules (commission %, shipping share, return
 * threshold, payment methods, auto-approve flags) are read from here by the
 * backend — never hard-coded — and editable only by admin/owner via VelCenter.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- JSONB rows */
import type { Db } from "./db";
import { AppError } from "./errors";
import type { PlatformSetting } from "./types";

/** Read one setting; returns `fallback` when the key is missing. */
export async function getSettingValue<T = unknown>(db: Db, key: string, fallback?: T): Promise<T> {
  const rows = await db("SELECT value FROM platform_settings WHERE key = $1 LIMIT 1", [key]);
  if (!rows[0]) return fallback as T;
  const raw = rows[0].value;
  return (typeof raw === "string" ? JSON.parse(raw) : raw) as T;
}

/** Read all settings as a plain object. */
export async function listSettings(db: Db): Promise<PlatformSetting[]> {
  const rows = await db("SELECT key, value FROM platform_settings ORDER BY key ASC");
  return rows.map((r) => ({ key: r.key, value: typeof r.value === "string" ? JSON.parse(r.value) : r.value }));
}

/** Allowed setting keys — anything else is rejected. */
const ALLOWED_KEYS = [
  "platform_name",
  "currency",
  "platform_commission_percent",
  "shipping_company_percent",
  "return_rate_threshold",
  "auto_approve_sellers",
  "auto_approve_products",
  "require_product_review",
  "tax_enabled",
  "tax_percent",
  "payment_credit_card",
  "payment_promptpay",
  "payment_bank_transfer",
  "payment_cod",
] as const;

export const PLATFORM_SETTING_KEYS: readonly string[] = ALLOWED_KEYS;

/**
 * Update a setting (admin/owner only — enforced by the caller). Every change
 * is audit-logged by the caller. Validates the value type per key.
 */
export async function updateSetting(db: Db, key: string, value: unknown, updatedBy: string): Promise<PlatformSetting> {
  if (!ALLOWED_KEYS.includes(key as (typeof ALLOWED_KEYS)[number])) {
    throw new AppError("INVALID_INPUT", `Unknown platform setting: ${key}`);
  }
  validateValue(key, value);

  const rows = await db(
    `INSERT INTO platform_settings (key, value, updated_by, updated_at)
     VALUES ($1, $2::jsonb, $3, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()
     RETURNING key, value`,
    [key, JSON.stringify(value), updatedBy],
  );
  return { key: rows[0].key, value: JSON.parse(rows[0].value) };
}

/**
 * Percentage keys that must stay within 0–100 (spec §13: commission,
 * shipping share, return threshold, tax). Exported for tests.
 */
export const PERCENT_KEYS: readonly string[] = [
  "platform_commission_percent",
  "shipping_company_percent",
  "return_rate_threshold",
  "tax_percent",
];

export function validateValue(key: string, value: unknown): void {
  if (PERCENT_KEYS.includes(key)) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
      throw new AppError("INVALID_INPUT", `Setting ${key} ต้องเป็นตัวเลข 0–100`);
    }
    return;
  }
  const boolKeys: readonly string[] = [
    "auto_approve_sellers",
    "auto_approve_products",
    "require_product_review",
    "tax_enabled",
    "payment_credit_card",
    "payment_promptpay",
    "payment_bank_transfer",
    "payment_cod",
  ];
  if (boolKeys.includes(key)) {
    if (typeof value !== "boolean") throw new AppError("INVALID_INPUT", `Setting ${key} ต้องเป็น true/false`);
  } else if (key === "platform_name" || key === "currency") {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new AppError("INVALID_INPUT", `Setting ${key} ต้องเป็นข้อความ`);
    }
  }
}
