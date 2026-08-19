import { ShopHeader } from "@/components/shop/ShopHeader";
import { ShopFooter } from "@/components/shop/ShopFooter";
import { Button } from "@velnox/shared/components/ui/button";
import { useAuth } from "@velnox/shared/hooks/use-auth";
import { useCart } from "@/lib/cart";
import { useLanguage } from "@/lib/i18n";
import { formatBaht } from "@velnox/shared/lib/commerce";
import {
  ImageOff,
  Loader2,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Store,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

export default function ShopCart() {
  const { lines, count, total, setQty, remove, syncing } = useCart();
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof lines>();
    for (const line of lines) {
      const key = line.shopName ?? t("productDetail.defaultShop");
      const list = map.get(key) ?? [];
      list.push(line);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [lines, t]);

  const handleSetQty = async (productId: string, qty: number) => {
    setBusyId(productId);
    setQty(productId, qty);
    setBusyId(null);
  };

  const handleCheckout = () => {
    if (!isAuthenticated) {
      navigate("/auth?returnTo=/checkout");
      return;
    }
    navigate("/checkout");
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] text-slate-900">
      <ShopHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 pb-28 sm:px-6 sm:py-10 lg:pb-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t("cart.title")}</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {syncing
              ? t("cartPage.loading")
              : count > 0
                ? t("cartPage.summary", { count, shops: grouped.length })
                : t("cartPage.allHere")}
          </p>
        </div>

        {syncing ? (
          <div className="mt-10 flex items-center justify-center gap-2 text-sm text-slate-400">
            <Loader2 className="size-4 animate-spin" />
            {t("cartPage.loading")}
          </div>
        ) : lines.length === 0 ? (
          <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-20 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-slate-100">
              <ShoppingBag className="size-7 text-slate-400" />
            </span>
            <h2 className="mt-5 text-lg font-semibold text-slate-900">{t("cartPage.emptyTitle")}</h2>
            <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-500">{t("cartDrawer.emptyDesc")}</p>
            <Button className="mt-6 gap-1.5 bg-slate-900 text-white hover:bg-slate-800" asChild>
              <Link to="/">
                <ShoppingBag className="size-4" />
                {t("cartPage.goShopping")}
              </Link>
            </Button>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-5">
            {/* Lines grouped by shop */}
            <div className="space-y-5 lg:col-span-3">
              {grouped.map(([shopName, shopLines]) => (
                <div key={shopName} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
                    <Store className="size-4 text-[#10B981]" />
                    <p className="text-sm font-semibold text-slate-900">{shopName}</p>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {shopLines.map((line) => (
                      <div key={line.id} className="flex items-center gap-4 px-5 py-4">
                        {line.imageUrl ? (
                          <img
                            src={line.imageUrl}
                            alt={line.name}
                            className="size-16 shrink-0 rounded-[10px] border border-slate-100 object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <span className="flex size-16 shrink-0 items-center justify-center rounded-[10px] bg-slate-50">
                            <ImageOff className="size-5 text-slate-300" />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <Link
                            to={`/products/${line.productId}`}
                            className="block truncate text-sm font-semibold text-slate-900 hover:text-[#10B981]"
                          >
                            {line.name}
                          </Link>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {formatBaht(line.price)} {t("cart.perUnit", { unit: line.unit })}
                            {line.qty >= line.stock && (
                              <span className="ml-2 font-medium text-amber-600">{t("cartPage.maxStock")}</span>
                            )}
                          </p>
                          <div className="mt-2 flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="size-8 border-slate-200 text-slate-600"
                              onClick={() => void handleSetQty(line.productId, line.qty - 1)}
                              disabled={busyId === line.productId}
                              aria-label={t("cartDrawer.ariaDecrease")}
                            >
                              <Minus className="size-3" />
                            </Button>
                            <span className="w-8 text-center text-sm font-semibold tabular-nums text-slate-900">
                              {line.qty}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="size-8 border-slate-200 text-slate-600"
                              onClick={() => void handleSetQty(line.productId, line.qty + 1)}
                              disabled={busyId === line.productId || line.qty >= line.stock}
                              aria-label={t("cartDrawer.ariaIncrease")}
                            >
                              <Plus className="size-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <p className="text-sm font-bold tabular-nums text-slate-900">
                            {formatBaht(line.qty * line.price)}
                          </p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-slate-400 hover:text-red-600"
                            onClick={() => remove(line.productId)}
                            aria-label={t("cartDrawer.ariaRemove", { name: line.name })}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="lg:col-span-2">
              <div className="sticky top-20 rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="text-base font-bold tracking-tight text-slate-900">{t("cartPage.orderSummary")}</h2>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">{t("cartPage.itemsCount", { count })}</span>
                    <span className="font-medium tabular-nums text-slate-900">{formatBaht(total)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">{t("cart.shipping")}</span>
                    <span className="text-slate-400">{t("cartPage.shippingCalc")}</span>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                  <span className="text-sm font-medium text-slate-500">{t("cartDrawer.totalLabel")}</span>
                  <span className="text-2xl font-bold tabular-nums tracking-tight text-slate-900">
                    {formatBaht(total)}
                  </span>
                </div>
                <Button
                  className="mt-5 w-full gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
                  disabled={isLoading || count === 0}
                  onClick={handleCheckout}
                >
                  <ShieldCheck className="size-4" />
                  {t("cart.checkout")}
                </Button>
                <p className="mt-3 flex items-center justify-center gap-1 text-center text-[11px] text-slate-400">
                  <ShieldCheck className="size-3.5 text-[#10B981]" />
                  {t("cartPage.checkoutNote")}
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Mobile sticky checkout bar (app-like) — total + checkout always in reach */}
      {!syncing && lines.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 px-3 lg:hidden">
          <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/95 p-3 shadow-[0_10px_34px_rgba(15,23,42,0.16)] backdrop-blur">
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400">{t("cartDrawer.totalLabel")}</p>
              <p className="text-lg font-bold tabular-nums tracking-tight text-slate-900">
                {formatBaht(total)}
              </p>
            </div>
            <Button
              className="h-12 flex-1 gap-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800"
              disabled={isLoading || count === 0}
              onClick={handleCheckout}
            >
              <ShieldCheck className="size-4" />
              {t("cart.checkout")}
            </Button>
          </div>
        </div>
      )}

      <ShopFooter />
    </div>
  );
}
