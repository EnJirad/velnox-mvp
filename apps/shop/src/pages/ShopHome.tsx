import { ShopHeader } from "@/components/shop/ShopHeader";
import { ShopFooter } from "@/components/shop/ShopFooter";
import { SubscriptionDialog } from "@/components/shop/SubscriptionDialog";
import { ProductDetailModal } from "@/components/shop/ProductDetailModal";
import { Badge } from "@velnox/shared/components/ui/badge";
import { Button } from "@velnox/shared/components/ui/button";
import { Input } from "@velnox/shared/components/ui/input";
import { api } from "@convex/_generated/api";
import { useAuth } from "@velnox/shared/hooks/use-auth";
import { useCart } from "@/lib/cart";
import { useLanguage } from "@/lib/i18n";
import {
  PRODUCT_CATEGORY_META,
  formatBaht,
  type StoreProduct,
  type StoreProductCategory,
} from "@velnox/shared/lib/commerce";
import { setSeo } from "@/lib/seo";
import { useTracking } from "@velnox/shared/lib/track";
import { useAction } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BellRing,
  CalendarClock,
  Headset,
  Heart,
  History,
  ImageOff,
  Megaphone,
  Package,
  PackageOpen,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingBasket,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  TrendingUp,
  Truck,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

interface RecommendedRow {
  product: StoreProduct;
  score: number;
  reasons: string[];
  views: number;
}

/** Icon per product category — one consistent icon set (app-like). */
const CATEGORY_ICONS: Record<StoreProductCategory, LucideIcon> = {
  general: Package,
  food: UtensilsCrossed,
  daily: ShoppingBasket,
  beauty: Sparkles,
  packaging: PackageOpen,
  other: Package,
};

/** Tiny loader for action-backed (non-reactive) data. */
function useCommerceData<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    load()
      .then((d) => alive && setData(d))
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [load, version]);
  const reload = useCallback(() => {
    setLoading(true);
    setVersion((v) => v + 1);
  }, []);
  return { data, loading, reload };
}

