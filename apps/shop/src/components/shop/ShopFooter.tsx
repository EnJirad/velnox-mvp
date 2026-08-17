import { Logo } from "@velnox/shared/components/Logo";
import { SITE_URLS } from "@velnox/shared/lib/sites";
import { useLanguage } from "@/lib/i18n";
import { Heart, HelpCircle, History, Home, Mail, Package, Scale, Store, Tag } from "lucide-react";
import { Link } from "react-router";

/**
 * VelShop footer — a production e-commerce footer shared by every page.
 * Sections: SHOP · HELP · LEGAL · VELNOX · SELLER.
 *
 * "เกี่ยวกับ Velnox" always points at the corporate site from configuration
 * (SITE_URLS.corporate), never a hardcoded URL. The seller entry is a plain
 * link (same weight as the other links — no oversized CTA). Social / app-store
 * buttons are intentionally absent until real channels exist.
 */
export function ShopFooter() {
  const { t } = useLanguage();
  const year = new Date().getFullYear();

  const link = (
    to: string,
    label: string,
    external = false,
    opts: { onNavigate?: () => void } = {},
  ) =>
    external ? (
      <a
        href={to}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-slate-500 transition-colors hover:text-[#10B981]"
      >
        {label}
      </a>
    ) : (
      <Link
        to={to}
        onClick={opts.onNavigate}
        className="text-sm text-slate-500 transition-colors hover:text-[#10B981]"
      >
        {label}
      </Link>
    );

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-6">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-6 text-slate-500">{t("footer.tagline")}</p>
            <p className="mt-1.5 text-xs leading-5 text-slate-400">{t("footer.shopDesc")}</p>
          </div>

          {/* SHOP */}
          <nav aria-label={t("footer.colShop")}>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {t("footer.colShop")}
            </p>
            <ul className="mt-4 space-y-2.5">
              <li className="flex items-center gap-2">
                <Home className="size-3.5 text-slate-300" />
                {link("/", t("nav.home"))}
              </li>
              <li className="flex items-center gap-2">
                <Package className="size-3.5 text-slate-300" />
                {link("/products", t("footer.allProducts"))}
              </li>
              <li className="flex items-center gap-2">
                <Tag className="size-3.5 text-slate-300" />
                {link("/categories", t("nav.categories"))}
              </li>
              <li className="flex items-center gap-2">
                <Heart className="size-3.5 text-slate-300" />
                {link("/wishlist", t("nav.wishlist"))}
              </li>
              <li className="flex items-center gap-2">
                <History className="size-3.5 text-slate-300" />
                {link("/orders", t("nav.orders"))}
              </li>
            </ul>
          </nav>

          {/* HELP */}
          <nav aria-label={t("footer.colHelp")}>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {t("footer.colHelp")}
            </p>
            <ul className="mt-4 space-y-2.5">
              <li className="flex items-center gap-2">
                <HelpCircle className="size-3.5 text-slate-300" />
                {link("/notifications", t("footer.helpCenter"))}
              </li>
              <li>{link("/orders", t("footer.helpOrders"))}</li>
              <li>{link("/orders", t("footer.helpPayment"))}</li>
              <li>{link("/orders", t("footer.helpShipping"))}</li>
              <li>{link("/orders", t("footer.helpReturns"))}</li>
              <li className="flex items-center gap-2">
                <Mail className="size-3.5 text-slate-300" />
                {link("/profile", t("footer.contactUs"))}
              </li>
            </ul>
          </nav>

          {/* LEGAL */}
          <nav aria-label={t("footer.colLegal")}>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {t("footer.colLegal")}
            </p>
            <ul className="mt-4 space-y-2.5">
              <li>{link(SITE_URLS.corporate, t("footer.terms"), true)}</li>
              <li>{link(SITE_URLS.corporate, t("footer.privacy"), true)}</li>
              <li>{link(SITE_URLS.corporate, t("footer.cookies"), true)}</li>
              <li>{link(SITE_URLS.corporate, t("footer.refundPolicy"), true)}</li>
            </ul>
          </nav>

          {/* VELNOX + SELLER */}
          <nav aria-label={t("footer.colVelnox")}>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {t("footer.colVelnox")}
            </p>
            <ul className="mt-4 space-y-2.5">
              <li>{link(SITE_URLS.corporate, t("footer.aboutVelnox"), true)}</li>
              <li>{link(SITE_URLS.corporate, t("footer.company"), true)}</li>
              <li>{link(SITE_URLS.corporate, t("footer.contactUs"), true)}</li>
            </ul>

            <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-slate-400">
              {t("footer.colSeller")}
            </p>
            <ul className="mt-4 space-y-2.5">
              <li className="flex items-center gap-2">
                <Store className="size-3.5 text-slate-300" />
                {link(SITE_URLS.velseller, t("footer.openShop"), true)}
              </li>
              <li>{link(SITE_URLS.velseller, t("footer.sellerLogin"), true)}</li>
            </ul>
          </nav>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-6 sm:flex-row">
          <p className="text-xs text-slate-400">{t("footer.rights", { year })}</p>
          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <Scale className="size-3.5 text-[#10B981]" />
            {t("footer.secureNote")}
          </p>
        </div>
      </div>
    </footer>
  );
}
