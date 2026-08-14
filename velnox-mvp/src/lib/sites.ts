/**
 * The 3 Velnox websites — one codebase, one Convex backend + database,
 * but three SEPARATE deployable entries (velshop / velseller / velcenter).
 *
 * In this repo each site ships as its own HTML entry (velshop.html etc.) so
 * it can be deployed independently. Point VITE_VELSHOP_URL / VITE_VELSELLER_URL /
 * VITE_VELCENTER_URL at the live domains to switch cross-site links to the
 * real URLs.
 */
export const SITE_URLS = {
  velshop: import.meta.env.VITE_VELSHOP_URL ?? "/velshop.html",
  velseller: import.meta.env.VITE_VELSELLER_URL ?? "/velseller.html",
  velcenter: import.meta.env.VITE_VELCENTER_URL ?? "/velcenter.html",
} as const;

export type SiteId = keyof typeof SITE_URLS;

/**
 * Router basename for a site entry. When served at /velshop.html inside this
 * repo the site's routes live under that path; when deployed standalone at a
 * domain root (e.g. velshop.com) set VITE_SITE_BASENAME="" and routes become /.
 */
export function siteBasename(site: SiteId): string {
  const envBase = import.meta.env.VITE_SITE_BASENAME;
  if (envBase !== undefined && envBase !== "") return envBase;
  const html = `/${site}.html`;
  const path = window.location.pathname;
  if (path === html || path.startsWith(`${html}/`)) return html;
  return "/";
}
