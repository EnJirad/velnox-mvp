import { ShopHeader } from "@/components/shop/ShopHeader";
import { SubscriptionDialog } from "@/components/shop/SubscriptionDialog";
import { ProductDetailModal } from "@/components/shop/ProductDetailModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/lib/cart";
import {
  PRODUCT_CATEGORY_META,
  formatBaht,
  type StoreProduct,
  type StoreProductCategory,
} from "@/lib/commerce";
import { useAction } from "convex/react";
import { motion } from "framer-motion";
import {
  CalendarClock,
  Heart,
  History,
  ImageOff,
  Megaphone,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

const CATEGORIES: { id: StoreProductCategory | "all"; label: string }[] = [
  { id: "all", label: "ทั้งหมด" },
  ...Object.entries(PRODUCT_CATEGORY_META).map(([id, meta]) => ({
    id: id as StoreProductCategory,
    label: meta.label,
  })),
];

interface InterestRow {
  product: StoreProduct;
  views?: number;
  times?: number;
  lastOrderedAt?: number;
}

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
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const listProducts = useAction(api.commerce.listProducts);
  const popularAction = useAction(api.commerce.popularProducts);
  const interestsAction = useAction(api.commerce.customerInterests);
  const regularsAction = useAction(api.commerce.customerRegulars);
  const publicShops = useAction(api.customer.publicShops);
  const recordInterest = useAction(api.commerce.recordInterest);
  const settings = useQueryLegacySettings();
  const { add } = useCart();

  const productsData = useCommerceData(
    useCallback(() => listProducts({ status: "published", limit: 100 }), [listProducts]),
  );
  const shopsData = useCommerceData(
    useCallback(() => publicShops(), [publicShops]),
  );
  const popularData = useCommerceData(
    useCallback(() => popularAction(), [popularAction]),
  );
  const interestsData = useCommerceData(
    useCallback(() => interestsAction(), [interestsAction]),
  );
  const regularsData = useCommerceData(
    useCallback(() => regularsAction(), [regularsAction]),
  );

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<StoreProductCategory | "all">("all");
  const [detailProduct, setDetailProduct] = useState<StoreProduct | null>(null);
  const [subProduct, setSubProduct] = useState<StoreProduct | null>(null);

  const products = useMemo(() => productsData.data ?? [], [productsData.data]);
  const popular = useMemo(() => popularData.data ?? [], [popularData.data]);
  const interests = useMemo(() => interestsData.data ?? [], [interestsData.data]);
  const regulars = useMemo(() => regularsData.data ?? [], [regularsData.data]);
  const shops = useMemo(() => shopsData.data ?? [], [shopsData.data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, query, category]);

  // Personalized recommendations: this customer's own interests when signed
  // in, otherwise what everyone is clicking (VelRepeat).
  const recSource: InterestRow[] =
    isAuthenticated && interests.length > 0 ? interests : popular;
  const regularIds = useMemo(
    () => new Set(regulars.map((r) => r.product.id)),
    [regulars],
  );
  const recommendations = useMemo(
    () => recSource.filter((r) => !regularIds.has(r.product.id)),
    [recSource, regularIds],
  );

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
    toast.success(`เพิ่ม "${product.name}" ลงตะกร้าแล้ว`);
  };

  const handleInterest = async (product: StoreProduct) => {
    toast.success(`บันทึกความสนใจ "${product.name}" แล้ว 💚`, {
      description: "Velnox จะแนะนำสินค้าแบบนี้ให้คุณบ่อยขึ้น",
    });
    try {
      await recordInterest({ productId: product.id });
    } catch (error) {
      console.error("Record interest error:", error);
    }
  };

  const shopName = settings?.shopName || "Velnox Shop";
  const tagline =
    settings?.tagline || "Commerce that remembers you · จำแทนคุณ";

  const stockOf = (p: StoreProduct) => p.inventory?.available ?? p.inventory?.quantity ?? 0;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <ShopHeader />

      {/* Storefront hero */}
      <section className="border-b border-slate-100 bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="flex items-center gap-1.5 text-sm font-medium text-slate-400">
                <Store className="size-4 text-[#10B981]" />
                velshop · ตลาดออนไลน์ Velnox
              </p>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                {shopName}
              </h1>
              <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">{tagline}</p>
              {settings?.announcement && (
                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-[#ECFDF5] px-3 py-1.5 text-xs font-medium text-emerald-700">
                  <Megaphone className="size-3.5" />
                  {settings.announcement}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <p className="text-xs text-slate-400">สินค้าที่มีจำหน่าย</p>
              <p className="text-3xl font-bold tabular-nums tracking-tight text-slate-900">
                {products.length}
                <span className="ml-1 text-sm font-medium text-slate-400">รายการ</span>
              </p>
            </div>
          </div>

          {/* Search + category filter */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ค้นหาสินค้า..."
                className="rounded-[10px] border-slate-200 bg-white pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    category === c.id
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Customer Memory — Velnox remembers this customer's regular items */}
      {!authLoading && isAuthenticated && !regularsData.loading && regulars.length > 0 && (
        <section className="border-b border-slate-100 bg-white">
          <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-[10px] bg-[#ECFDF5]">
                <History className="size-4 text-[#10B981]" />
              </span>
              <div>
                <h2 className="text-base font-bold tracking-tight text-slate-900">
                  Velnox จำคุณได้ — สินค้าที่คุณสั่งประจำ
                </h2>
                <p className="text-xs text-slate-400">
                  อิงจากออเดอร์ของคุณเอง · กดสั่งซื้อซ้ำได้ในคลิกเดียว
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {regulars.map(({ product, times, lastOrderedAt }, i) => (
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
                      <Badge className="shrink-0 gap-1 rounded-full bg-[#ECFDF5] text-emerald-700 ring-1 ring-inset ring-emerald-600/15 hover:bg-[#ECFDF5]">
                        สั่งแล้ว {times} ครั้ง
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {lastOrderedAt ? `สั่งล่าสุด ${new Date(lastOrderedAt).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}` : ""}
                    </p>
                    <div className="mt-3 flex items-end justify-between gap-2 border-t border-slate-100 pt-3">
                      <p className="text-sm font-bold tabular-nums tracking-tight text-slate-900">
                        {formatBaht(product.price)}
                        <span className="ml-1 text-[11px] font-normal text-slate-400">/ {product.unit}</span>
                      </p>
                      <Button
                        size="sm"
                        className="gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
                        onClick={() => handleAdd(product)}
                      >
                        <Plus className="size-3.5" />
                        สั่งซื้ออีกครั้ง
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* VelRepeat — แนะนำสำหรับคุณ */}
      {!authLoading && recommendations.length > 0 && (
        <section className="border-b border-slate-100 bg-white">
          <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-[10px] bg-[#ECFDF5]">
                <Sparkles className="size-4 text-[#10B981]" />
              </span>
              <div>
                <h2 className="text-base font-bold tracking-tight text-slate-900">
                  {isAuthenticated ? "แนะนำสำหรับคุณ" : "สินค้ายอดนิยม"}
                </h2>
                <p className="text-xs text-slate-400">
                  {isAuthenticated
                    ? "Velnox เลือกให้จากสิ่งที่คุณสนใจและสั่งบ่อย"
                    : "จากยอดคลิกของลูกค้าทั่วตลาด (VelRepeat)"}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {recommendations.slice(0, 8).map(({ product, views }, i) => (
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
                      <h3 className="text-sm font-semibold leading-5 text-slate-900">{product.name}</h3>
                      <Badge className="shrink-0 gap-1 rounded-full bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-600/10 hover:bg-slate-100">
                        <Sparkles className="size-3" />
                        {views ?? 0} คลิก
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">
                      {product.description || PRODUCT_CATEGORY_META[product.category].label}
                    </p>
                    <div className="mt-3 flex items-end justify-between gap-2 border-t border-slate-100 pt-3">
                      <p className="text-sm font-bold tabular-nums tracking-tight text-slate-900">
                        {formatBaht(product.price)}
                        <span className="ml-1 text-[11px] font-normal text-slate-400">/ {product.unit}</span>
                      </p>
                      <Button
                        size="sm"
                        className="gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
                        onClick={() => handleAdd(product)}
                      >
                        <Plus className="size-3.5" />
                        เพิ่มตะกร้า
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
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
                <h2 className="text-base font-bold tracking-tight text-slate-900">ร้านค้าในตลาด</h2>
                <p className="text-xs text-slate-400">เลือกซื้อตรงจากร้านค้าที่ตรวจสอบแล้ว</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {shops.slice(0, 8).map((shop, i) => (
                <Link
                  key={shop.id}
                  to={`/shop/shops/${shop.id}`}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#10B981]/40 hover:shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
                >
                  <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-[#ECFDF5]">
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
                      <span>{shop.productCount} สินค้า</span>
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Product grid */}
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        {productsData.loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-[#ECFDF5]">
              <ShoppingBag className="size-7 text-[#10B981]" />
            </span>
            <h2 className="mt-5 text-lg font-semibold text-slate-900">ร้านยังไม่มีสินค้า</h2>
            <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-500">
              ร้านค้ายังไม่ได้ประกาศขายสินค้า — เชิญกลับมาใหม่เร็ว ๆ นี้
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <Search className="size-8 text-slate-300" />
            <h2 className="mt-4 text-lg font-semibold text-slate-900">ไม่พบสินค้า</h2>
            <p className="mt-1.5 text-sm text-slate-500">ลองค้นหาหรือเปลี่ยนหมวดหมู่ดูนะครับ</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {filtered.map((product, i) => {
              const outOfStock = stockOf(product) <= 0;
              const lowStock = !outOfStock && stockOf(product) <= 5;
              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3) }}
                  className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(15,23,42,0.07)]"
                >
                  <Link
                    to={`/shop/products/${product.id}`}
                    className="block aspect-square w-full overflow-hidden bg-slate-50"
                    aria-label={`ดูรายละเอียด ${product.name}`}
                  >
                    {product.primaryImage ? (
                      <img
                        src={product.primaryImage.displayUrl}
                        alt={product.primaryImage.alt || product.name}
                        className="size-full object-cover transition-transform duration-300 hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <span className="flex size-full items-center justify-center">
                        <ImageOff className="size-8 text-slate-300" />
                      </span>
                    )}
                    {product.images && product.images.length > 1 && (
                      <span className="absolute right-2 top-2 rounded-full bg-slate-900/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                        {product.images.length} รูป
                      </span>
                    )}
                  </Link>

                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold leading-5 text-slate-900">{product.name}</h3>
                      <Badge className="shrink-0 rounded-full bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-600/10 hover:bg-slate-100">
                        {PRODUCT_CATEGORY_META[product.category].label}
                      </Badge>
                    </div>
                    {product.description ? (
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{product.description}</p>
                    ) : (
                      <p className="mt-1 text-xs text-slate-300">
                        {product.shopName ?? "ร้านค้า Velnox"}
                      </p>
                    )}

                    <div className="mt-4">
                      <p className="text-lg font-bold tabular-nums tracking-tight text-slate-900">
                        {formatBaht(product.price)}
                        <span className="ml-1 text-xs font-normal text-slate-400">/ {product.unit}</span>
                      </p>
                    </div>

                    <p
                      className={`mt-1.5 text-xs ${
                        outOfStock
                          ? "font-medium text-red-500"
                          : lowStock
                            ? "font-medium text-amber-600"
                            : "text-slate-400"
                      }`}
                    >
                      {outOfStock
                        ? "หมดชั่วคราว"
                        : lowStock
                          ? `เหลือน้อย — ${stockOf(product)} ${product.unit}`
                          : `เหลือ ${stockOf(product)} ${product.unit}`}
                    </p>

                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-9 shrink-0 border-slate-200 text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-500"
                        onClick={() => handleInterest(product)}
                        aria-label={`สนใจ ${product.name}`}
                      >
                        <Heart className="size-4" />
                      </Button>
                      <Button
                        className="flex-1 gap-1.5 bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                        disabled={outOfStock || product.price <= 0}
                        onClick={() => handleAdd(product)}
                      >
                        <Plus className="size-4" />
                        ใส่ตะกร้า
                      </Button>
                    </div>

                    {!outOfStock && product.price > 0 && (
                      <Button
                        variant="ghost"
                        className="mt-1.5 h-8 w-full gap-1.5 text-xs text-slate-500 hover:bg-[#ECFDF5] hover:text-emerald-700"
                        onClick={() => setSubProduct(product)}
                      >
                        <CalendarClock className="size-3.5" />
                        สั่งรายเดือนทุก X วัน
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>

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

/** Legacy store settings (Convex storeSettings doc) — kept as-is for now. */
import { useQuery } from "convex/react";

function useQueryLegacySettings() {
  return useQuery(api.center.getSettings);
}
