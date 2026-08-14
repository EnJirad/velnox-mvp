import { ShopHeader } from "@/components/shop/ShopHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { useCart } from "@/lib/cart";
import {
  PRODUCT_CATEGORY_META,
  type Product,
  type ProductCategory,
} from "@/lib/reorder";
import { formatBaht } from "@/lib/shop";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { Megaphone, Plus, Search, ShoppingBag, Store } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const CATEGORIES: { id: ProductCategory | "all"; label: string }[] = [
  { id: "all", label: "ทั้งหมด" },
  ...Object.entries(PRODUCT_CATEGORY_META).map(([id, meta]) => ({
    id: id as ProductCategory,
    label: meta.label,
  })),
];

export default function ShopHome() {
  const products = useQuery(api.products.listPublished);
  const settings = useQuery(api.center.getSettings);
  const { add } = useCart();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ProductCategory | "all">("all");

  const filtered = useMemo(() => {
    const list = products ?? [];
    const q = query.trim().toLowerCase();
    return list.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, query, category]);

  const handleAdd = (product: Product) => {
    add(product);
    toast.success(`เพิ่ม "${product.name}" ลงตะกร้าแล้ว`);
  };

  const shopName = settings?.shopName || "Velnox Shop";
  const tagline =
    settings?.tagline || "Commerce that remembers you · จำแทนคุณ";

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
                velshop · หน้าร้านของคุณ
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
                {products?.length ?? 0}
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

      {/* Product grid */}
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        {products === undefined ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-[#ECFDF5]">
              <ShoppingBag className="size-7 text-[#10B981]" />
            </span>
            <h2 className="mt-5 text-lg font-semibold text-slate-900">ร้านยังไม่มีสินค้า</h2>
            <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-500">
              เจ้าของร้านยังไม่ได้ประกาศขายสินค้า — เชิญกลับมาใหม่เร็ว ๆ นี้
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
              const meta = PRODUCT_CATEGORY_META[product.category];
              const Icon = meta.icon;
              const outOfStock = product.currentStock <= 0;
              const lowStock = !outOfStock && product.currentStock <= 5;
              return (
                <motion.div
                  key={product._id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3) }}
                  className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(15,23,42,0.07)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`flex size-10 items-center justify-center rounded-xl ring-1 ring-inset ${meta.chip}`}
                    >
                      <Icon className={`size-5 ${meta.iconClass}`} />
                    </span>
                    <Badge className={`gap-1 rounded-full ring-1 ring-inset ${meta.chip}`}>
                      {meta.label}
                    </Badge>
                  </div>

                  <h3 className="mt-4 text-sm font-semibold leading-5 text-slate-900">
                    {product.name}
                  </h3>
                  {product.description ? (
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">
                      {product.description}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-300">{meta.label}</p>
                  )}

                  <div className="mt-4">
                    {product.price !== undefined ? (
                      <p className="text-lg font-bold tabular-nums tracking-tight text-slate-900">
                        {formatBaht(product.price)}
                        <span className="ml-1 text-xs font-normal text-slate-400">/ {product.unit}</span>
                      </p>
                    ) : (
                      <p className="text-sm font-medium text-slate-400">ราคาตามตกลง</p>
                    )}
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
                        ? `เหลือน้อย — ${product.currentStock} ${product.unit}`
                        : `เหลือ ${product.currentStock} ${product.unit}`}
                  </p>

                  <Button
                    className="mt-3 w-full gap-1.5 bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                    disabled={outOfStock || product.price === undefined}
                    onClick={() => handleAdd(product)}
                  >
                    <Plus className="size-4" />
                    ใส่ตะกร้า
                  </Button>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
