/**
 * The 4 Velnox websites — one codebase, one Convex backend + database, but
 * four SEPARATE deployable Vite apps (apps/shop · apps/seller · apps/center ·
 * apps/corporate), each deployed to its own domain.
 *
 * SITE_URLS drives cross-application navigation across domain boundaries
 * (VelShop → "Become a Seller" → seller.velnox.com). Each app deploys
 * standalone, so the defaults are the production domains; override with
 * VITE_CORPORATE_URL / VITE_VELSHOP_URL / VITE_VELSELLER_URL /
 * VITE_VELCENTER_URL when a deployment targets a different host.
 */
export const SITE_URLS = {
  corporate: import.meta.env.VITE_CORPORATE_URL ?? "https://velnox.com",
  velshop: import.meta.env.VITE_VELSHOP_URL ?? "https://shop.velnox.com",
  velseller: import.meta.env.VITE_VELSELLER_URL ?? "https://seller.velnox.com",
  velcenter: import.meta.env.VITE_VELCENTER_URL ?? "https://center.velnox.com",
} as const;

export type SiteId = keyof typeof SITE_URLS;

/**
 * Router basename for a site entry. Each app owns its own routes under its own
 * domain root; set VITE_SITE_BASENAME when the app is served from a sub-path
 * (e.g. "/shop" behind a gateway). Defaults to "/".
 */
export function siteBasename(site: SiteId): string {
  const envBase = import.meta.env.VITE_SITE_BASENAME;
  if (envBase !== undefined && envBase !== "") return envBase;
  return "/";
}
