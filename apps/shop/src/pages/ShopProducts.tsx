import { ShopHeader } from "@/components/shop/ShopHeader";
import { Badge } from "@velnox/shared/components/ui/badge";
import { Button } from "@velnox/shared/components/ui/button";
import { Checkbox } from "@velnox/shared/components/ui/checkbox";
import { Input } from "@velnox/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@velnox/shared/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@velnox/shared/components/ui/sheet";
import { Skeleton } from "@velnox/shared/components/ui/skeleton";
import { api } from "@convex/_generated/api";
import { useCart } from "@/lib/cart";
import { useTracking } from "@velnox/shared/lib/track";
import {
  PRODUCT_CATEGORY_META,
  formatBaht,
  type StoreProduct,
  type StoreProductCategory,
} from "@velnox/shared/lib/commerce";
import { setSeo } from "@/lib/seo";
import { useAction } from "convex/react";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  ImageOff,
  PackageSearch,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Store,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";

const PAGE_SIZE = 24;

const CATEGORY_OPTIONS: Array<{ id: StoreProductCategory | "all"; label: string }> = [
  { id: "all", label: "ทั้งหมด" },
  ...Object.entries(PRODUCT_CATEGORY_META).map(([id, meta]) => ({
    id: id as StoreProductCategory,
    label: meta.label,
  })),
];

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "newest", label: "ใหม่ล่าสุด" },
  { value: "price_asc", label: "ราคา: ต่ำ → สูง" },
  { value: "price_desc", label: "ราคา: สูง → ต่ำ" },
  { value: "popular", label: "ขายดีที่สุด" },
  { value: "rating", label: "คะแนนรีวิว" },
];

interface ShopRow {
  id: string;
  name: string;
  productCount: number;
}

interface CatalogResult {
  items: StoreProduct[];
  total: number;
}

