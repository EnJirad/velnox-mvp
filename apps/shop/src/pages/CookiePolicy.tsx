import { ShopFooter } from "@/components/shop/ShopFooter";
import { ShopHeader } from "@/components/shop/ShopHeader";
import { useCookieConsent } from "@/lib/cookie-consent";
import { useLanguage } from "@/lib/i18n";
import { setSeo } from "@/lib/seo";
import { Button } from "@velnox/shared/components/ui/button";
import { Cookie, Settings2 } from "lucide-react";
import { useEffect } from "react";

export default function CookiePolicy() {
  const { t } = useLanguage();
  const { openSettings } = useCookieConsent();

  useEffect(() => {
    setSeo({
      title: t("cookies.pageTitle") + " — VelShop",
      description: t("cookies.pageDesc"),
    });
  }, [t]);

  const sections: Array<{ title: string; desc: string }> = [
    { title: t("cookies.what"), desc: t("cookies.whatDesc") },
    { title: t("cookies.how"), desc: t("cookies.howDesc") },
    { title: t("cookies.change"), desc: t("cookies.changeDesc") },
    { title: t("cookies.retention"), desc: t("cookies.retentionDesc") },
    { title: t("cookies.contact"), desc: t("cookies.contactDesc") },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] text-slate-900">
      <ShopHeader />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <p className="flex items-center gap-1.5 text-sm font-medium text-slate-400">
          <Cookie className="size-4 text-[#10B981]" />
          {t("cookies.settings")}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {t("cookies.pageTitle")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{t("cookies.pageDesc")}</p>

        <div className="mt-8 space-y-4">
          {sections.map((s) => (
            <section key={s.title} className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-bold text-slate-900">{s.title}</h2>
              <p className="mt-1.5 text-sm leading-6 text-slate-500">{s.desc}</p>
            </section>
          ))}
        </div>

        <div className="mt-8">
          <Button className="gap-1.5 bg-[#10B981] text-white hover:bg-emerald-700" onClick={openSettings}>
            <Settings2 className="size-4" />
            {t("cookies.settings")}
          </Button>
        </div>
      </main>

      <ShopFooter />
    </div>
  );
}
