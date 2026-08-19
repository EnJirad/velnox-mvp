import { useCookieConsent } from "@/lib/cookie-consent";
import { useLanguage } from "@/lib/i18n";
import { Logo } from "@velnox/shared/components/Logo";
import { useAuth } from "@velnox/shared/hooks/use-auth";
import { SITE_URLS } from "@velnox/shared/lib/sites";
import type { ReactNode } from "react";
import { Link } from "react-router";

/**
 * VelShop footer — one compact layout shared by every page.
 *
 * Deliberately small: brand + tagline, three short link columns
 * (ช่วยเหลือ / บัญชี / สำหรับผู้ขาย) and a bottom bar with copyright,
 * Privacy · Terms (corporate site) and an in-app Cookie Settings action.
 * No icons, no card stacks, no long link lists — the storefront stays
 * focused on shopping.
 */
export function ShopFooter() {
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();
  const { openSettings } = useCookieConsent();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          {/* Brand */}
          <div className="max-w-xs">
            <Logo />
            <p className="mt-3 text-sm leading-6 text-slate-500">{t("footer.tagline")}</p>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <FooterColumn title={t("footer.colHelp")}>
              <FooterLink to="/profile">{t("footer.helpContact")}</FooterLink>
              <FooterLink to="/profile">{t("footer.helpFaq")}</FooterLink>
              <FooterLink to="/orders">{t("footer.helpReturns")}</FooterLink>
            </FooterColumn>

            <FooterColumn title={t("footer.colAccount")}>
              <FooterLink to={isAuthenticated ? "/profile" : "/auth?returnTo=/profile"}>
                {t("footer.accountLogin")}
              </FooterLink>
              <FooterLink to="/orders">{t("footer.accountOrders")}</FooterLink>
            </FooterColumn>

            <FooterColumn title={t("footer.colSeller")}>
              <a
                href={SITE_URLS.velseller}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-slate-500 transition-colors hover:text-[#10B981]"
              >
                {t("footer.sellerJoin")}
              </a>
            </FooterColumn>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-5 sm:flex-row">
          <p className="text-xs text-slate-400">{t("footer.rights", { year })}</p>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <a
              href={SITE_URLS.corporate}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-slate-600"
            >
              {t("footer.privacy")}
            </a>
            <a
              href={SITE_URLS.corporate}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-slate-600"
            >
              {t("footer.terms")}
            </a>
            <button
              type="button"
              onClick={openSettings}
              className="transition-colors hover:text-slate-600"
            >
              {t("footer.cookieSettings")}
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <nav aria-label={title}>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
      <ul className="mt-3 space-y-2">{children}</ul>
    </nav>
  );
}

function FooterLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <li>
      <Link to={to} className="text-sm text-slate-500 transition-colors hover:text-[#10B981]">
        {children}
      </Link>
    </li>
  );
}
