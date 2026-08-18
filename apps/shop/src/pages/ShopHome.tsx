import { ProductCard } from "@/components/shop/ProductCard";
import { ShopFooter } from "@/components/shop/ShopFooter";
import { ShopHeader } from "@/components/shop/ShopHeader";
import { SubscriptionDialog } from "@/components/shop/SubscriptionDialog";
import { ProductDetailModal } from "@/components/shop/ProductDetailModal";
import { Button } from "@velnox/shared/components/ui/button";
import { Input } from "@velnox/shared/components/ui/input";
import { api } from "@convex/_generated/api";
import { useAuth } from "@velnox/shared/hooks/use-auth";
import { useCart } from "@/lib/cart";
import { useLanguage } from "@/lib/i18n";
import {
  PRODUCT_CATEGORY_META,
  type StoreProduct,
  type StoreProductCategory,
} from "@velnox/shared/lib/commerce";
import { setSeo } from "@/lib/seo";
import { useTracking } from "@velnox/shared/lib/track";
import { useAction } from "convex/react";
import {
  ArrowRight,
  Package,
  PackageOpen,
  RefreshCw,
  Search,
  ShoppingBag,
  ShoppingBasket,
  Sparkles,
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

/** Icon per product category — one consistent icon set. */
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
  const { track } = useTracking();
  const navigate = useNavigate();
  const { add } = useCart();
  const productsData = useCommerceData(
    useCallback(() => listProducts({ status: "published", limit: 100 }), [listProducts]),
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
  /** Popular products = real sold counts from the commerce core. */
  const popularProducts = useMemo(
    () =>
      [...products]
        .sort((a, b) => (b.soldCount ?? 0) - (a.soldCount ?? 0) || b.createdAt - a.createdAt)
        .slice(0, 8),
    [products],
  );
  /**
   * Only genuinely personalized recommendations get their own block.
   * When the backend falls back to "popular" (e.g. signed-out shoppers or a
   * customer without history yet), that content would duplicate the popular
   * grid below — so we show exactly one products grid on the home page.
   */
  const showPersonalRecs = recommendations.length > 0 && recommendData.data?.source === "personal";
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
  const openProduct = (product: StoreProduct, source: string) => {
    setDetailProduct(product);
    track("PRODUCT_CLICK", {
      entityId: product.id,
      value: product.name,
      context: { category: product.category, source },
    });
  };
  useEffect(() => {
    setSeo({
      title: t("home.seoTitle", { shop: "VelShop" }),
      description: t("home.seoDesc", { tagline: "Commerce that remembers you · จำแทนคุณ" }),
    });
  }, [t]);
  const firstName = user?.name?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "";
  // Show reorder reminders when due; otherwise fall back to regulars — one
  // personalization block at a time keeps the storefront clean.
  const showReorder = reminders.length > 0;
  const showRegulars = !showReorder && regulars.length > 0;
  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] text-slate-900">
      <ShopHeader />
      {/* Compact hero — search is the primary discovery action */}
      <section className="border-b border-slate-100 bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#10B981]">
              {isAuthenticated && firstName
                ? t("home.heroWelcomeShort", { name: firstName })
                : t("home.eyebrow")}
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {t("home.heroTitle")}
            </h1>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
              {t("home.heroDesc")}
            </p>
            <form
              className="mx-auto mt-5 flex max-w-xl items-center gap-2 rounded-full border border-slate-200 bg-white p-1.5 shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition-shadow focus-within:border-[#10B981]/50 focus-within:shadow-[0_8px_24px_rgba(16,185,129,0.12)]"
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
                className="h-10 border-0 bg-transparent px-1 text-sm shadow-none focus-visible:ring-0"
                aria-label={t("header.ariaSearch")}
              />
              <Button type="submit" className="h-9 shrink-0 gap-1.5 rounded-full bg-slate-900 px-5 text-white hover:bg-slate-800">
                {t("common.search")}
                <ArrowRight className="size-4" />
              </Button>
            </form>
          </div>
        </div>
      </section>
      {/* Popular categories — compact pills, only categories that actually have products */}
      {!productsData.loading && popularCategories.length > 0 && (
        <section className="border-b border-slate-100 bg-white">
          <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold tracking-tight text-slate-900">
                {t("home.categoriesTitle")}
              </h2>
              <Link
                to="/categories"
                onClick={() => track("CATEGORY_VIEW", { value: "all", context: { label: "explore" } })}
                className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-[#10B981] hover:text-emerald-700"
              >
                {t("home.viewAllCategories")}
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {popularCategories.map(([id]) => {
                const Icon = CATEGORY_ICONS[id] ?? Package;
                const meta = PRODUCT_CATEGORY_META[id];
                return (
                  <Link
                    key={id}
                    to={`/products?category=${id}`}
                    onClick={() => handleCategory(id)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:border-[#10B981]/40 hover:text-slate-900"
                  >
                    <Icon className="size-3.5 text-[#10B981]" />
                    {meta.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}
      {/* Smart reorder — “ถึงเวลาสั่งซื้อซ้ำแล้ว” (real purchase-cycle memory) */}
      {!authLoading && isAuthenticated && !remindersData.loading && showReorder && (
        <section className="border-b border-slate-100 bg-white">
          <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6">
            <h2 className="text-sm font-bold tracking-tight text-slate-900">
              {t("home.reorderDueTitle")}
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {reminders.map((r) => (
                <div
                  key={r.product.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:border-[#10B981]/40"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-[#ECFDF5] text-xl">
                    {r.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{r.product.name}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {t("home.reorderDueEvery", { days: r.avgCycleDays, times: r.times })}
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-emerald-700">
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
                    {t("home.reorderDueBuy")}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
      {/* Continue shopping — this customer's regular items (real order history) */}
      {!authLoading && isAuthenticated && !regularsData.loading && showRegulars && (
        <section className="border-b border-slate-100 bg-white">
          <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6">
            <h2 className="text-sm font-bold tracking-tight text-slate-900">
              {t("home.continueShoppingTitle")}
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {regulars.slice(0, 4).map(({ product }) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onOpen={(p) => openProduct(p, "home-regulars")}
                  onAdd={handleAdd}
                />
              ))}
            </div>
          </div>
        </section>
      )}
      {/* Recommended for you — only when truly personalized (real memory) */}
      {!authLoading && showPersonalRecs && (
        <section className="border-b border-slate-100 bg-white">
          <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6">
            <h2 className="text-sm font-bold tracking-tight text-slate-900">
              {t("home.recsPersonal")}
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {recommendations.slice(0, 8).map(({ product }) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onOpen={(p) => openProduct(p, "home-recommended")}
                  onAdd={handleAdd}
                  badgeLabel={t("home.badgeRecommended")}
                />
              ))}
            </div>
          </div>
        </section>
      )}
      {/* Popular products — the main shopping grid (real sold counts) */}
      {!authLoading && !showPersonalRecs && !productsData.loading && popularProducts.length > 0 && (
        <section className="border-b border-slate-100 bg-white">
          <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold tracking-tight text-slate-900">
                {t("home.trendingTitle")}
              </h2>
              <Link
                to="/products"
                className="hidden shrink-0 items-center gap-1 text-sm font-medium text-[#10B981] hover:text-emerald-700 sm:inline-flex"
              >
                {t("common.viewAll")}
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {popularProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onOpen={(p) => openProduct(p, "home-trending")}
                  onAdd={handleAdd}
                />
              ))}
            </div>
          </div>
        </section>
      )}
      {/* VelRepeat — slim strip (first-class feature, low clutter) */}
      <section className="border-b border-slate-100 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-3 px-4 py-5 sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#ECFDF5] text-[#10B981]">
              <RefreshCw className="size-4" />
            </span>
            <div>
              <p className="text-sm font-bold text-slate-900">{t("home.velrepeatTitle")}</p>
              <p className="mt-0.5 text-xs leading-5 text-slate-500">{t("home.velrepeatDesc")}</p>
            </div>
          </div>
          <Button
            className="h-9 shrink-0 gap-1.5 rounded-full bg-[#10B981] px-4 text-white hover:bg-emerald-700"
            asChild
          >
            <Link to={isAuthenticated ? "/velrepeat" : "/auth?returnTo=/velrepeat"}>
              {t("home.velrepeatCta")}
            </Link>
          </Button>
        </div>
      </section>
      {/* Loading / empty fallback for the catalog */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {productsData.loading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-[#ECFDF5]">
              <ShoppingBag className="size-7 text-[#10B981]" />
            </span>
            <h2 className="mt-5 text-lg font-semibold text-slate-900">{t("home.emptyTitle")}</h2>
            <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-500">{t("home.emptyDesc")}</p>
          </div>
        ) : null}
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
