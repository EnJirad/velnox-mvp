/**
 * Velnox Backend — Business Rules (spec §23–25, §32, §38–41).
 *
 * Rules like the 3% platform commission, 10% shipping share and the 10% return
 * threshold are NEVER hard-coded in logic — they live in platform_settings
 * (Neon) and are resolved here with safe defaults. All money math is done in
 * integer-safe decimal steps (NUMERIC in DB; round2 here) server-side only.
 */
import type { Db } from "./db";
import { getSettingValue } from "./platformSettings";
import type { BusinessRules } from "./types";

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Defaults — used only when platform_settings rows are missing. */
export const DEFAULT_RULES: BusinessRules = {
  platformName: "Velnox",
  currency: "THB",
  platformCommissionPercent: 3,
  shippingCompanyPercent: 10,
  returnRateThreshold: 10,
  autoApproveSellers: false,
  autoApproveProducts: false,
  taxEnabled: false,
  taxPercent: 7,
};

/** Resolve business rules from platform_settings (admin-editable via VelCenter).
 *
 * Reads the full settings table in ONE query per call and resolves every rule
 * from that snapshot — no stale process-lifetime cache, no fire-and-forget
 * warm-up. After the owner changes a setting, the very next report/action
 * picks it up. */
export async function resolveRules(db: Db): Promise<BusinessRules> {
  const rows = await db("SELECT key, value FROM platform_settings");
  const values = new Map<string, unknown>();
  for (const r of rows) {
    try {
      values.set(r.key, typeof r.value === "string" ? JSON.parse(r.value) : r.value);
    } catch {
      values.set(r.key, r.value);
    }
  }
  const num = (key: string, fallback: number) => {
    const v = values.get(key);
    return typeof v === "number" && Number.isFinite(v) ? v : fallback;
  };
  const str = (v: unknown, fallback: string) => (typeof v === "string" ? v : fallback);
  const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
  return {
    platformName: str(values.get("platform_name"), DEFAULT_RULES.platformName),
    currency: str(values.get("currency"), DEFAULT_RULES.currency),
    platformCommissionPercent: num("platform_commission_percent", DEFAULT_RULES.platformCommissionPercent),
    shippingCompanyPercent: num("shipping_company_percent", DEFAULT_RULES.shippingCompanyPercent),
    returnRateThreshold: num("return_rate_threshold", DEFAULT_RULES.returnRateThreshold),
    autoApproveSellers: bool(values.get("auto_approve_sellers"), DEFAULT_RULES.autoApproveSellers),
    autoApproveProducts: bool(values.get("auto_approve_products"), DEFAULT_RULES.autoApproveProducts),
    taxEnabled: bool(values.get("tax_enabled"), DEFAULT_RULES.taxEnabled),
    taxPercent: num("tax_percent", DEFAULT_RULES.taxPercent),
  };
}

// ---------------------------------------------------------------------------
// pure calculation helpers (unit-tested in tests/)
// ---------------------------------------------------------------------------

/** platformFee = grossSale * commissionPercent / 100 (spec §38) */
export const calcPlatformFee = (grossSale: number, commissionPercent: number) =>
  round2((grossSale * commissionPercent) / 100);

/** returnRate = returned / completed * 100 (spec §39) */
export const calcReturnRatePercent = (returned: number, completed: number) =>
  completed <= 0 ? 0 : round2((returned / completed) * 100);

/**
 * Return cost the SELLER must cover when their return rate exceeds the
 * threshold. The platform covers returns up to threshold% of gross; the rest
 * is the seller's responsibility (spec §40).
 */
export const calcSellerReturnCost = (
  gross: number,
  returnsValue: number,
  returnRateThresholdPercent: number,
) => {
  const coverage = round2(Math.min(returnsValue, (gross * returnRateThresholdPercent) / 100));
  return round2(returnsValue - coverage);
};

/** sellerNet = gross − platformFee − sellerReturnCost − shippingDeductions (spec §26) */
export const calcSellerNet = (
  gross: number,
  platformFee: number,
  sellerReturnCost: number,
  shippingDeductions: number,
) => round2(gross - platformFee - sellerReturnCost - shippingDeductions);

/** platform revenue from one order: commission + shipping share (spec §27). */
export const calcPlatformRevenue = (
  grossSale: number,
  shippingFee: number,
  commissionPercent: number,
  shippingCompanyPercent: number,
) => ({
  commission: calcPlatformFee(grossSale, commissionPercent),
  shippingRevenue: round2((shippingFee * shippingCompanyPercent) / 100),
  total: round2(calcPlatformFee(grossSale, commissionPercent) + (shippingFee * shippingCompanyPercent) / 100),
});
