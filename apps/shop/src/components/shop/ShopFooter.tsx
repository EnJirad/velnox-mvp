import { Logo } from "@velnox/shared/components/Logo";
import { Button } from "@velnox/shared/components/ui/button";
import { SITE_URLS } from "@velnox/shared/lib/sites";
import { useLanguage } from "@/lib/i18n";
import { ArrowRight, Store } from "lucide-react";

/**
 * VelShop footer — shopping-focused. The ONLY cross-application link in the
 * public VelShop UI is the "Become a Seller" entry to seller.velnox.com.
 */
export function ShopFooter() {
  const { t } = useLanguage();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-4 text-sm leading-6 text-slate-500">{t("footer.tagline")}</p>
            <p className="mt-1.5 text-xs leading-5 text-slate-400">{t("footer.shopDesc")}</p>
          </div>

          {/* Become a Seller — the only public cross-site entry */}
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-[#F8FAFC] p-6">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Store className="size-4 text-[#10B981]" />
              {t("footer.sellerTitle")}
            </p>
            <p className="mt-1.5 text-xs leading-5 text-slate-500">{t("footer.sellerDesc")}</p>
            <Button
              className="mt-4 w-full gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
              asChild
            >
              <a href={SITE_URLS.velseller} aria-label={t("footer.sellerCta")}>
                {t("footer.sellerCta")}
                <ArrowRight className="size-4" />
              </a>
            </Button>
          </div>
        </div>

        <p className="mt-10 border-t border-slate-100 pt-6 text-center text-xs text-slate-400">
          {t("footer.rights", { year })}
        </p>
      </div>
    </footer>
  );
}