export default function ShopProducts() {
  const [params, setParams] = useSearchParams();
  const catalog = useAction(api.commerce.catalogProductsAction);
  const publicShops = useAction(api.customer.publicShops);
  const { add } = useCart();
  const { track } = useTracking();

  const q = params.get("q") ?? "";
  const category = params.get("category") ?? "all";
  const shopId = params.get("shop") ?? "";
  const minPrice = params.get("min") ?? "";
  const maxPrice = params.get("max") ?? "";
  const inStock = params.get("inStock") === "1";
  const sortBy = params.get("sort") ?? "newest";
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);

  const [data, setData] = useState<CatalogResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [queryInput, setQueryInput] = useState(q);

  // live search box → URL param (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      if (queryInput.trim() === q) return;
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (queryInput.trim()) next.set("q", queryInput.trim());
          else next.delete("q");
          next.delete("page");
          return next;
        },
        { replace: true },
      );
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = (await catalog({
        q: q || undefined,
        category: category !== "all" ? category : undefined,
        shopId: shopId || undefined,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        inStock: inStock || undefined,
        sortBy,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      })) as unknown as CatalogResult;
      setData(result);
    } catch (err) {
      console.error("Catalog error:", err);
      setError(err instanceof Error ? err.message : "โหลดสินค้าไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [catalog, q, category, shopId, minPrice, maxPrice, inStock, sortBy, page]);

  useEffect(() => {
    const categoryLabel =
      category !== "all" ? (PRODUCT_CATEGORY_META[category as StoreProductCategory]?.label ?? category) : null;
    setSeo({
      title: categoryLabel
        ? `สินค้าหมวด ${categoryLabel} — VelShop`
        : q
          ? `ค้นหา "${q}" — VelShop`
          : "สินค้าทั้งหมด — VelShop",
      description: `สินค้าจากร้านค้าจริงทั่วตลาด Velnox${categoryLabel ? ` หมวด ${categoryLabel}` : ""} — ราคาและสต็อกอัปเดตจากร้านค้า`,
    });
  }, [q, category]);

  useEffect(() => {
    void load();
  }, [load]);

  // CPNS: completed searches + category views are interest signals.
  const lastSearchTracked = useRef("");
  useEffect(() => {
    const term = q.trim();
    if (term && term !== lastSearchTracked.current) {
      lastSearchTracked.current = term;
      track("SEARCH", { value: term.slice(0, 60) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const lastCategoryTracked = useRef<string | null>(null);
  useEffect(() => {
    if (category === "all" || category === lastCategoryTracked.current) return;
    lastCategoryTracked.current = category;
    track("CATEGORY_VIEW", {
      entityId: category,
      value: category,
      context: { label: PRODUCT_CATEGORY_META[category as StoreProductCategory]?.label },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  useEffect(() => {
    if (shops.length > 0) return;
    publicShops()
      .then((rows) => setShops((rows ?? []) as unknown as ShopRow[]))
      .catch(() => setShops([]));
  }, [publicShops, shops.length]);

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === null || value === "" || value === "all") next.delete(key);
          else next.set(key, value);
          next.delete("page");
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const resetFilters = () => {
    setQueryInput("");
    setParams(new URLSearchParams(), { replace: true });
  };

  const hasFilters =
    q !== "" || category !== "all" || shopId !== "" || minPrice !== "" || maxPrice !== "" || inStock;

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));
  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) pages.push(i);
    return pages;
  }, [page, totalPages]);

  const FiltersPanel = (
    <div className="space-y-6">
      {/* Category */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">หมวดหมู่</p>
        <div className="mt-3 flex flex-wrap gap-1.5 lg:flex-col lg:items-start lg:gap-1">
          {CATEGORY_OPTIONS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => updateParam("category", c.id === "all" ? null : c.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors lg:w-full lg:rounded-[10px] lg:text-left ${
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

      {/* Shop */}
      <div>
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <Store className="size-3.5" />
          ร้านค้า
        </p>
        <Select value={shopId || "all"} onValueChange={(val) => updateParam("shop", val === "all" ? null : val)}>
          <SelectTrigger className="mt-3 h-9 w-full rounded-[10px] border-slate-200 text-sm">
            <SelectValue placeholder="ร้านค้าทั้งหมด" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ร้านค้าทั้งหมด</SelectItem>
            {shops.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Price */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">ช่วงราคา (฿)</p>
        <div className="mt-3 flex items-center gap-2">
          <Input
            type="number"
            min={0}
            value={minPrice}
            onChange={(e) => updateParam("min", e.target.value || null)}
            placeholder="ต่ำสุด"
            className="h-9 rounded-[10px] border-slate-200 text-sm"
          />
          <span className="text-slate-300">–</span>
          <Input
            type="number"
            min={0}
            value={maxPrice}
            onChange={(e) => updateParam("max", e.target.value || null)}
            placeholder="สูงสุด"
            className="h-9 rounded-[10px] border-slate-200 text-sm"
          />
        </div>
      </div>

      {/* Availability */}
      <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-600">
        <Checkbox
          checked={inStock}
          onCheckedChange={(v) => updateParam("inStock", v ? "1" : null)}
          className="border-slate-300 data-[state=checked]:bg-[#10B981] data-[state=checked]:border-[#10B981]"
        />
        มีสินค้าพร้อมส่งเท่านั้น
      </label>

      {hasFilters && (
        <Button
          variant="outline"
          className="w-full gap-1.5 border-slate-200 text-slate-500"
          onClick={resetFilters}
        >
          <RotateCcw className="size-3.5" />
          ล้างตัวกรอง
        </Button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <ShopHeader />

      {/* Page header */}
      <section className="border-b border-slate-100 bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
          <p className="flex items-center gap-1.5 text-sm font-medium text-slate-400">
            <PackageSearch className="size-4 text-[#10B981]" />
            ค้นหาสินค้าทั่วตลาด Velnox
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">สินค้าทั้งหมด</h1>

          <div className="relative mt-5 w-full sm:max-w-xl">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="ค้นหาสินค้า หมวดหมู่ หรือร้านค้า..."
              className="h-11 rounded-[12px] border-slate-200 bg-white pl-10 pr-9"
            />
            {queryInput && (
              <button
                type="button"
                onClick={() => setQueryInput("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                aria-label="ล้างคำค้นหา"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
          {/* Sidebar (desktop) */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-2xl border border-slate-200 bg-white p-5">{FiltersPanel}</div>
          </aside>

          {/* Results */}
          <div>
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-500">
                {loading ? (
                  "กำลังโหลด..."
                ) : (
                  <>
                    พบ <span className="font-semibold text-slate-900">{data?.total ?? 0}</span> สินค้า
                    {q && (
                      <>
                        {" "}
                        สำหรับ “<span className="font-medium text-slate-900">{q}</span>”
                      </>
                    )}
                  </>
                )}
              </p>
              <div className="flex items-center gap-2">
                {/* Mobile filter */}
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" className="gap-1.5 border-slate-200 text-slate-600 lg:hidden">
                      <SlidersHorizontal className="size-4" />
                      ตัวกรอง
                      {hasFilters && <span className="size-1.5 rounded-full bg-[#10B981]" />}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[300px] overflow-y-auto bg-white">
                    <SheetHeader>
                      <SheetTitle className="flex items-center gap-2 text-slate-900">
                        <Filter className="size-4 text-[#10B981]" />
                        ตัวกรองสินค้า
                      </SheetTitle>
                    </SheetHeader>
                    <div className="mt-6">{FiltersPanel}</div>
                  </SheetContent>
                </Sheet>

                <Select value={sortBy} onValueChange={(val) => updateParam("sort", val)}>
                  <SelectTrigger className="h-9 w-[180px] rounded-[10px] border-slate-200 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Grid */}
            <div className="mt-5">
              {loading ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <Skeleton key={i} className="h-80 rounded-2xl" />
                  ))}
                </div>
              ) : error ? (
                <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
                  <PackageSearch className="size-8 text-slate-300" />
                  <h2 className="mt-4 text-lg font-semibold text-slate-900">โหลดสินค้าไม่สำเร็จ</h2>
                  <p className="mt-1.5 text-sm text-slate-500">{error}</p>
                  <Button className="mt-6 bg-slate-900 text-white hover:bg-slate-800" onClick={() => void load()}>
                    ลองอีกครั้ง
                  </Button>
                </div>
              ) : data && data.items.length === 0 ? (
                <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
                  <Search className="size-8 text-slate-300" />
                  <h2 className="mt-4 text-lg font-semibold text-slate-900">ไม่พบสินค้าที่ตรงเงื่อนไข</h2>
                  <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-500">
                    ลองเปลี่ยนคำค้นหา ลดช่วงราคา หรือล้างตัวกรองดูนะครับ
                  </p>
                  {hasFilters && (
                    <Button variant="outline" className="mt-6 gap-1.5 border-slate-200 text-slate-600" onClick={resetFilters}>
                      <RotateCcw className="size-3.5" />
                      ล้างตัวกรอง
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {(data?.items ?? []).map((product) => {
                      const available = product.inventory?.available ?? product.inventory?.quantity ?? 0;
                      const outOfStock = available <= 0;
                      return (
                        <div
                          key={product.id}
                          className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(15,23,42,0.07)]"
                        >
                          <Link
                            to={`/shop/products/${product.id}`}
                            className="block aspect-square w-full overflow-hidden bg-slate-50"
                            aria-label={`ดูรายละเอียด ${product.name}`}
                            onClick={() =>
                              track("PRODUCT_CLICK", {
                                entityId: product.id,
                                value: product.name,
                                context: { category: product.category },
                              })
                            }
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
                          </Link>
                          <div className="flex flex-1 flex-col p-4">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-slate-900">
                                {product.name}
                              </h3>
                              <Badge className="shrink-0 rounded-full bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-600/10 hover:bg-slate-100">
                                {PRODUCT_CATEGORY_META[product.category].label}
                              </Badge>
                            </div>
                            {product.shopName && (
                              <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                                <Store className="size-3" />
                                {product.shopName}
                              </p>
                            )}
                            <p className="mt-3 text-lg font-bold tabular-nums tracking-tight text-slate-900">
                              {formatBaht(product.price)}
                              <span className="ml-1 text-xs font-normal text-slate-400">/ {product.unit}</span>
                            </p>
                            <p
                              className={`mt-1 text-xs ${
                                outOfStock ? "font-medium text-red-500" : "text-slate-400"
                              }`}
                            >
                              {outOfStock ? "หมดชั่วคราว" : `เหลือ ${available} ${product.unit}`}
                            </p>
                            <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
                              <Button
                                size="sm"
                                className="flex-1 gap-1.5 bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                                disabled={outOfStock || product.price <= 0}
                                onClick={() => {
                                  add(
                                    { id: product.id, name: product.name, unit: product.unit, price: product.price, stock: available },
                                    1,
                                  );
                                  toast.success(`เพิ่ม "${product.name}" ลงตะกร้าแล้ว`);
                                }}
                              >
                                <Plus className="size-3.5" />
                                ใส่ตะกร้า
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="mt-8 flex items-center justify-center gap-1">
                      <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() => updateParam("page", String(page - 1))}
                        className="flex size-9 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900 disabled:opacity-40"
                        aria-label="หน้าก่อนหน้า"
                      >
                        <ChevronLeft className="size-4" />
                      </button>
                      {pageNumbers[0] > 1 && <span className="px-1 text-xs text-slate-400">…</span>}
                      {pageNumbers.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => updateParam("page", String(p))}
                          className={`flex size-9 items-center justify-center rounded-[10px] text-sm font-medium transition-colors ${
                            p === page
                              ? "bg-slate-900 text-white"
                              : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                          }`}
                          aria-label={`หน้า ${p}`}
                        >
                          {p}
                        </button>
                      ))}
                      {pageNumbers[pageNumbers.length - 1] < totalPages && (
                        <span className="px-1 text-xs text-slate-400">…</span>
                      )}
                      <button
                        type="button"
                        disabled={page >= totalPages}
                        onClick={() => updateParam("page", String(page + 1))}
                        className="flex size-9 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900 disabled:opacity-40"
                        aria-label="หน้าถัดไป"
                      >
                        <ChevronRight className="size-4" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
