/**
 * Velnox Backend — Storefront settings (spec §15–16).
 *
 * Public read model for the velshop storefront, backed by Neon
 * platform_settings (authoritative). Replaces the legacy Convex
 * `storeSettings` doc that velshop/velcenter used to read/write.
 *
 * No auth required to READ (it is public storefront info); the WRITE side is
 * the center action (owner/admin, permission-checked + audit-logged).
 */
"use node";

import { serializedAction as action } from "./lib/serialize";
import { getDb } from "../backend/db";
import { storefrontSettings } from "../backend/platformSettings";

export const settings = action({
  args: {},
  handler: async () => storefrontSettings(getDb()),
});