export default function ShopHome() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const { t } = useLanguage();
  const listProducts = useAction(api.commerce.listProducts);
  const recommendAction = useAction(api.memory.recommendForCustomer);
  const regularsAction = useAction(api.commerce.customerRegulars);
  const remindersAction = useAction(api.memory.dueReorderReminders);
  const publicShops = useAction(api.customer.publicShops);
  const recordInterest = useAction(api.commerce.recordInterest);
  const { track } = useTracking();
  const navigate = useNavigate();
  const storefrontSettings = useAction(api.storefront.settings);
  const [settings, setSettings] = useState<{
    shopName?: string | null;
    tagline?: string | null;
    phone?: string | null;
    address?: string | null;
    announcement?: string | null;
  } | null>(null);
  useEffect(() => {
    let alive = true;
    storefrontSettings()
      .then((s) => alive && setSettings(s))
      .catch(() => alive && setSettings(null));
    return () => {
      alive = false;
    };
  }, [storefrontSettings]);
  const { add } = useCart();

  const productsData = useCommerceData(
    useCallback(() => listProducts({ status: "published", limit: 100 }), [listProducts]),
  );
  const shopsData = useCommerceData(
    useCallback(() => publicShops(), [publicShops]),
  );
  const recommendData = useCommerceData(
    useCallback(() => recommendAction({ limit: 8 }), [recommendAction]),
  );
  const regularsData = useCommerceData(
    useCallback(() => regularsAction(), [regularsAction]),
  );
  const remindersData = useCommerceData(
    useCallback(() => remindersAction(), [remindersAction]),
  );

  const [query, setQuery] = useState("");
  const [detailProduct, setDetailProduct] = useState<StoreProduct | null>(null);
  const [subProduct, setSubProduct] = useState<StoreProduct | null>(null);

  const products = useMemo(() => productsData.data ?? [], [productsData.data]);
  const recommendations = useMemo(
    () => (recommendData.data?.items ?? []) as RecommendedRow[],
    [recommendData.data],
  );
  const regulars = useMemo(() => regularsData.data ?? [], [regularsData.data]);
  const reminders = useMemo(() => remindersData.data ?? [], [remindersData.data]);
  const shops = useMemo(() => shopsData.data ?? [], [shopsData.data]);

  /** Real categories (only ones that actually have published products). */
  const popularCategories = useMemo(() => {
    const counts = new Map<StoreProductCategory, number>();
    for (const p of products) {
      counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [products]);

  /** Trending = real sold counts from the commerce core (never invented). */
  const trending = useMemo(
    () =>
      [...products]
        .sort((a, b) => (b.soldCount ?? 0) - (a.soldCount ?? 0) || b.createdAt - a.createdAt)
        .slice(0, 8),
    [products],
  );

  // CPNS: a settled search is an interest signal.
  const lastSearchTracked = useRef("");
  useEffect(() => {
    const term = query.trim();
    if (term && term !== lastSearchTracked.current) {
      lastSearchTracked.current = term;
      track("SEARCH", { value: term.slice(0, 60) });
    }
  }, [query, track]);

  const handleCategory = (id: StoreProductCategory) => {
    track("CATEGORY_VIEW", {
      entityId: id,
      value: id,
      context: { label: PRODUCT_CATEGORY_META[id].label },
    });
  };

  const handleAdd = (product: StoreProduct, qty = 1) => {
    add(
      {
        id: product.id,
        name: product.name,
        unit: product.unit,
        price: product.price,
        stock: product.inventory?.available ?? product.inventory?.quantity ?? 0,
      },
      qty,
    );
    toast.success(t("cart.added", { name: product.name }));
  };

  const handleInterest = async (product: StoreProduct) => {
    toast.success(t("product.interestToast", { name: product.name }), {
      description: t("product.interestToastDesc"),
    });
    track("INTEREST", {
      entityId: product.id,
      value: product.name,
      context: { category: product.category },
    });
    try {
      await recordInterest({ productId: product.id });
    } catch (error) {
      console.error("Record interest error:", error);
    }
  };

  const tagline = settings?.tagline || "Commerce that remembers you · จำแทนคุณ";

  useEffect(() => {
    setSeo({
      title: t("home.seoTitle", { shop: "VelShop" }),
      description: t("home.seoDesc", { tagline }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagline, t]);

  const stockOf = (p: StoreProduct) => p.inventory?.available ?? p.inventory?.quantity ?? 0;
  const firstName = user?.name?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "";

  /** Product card shared by trending + recommendations + grid rows. */
  const renderProductCard = (
    product: StoreProduct,
    opts: { index?: number; reason?: string; badgeLabel?: string } = {},
  ) => {
    const outOfStock = stockOf(product) <= 0;
    const lowStock = !outOfStock && stockOf(product) <= 5;
    const hasReviews = (product.reviewCount ?? 0) > 0 && product.rating != null;
    return (
      <motion.div
        key={product.id}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: Math.min((opts.index ?? 0) * 0.04, 0.3) }}
        className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-[#10B981]/40 hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)]"
      >
        <button
          type="button"
          className="relative block aspect-square w-full cursor-pointer overflow-hidden bg-slate-50"
          onClick={() => {
            setDetailProduct(product);
            track("PRODUCT_CLICK", {
              entityId: product.id,
              value: product.name,
              context: { category: product.category, source: opts.badgeLabel ?? "home" },
            });
          }}
          aria-label={t("product.ariaViewDetail", { name: product.name })}
        >
          {product.primaryImage ? (
            <img
              src={product.primaryImage.displayUrl}
              alt={product.primaryImage.alt || product.name}
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <span className="flex size-full items-center justify-center">
              <ImageOff className="size-8 text-slate-300" />
            </span>
          )}
          {outOfStock && (
            <span className="absolute left-2 top-2 rounded-full bg-slate-900/70 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
              {t("product.outOfStock")}
            </span>
          )}
          {opts.badgeLabel && !outOfStock && (
            <span className="absolute left-2 top-2 rounded-full bg-[#10B981] px-2 py-0.5 text-[10px] font-semibold text-white">
              {opts.badgeLabel}
            </span>
          )}
          {product.soldCount != null && product.soldCount > 0 && (
            <span className="absolute bottom-2 right-2 rounded-full bg-slate-900/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
              {t("product.sold", { count: product.soldCount })}
            </span>
          )}
        </button>

        <div className="flex flex-1 flex-col p-3.5 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-slate-900">
              {product.name}
            </h3>
          </div>

          {/* rating + shop */}
          <div className="mt-1 flex min-h-4 flex-wrap items-center gap-x-2 gap-y-0.5">
            {hasReviews ? (
              <span className="flex items-center gap-0.5 text-xs text-amber-500">
                <Star className="size-3 fill-amber-400 text-amber-400" />
                <span className="font-semibold tabular-nums text-slate-700">
                  {Number(product.rating).toFixed(1)}
                </span>
                <span className="text-slate-400">({product.reviewCount})</span>
              </span>
            ) : null}
            {product.shopName && (
              <span className="flex min-w-0 items-center gap-0.5 text-[11px] text-slate-400">
                <Store className="size-3 shrink-0" />
                <span className="truncate">{product.shopName}</span>
              </span>
            )}
          </div>

          <div className="mt-2 flex items-end justify-between gap-2">
            <p className="text-base font-bold tabular-nums tracking-tight text-slate-900 sm:text-lg">
              {formatBaht(product.price)}
              <span className="ml-1 text-[11px] font-normal text-slate-400">
                {t("cart.perUnit", { unit: product.unit })}
              </span>
            </p>
          </div>

          <p
            className={`mt-1 text-[11px] ${
              outOfStock
                ? "font-medium text-red-500"
                : lowStock
                  ? "font-medium text-amber-600"
                  : "text-slate-400"
            }`}
          >
            {outOfStock
              ? t("product.outOfStock")
              : lowStock
                ? t("product.lowStock", { count: stockOf(product), unit: product.unit })
                : product.soldCount != null && product.soldCount > 0
                  ? t("product.soldShort", { count: product.soldCount })
                  : t("product.inStockShort")}
          </p>

          {opts.reason && (
            <p className="mt-1 line-clamp-1 text-[11px] leading-4 text-[#10B981]">{opts.reason}</p>
          )}

          <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
            <Button
              variant="outline"
              size="icon"
              className="size-9 shrink-0 border-slate-200 text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-500"
              onClick={() => handleInterest(product)}
              aria-label={t("product.ariaInterest", { name: product.name })}
            >
              <Heart className="size-4" />
            </Button>
            <Button
              className="h-9 flex-1 gap-1.5 bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
              disabled={outOfStock || product.price <= 0}
              onClick={() => handleAdd(product)}
            >
              <Plus className="size-4" />
              <span className="sm:hidden">{t("product.addToCartSm")}</span>
              <span className="hidden sm:inline">{t("product.addToCart")}</span>
            </Button>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] text-slate-900">
      <ShopHeader />

      {/* Brand hero — product/discovery first, no shop-name billboard */}
      <section className="relative overflow-hidden border-b border-slate-100 bg-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            background:
              "radial-gradient(600px 240px at 12% -10%, rgba(16,185,129,0.14), transparent 60%), radial-gradient(500px 220px at 88% 0%, rgba(16,185,129,0.10), transparent 60%)",
          }}
        />
        <div className="relative mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="mx-auto max-w-2xl text-center">
            <p className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-[#ECFDF5] px-3 py-1 text-xs font-semibold text-emerald-700">
              <Sparkles className="size-3.5" />
              {isAuthenticated && firstName ? t("home.heroWelcomeShort", { name: firstName }) : t("home.eyebrow")}
            </p>
            <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-4xl lg:text-[2.6rem]">
              {t("home.heroTitle")}
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
              {t("home.heroDesc")}
            </p>
            {settings?.announcement && (
              <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
                <Megaphone className="size-3.5" />
                {settings.announcement}
              </p>
            )}

            {/* Search — the primary discovery action */}
            <form
              className="mx-auto mt-6 flex max-w-xl items-center gap-2 rounded-full border border-slate-200 bg-white p-1.5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition-shadow focus-within:border-[#10B981]/50 focus-within:shadow-[0_8px_24px_rgba(16,185,129,0.12)]"
              onSubmit={(e) => {
                e.preventDefault();
                const q = query.trim();
                if (q) track("SEARCH", { value: q.slice(0, 60) });
                navigate(q ? `/products?q=${encodeURIComponent(q)}` : "/products");
              }}
              role="search"
            >
              <Search className="ml-3 size-5 shrink-0 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("home.searchPlaceholder")}
                className="h-11 border-0 bg-transparent px-1 text-sm shadow-none focus-visible:ring-0"
                aria-label={t("header.ariaSearch")}
              />
              <Button type="submit" className="h-10 shrink-0 gap-1.5 rounded-full bg-slate-900 px-5 text-white hover:bg-slate-800">
                {t("common.search")}
                <ArrowRight className="size-4" />
              </Button>
            </form>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
              <Button className="h-11 gap-1.5 rounded-full bg-[#10B981] px-6 text-white hover:bg-emerald-700" asChild>
                <Link to="/products">
                  <ShoppingBag className="size-4" />
                  {t("home.shopNow")}
                </Link>
              </Button>
              {isAuthenticated ? (
                <Button variant="outline" className="h-11 gap-1.5 rounded-full border-slate-200 px-6 text-slate-700" asChild>
                  <Link to="/orders">
                    <History className="size-4" />
                    {t("home.myOrders")}
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" className="h-11 gap-1.5 rounded-full border-slate-200 px-6 text-slate-700" asChild>
                  <Link to="/auth?returnTo=/wishlist">
                    <Heart className="size-4" />
                    {t("nav.wishlist")}
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Popular categories — only categories that actually have products */}
      {!productsData.loading && popularCategories.length > 0 && (
        <section className="border-b border-slate-100 bg-white">
          <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-slate-900">
                  {t("home.categoriesTitle")}
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">{t("home.categoriesDesc")}</p>
              </div>
              <Link
                to="/categories"
                onClick={() => track("CATEGORY_VIEW", { value: "all", context: { label: "explore" } })}
                className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-[#10B981] hover:text-emerald-700"
              >
                {t("home.viewAllCategories")}
                <ArrowRight className="size-3.5" />
              </Link>
            </div>

            <div className="mt-5 flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-6">
              {popularCategories.map(([id, count]) => {
                const Icon = CATEGORY_ICONS[id] ?? Package;
                const meta = PRODUCT_CATEGORY_META[id];
                return (
                  <Link
                    key={id}
                    to={`/products?category=${id}`}
                    onClick={() => handleCategory(id)}
                    className="group flex min-w-[120px] flex-col items-center gap-2.5 rounded-2xl border border-slate-200 bg-white p-4 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-[#10B981]/40 hover:shadow-[0_10px_24px_rgba(15,23,42,0.07)] sm:min-w-0"
                  >
                    <span className="flex size-12 items-center justify-center rounded-[14px] bg-[#ECFDF5] text-[#10B981] transition-colors group-hover:bg-[#10B981] group-hover:text-white">
                      <Icon className="size-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900">
                        {meta.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-slate-400">
                        {t("home.categoryCount", { count })}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Smart Reorder — “ถึงเวลาสั่งซื้อซ้ำแล้ว” (real purchase-cycle memory) */}
      {!authLoading && isAuthenticated && !remindersData.loading && reminders.length > 0 && (
        <section className="border-b border-slate-100 bg-gradient-to-b from-[#F0FDF9] to-white">
          <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-[10px] bg-[#10B981] text-white">
                <BellRing className="size-4" />
              </span>
              <div>
                <h2 className="text-base font-bold tracking-tight text-slate-900">
                  {t("home.reorderDueTitle")}
                </h2>
                <p className="text-xs text-slate-400">{t("home.reorderDueDesc")}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {reminders.map((r, i) => (
                <motion.div
                  key={r.product.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.05, 0.3) }}
                  className="flex items-center gap-4 rounded-2xl border border-emerald-200/70 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(16,185,129,0.12)]"
                >
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-[#ECFDF5] text-2xl">
                    {r.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{r.product.name}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {t("home.reorderDueEvery", { days: r.avgCycleDays, times: r.times })}
                    </p>
                    <p className="mt-1 text-xs font-medium text-emerald-700">
                      {r.daysLeft < 0
                        ? t("home.reorderDueOverdue", { days: Math.abs(r.daysLeft) })
                        : r.daysLeft === 0
                          ? t("home.reorderDueToday")
                          : t("home.reorderDueInDays", { days: r.daysLeft })}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="shrink-0 gap-1.5 bg-[#10B981] text-white hover:bg-emerald-700"
                    onClick={() => handleAdd(r.product)}
                  >
                    <Plus className="size-3.5" />
                    {t("home.reorderDueBuy")}
                  </Button>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Continue shopping — this customer's regular items (real order history) */}
      {!authLoading && isAuthenticated && !regularsData.loading && regulars.length > 0 && (
        <section className="border-b border-slate-100 bg-white">
          <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-[10px] bg-[#ECFDF5]">
                <History className="size-4 text-[#10B981]" />
              </span>
              <div>
                <h2 className="text-base font-bold tracking-tight text-slate-900">
                  {t("home.continueShoppingTitle")}
                </h2>
                <p className="text-xs text-slate-400">{t("home.continueShoppingDesc")}</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {regulars.slice(0, 4).map(({ product, times, lastOrderedAt }, i) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.05, 0.3) }}
                  className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-[#10B981]/40 hover:shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
                >
                  <button
                    type="button"
                    className="block aspect-[4/3] w-full cursor-pointer overflow-hidden bg-slate-50"
                    onClick={() => setDetailProduct(product)}
                  >
                    {product.primaryImage ? (
                      <img
                        src={product.primaryImage.displayUrl}
                        alt={product.name}
                        className="size-full object-cover transition-transform duration-300 hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <span className="flex size-full items-center justify-center">
                        <ImageOff className="size-6 text-slate-300" />
                      </span>
                    )}
                  </button>
                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold leading-5 text-slate-900">
                        {product.name}
                      </h3>
                      <Badge className="shrink-0 rounded-full bg-[#ECFDF5] text-emerald-700 ring-1 ring-inset ring-emerald-600/15 hover:bg-[#ECFDF5]">
                        {t("home.regularsOrderedTimes", { times })}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {lastOrderedAt
                        ? t("home.regularsLastOrdered", {
                            date: new Date(lastOrderedAt).toLocaleDateString("th-TH", {
                              day: "numeric",
                              month: "short",
                            }),
                          })
                        : ""}
                    </p>
                    <div className="mt-3 flex items-end justify-between gap-2 border-t border-slate-100 pt-3">
                      <p className="text-sm font-bold tabular-nums tracking-tight text-slate-900">
                        {formatBaht(product.price)}
                        <span className="ml-1 text-[11px] font-normal text-slate-400">
                          {t("cart.perUnit", { unit: product.unit })}
                        </span>
                      </p>
                      <Button
                        size="sm"
                        className="gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
                        onClick={() => handleAdd(product)}
                      >
                        <Plus className="size-3.5" />
                        {t("product.buyAgain")}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Recommended for you (real personalization or popular fallback) */}
      {!authLoading && recommendations.length > 0 && (
        <section className="border-b border-slate-100 bg-white">
          <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-[10px] bg-[#ECFDF5]">
                <Sparkles className="size-4 text-[#10B981]" />
              </span>
              <div>
                <h2 className="text-base font-bold tracking-tight text-slate-900">
                  {recommendData.data?.source === "personal"
                    ? t("home.recsPersonal")
                    : t("home.recsPopular")}
                </h2>
                <p className="text-xs text-slate-400">
                  {recommendData.data?.source === "personal"
                    ? t("home.recsPersonalDesc")
                    : t("home.recsPopularDesc")}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {recommendations.slice(0, 8).map(({ product, reasons }, i) =>
                renderProductCard(product, {
                  index: i,
                  reason: reasons?.join(" · "),
                  badgeLabel: t("home.badgeRecommended"),
                }),
              )}
            </div>
          </div>
        </section>
      )}

      {/* Trending — real sold counts from the commerce core */}
      {!productsData.loading && trending.length > 0 && (
        <section className="border-b border-slate-100 bg-white">
          <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-[10px] bg-[#ECFDF5]">
                  <TrendingUp className="size-4 text-[#10B981]" />
                </span>
                <div>
                  <h2 className="text-base font-bold tracking-tight text-slate-900">
                    {t("home.trendingTitle")}
                  </h2>
                  <p className="text-xs text-slate-400">{t("home.trendingDesc")}</p>
                </div>
              </div>
              <Link
                to="/products"
                className="hidden shrink-0 items-center gap-1 text-sm font-medium text-[#10B981] hover:text-emerald-700 sm:inline-flex"
              >
                {t("common.viewAll")}
                <ArrowRight className="size-3.5" />
              </Link>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {trending.map((product, i) => renderProductCard(product, { index: i }))}
            </div>
          </div>
        </section>
      )}

      {/* Shops — marketplace storefronts */}
      {!shopsData.loading && shops.length > 0 && (
        <section className="border-b border-slate-100 bg-white">
          <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-[10px] bg-[#ECFDF5]">
                <Store className="size-4 text-[#10B981]" />
              </span>
              <div>
                <h2 className="text-base font-bold tracking-tight text-slate-900">
                  {t("home.shopsTitle")}
                </h2>
                <p className="text-xs text-slate-400">{t("home.shopsDesc")}</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {shops.slice(0, 8).map((shop) => (
                <Link
                  key={shop.id}
                  to={`/shops/${shop.id}`}
                  onClick={() => track("SHOP_VIEW", { entityId: shop.id, value: shop.name })}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#10B981]/40 hover:shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-[#ECFDF5]">
                    {shop.imageUrl ? (
                      <img src={shop.imageUrl} alt={shop.name} className="size-full object-cover" loading="lazy" />
                    ) : (
                      <Store className="size-5 text-[#10B981]" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-900">{shop.name}</span>
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                      {shop.rating != null && (
                        <span className="flex items-center gap-0.5 text-amber-500">
                          <Star className="size-3 fill-amber-400 text-amber-400" />
                          {shop.rating.toFixed(1)}
                        </span>
                      )}
                      <span>{t("home.shopsProductCount", { count: shop.productCount })}</span>
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* VelRepeat — first-class recurring-commerce explainer (real feature) */}
      <section className="border-b border-slate-100 bg-gradient-to-br from-[#ECFDF5] via-white to-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          <div className="grid items-center gap-8 lg:grid-cols-2">
            <div>
              <span className="flex size-11 items-center justify-center rounded-2xl bg-[#10B981] text-white">
                <RefreshCw className="size-5" />
              </span>
              <h2 className="mt-4 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                {t("home.velrepeatTitle")}
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                {t("home.velrepeatDesc")}
              </p>
              <div className="mt-4 flex flex-col gap-2.5">
                {["velrepeatHow1", "velrepeatHow2", "velrepeatHow3"].map((key) => (
                  <p key={key} className="flex items-center gap-2.5 text-sm text-slate-600">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#10B981]/15 text-[10px] font-bold text-[#10B981]">
                      <CheckIcon />
                    </span>
                    {t(`home.${key}`)}
                  </p>
                ))}
              </div>
              <Button
                className="mt-6 h-11 gap-1.5 rounded-full bg-[#10B981] px-6 text-white hover:bg-emerald-700"
                asChild
              >
                <Link to={isAuthenticated ? "/velrepeat" : "/auth?returnTo=/velrepeat"}>
                  <CalendarClock className="size-4" />
                  {t("home.velrepeatCta")}
                </Link>
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {[
                { icon: Package, titleKey: "home.velrepeatStep1", descKey: "home.velrepeatStep1Desc" },
                { icon: CalendarClock, titleKey: "home.velrepeatStep2", descKey: "home.velrepeatStep2Desc" },
                { icon: Truck, titleKey: "home.velrepeatStep3", descKey: "home.velrepeatStep3Desc" },
              ].map((step) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.titleKey}
                    className="flex items-start gap-3 rounded-2xl border border-emerald-200/60 bg-white p-4"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-[#ECFDF5] text-[#10B981]">
                      <Icon className="size-5" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">{t(step.titleKey)}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-slate-500">{t(step.descKey)}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Trust — why customers can shop with confidence (all real capabilities) */}
      <section className="border-b border-slate-100 bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
          <h2 className="text-center text-lg font-bold tracking-tight text-slate-900">
            {t("home.trustTitle")}
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { icon: ShieldCheck, titleKey: "home.trustSecureTitle", descKey: "home.trustSecureDesc" },
              { icon: Truck, titleKey: "home.trustTrackTitle", descKey: "home.trustTrackDesc" },
              { icon: RotateCcw, titleKey: "home.trustReturnTitle", descKey: "home.trustReturnDesc" },
              { icon: Headset, titleKey: "home.trustSupportTitle", descKey: "home.trustSupportDesc" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.titleKey}
                  className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-5 text-center"
                >
                  <span className="flex size-11 items-center justify-center rounded-[14px] bg-[#ECFDF5] text-[#10B981]">
                    <Icon className="size-5" />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-slate-900">{t(item.titleKey)}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{t(item.descKey)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Main product grid — everything else */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        {productsData.loading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-[#ECFDF5]">
              <ShoppingBag className="size-7 text-[#10B981]" />
            </span>
            <h2 className="mt-5 text-lg font-semibold text-slate-900">{t("home.emptyTitle")}</h2>
            <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-500">{t("home.emptyDesc")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {products.map((product, i) => renderProductCard(product, { index: i }))}
          </div>
        )}
      </main>

      <ShopFooter />

      <ProductDetailModal
        product={detailProduct}
        open={detailProduct !== null}
        onOpenChange={(open) => !open && setDetailProduct(null)}
        onSubscribe={(p) => {
          setDetailProduct(null);
          setSubProduct(p);
        }}
      />
      <SubscriptionDialog
        product={subProduct}
        open={subProduct !== null}
        onOpenChange={(open) => {
          if (!open) setSubProduct(null);
        }}
      />
    </div>
  );
}

/** Inline check icon for the VelRepeat benefit list. */
function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.5 6.5 12 13 4.5" />
    </svg>
  );
}
