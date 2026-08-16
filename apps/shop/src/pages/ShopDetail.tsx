import { ShopHeader } from "@/components/shop/ShopHeader";
import { Badge } from "@velnox/shared/components/ui/badge";
import { Button } from "@velnox/shared/components/ui/button";
import { Skeleton } from "@velnox/shared/components/ui/skeleton";
import { api } from "@convex/_generated/api";
import { useCart } from "@/lib/cart";
import { formatBaht, type StoreProduct } from "@velnox/shared/lib/commerce";
import { useTracking } from "@velnox/shared/lib/track";
import { setSeo } from "@/lib/seo";
import { useAction } from "convex/react";
import { ArrowLeft, Heart, ImageOff, Package, Plus, ShieldCheck, Star, Store } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";

interface ShopRow {
  id: string;
  sellerId: string;
  name: string;
  slug: string | null;
  description: string | null;
  imageUrl: string | null;
  announcement: string | null;
  status: string;
  currency: string;
  createdAt: string;
  productCount: number;
  orderCount: number;
  rating: number | null;
  reviewCount: number;
}

export default function ShopDetail() {
  const { shopId } = useParams<{ shopId: string }>();
  const shopDetail = useAction(api.customer.shopDetail);
  const { add } = useCart();
  const { track } = useTracking();
  const [shop, setShop] = useState<ShopRow | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const res = await shopDetail({ shopId });
      setShop(res.shop as ShopRow);
      setProducts((res.products ?? []) as StoreProduct[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ไม่พบร้านค้า");
    } finally {
      setLoading(false);
    }
  }, [shopId, shopDetail]);

  useEffect(() => {
    if (!shop) return;
    setSeo({
      title: `${shop.name} — VelShop`,
      description: shop.description ?? `ร้าน ${shop.name} ในตลาด Velnox — สินค้า ${shop.productCount} รายการ`,
      ogType: "website",
    });
  }, [shop]);

  useEffect(() => {
    void load();
  }, [load]);

  // CPNS: visiting a store page = SHOP_VIEW (one per visit).
  useEffect(() => {
    if (!shop) return;
    track("SHOP_VIEW", { entityId: shop.id, value: shop.name });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop?.id]);

  const handleAdd = (product: StoreProduct) => {
    add(
      { id: product.id, name: product.name, unit: product.unit, price: product.price, stock: product.inventory?.available ?? product.inventory?.quantity ?? 0 },
      1,
    );
    toast.success(`เพิ่ม "${product.name}" ลงตะกร้าแล้ว`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
        <ShopHeader />
        <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          <Skeleton className="h-36 rounded-2xl" />
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-2xl" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (error || !shop) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
        <ShopHeader />
        <main className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 py-24 text-center sm:px-6">
          <Store className="size-10 text-slate-300" />
          <h1 className="mt-4 text-xl font-bold text-slate-900">ไม่พบร้านค้า</h1>
          <p className="mt-2 text-sm text-slate-500">{error ?? "ร้านค้าอาจถูกปิดหรือยังไม่เปิดขาย"}</p>
          <Button className="mt-6 gap-1.5 bg-slate-900 text-white hover:bg-slate-800" asChild>
            <Link to="/shop">
              <ArrowLeft className="size-4" />
              กลับไปหน้าร้าน
            </Link>
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <ShopHeader />

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <Link to="/shop" className="flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-900">
          <ArrowLeft className="size-4" />
          ย้อนกลับ
        </Link>

        {/* Shop profile */}
        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="h-28 bg-gradient-to-r from-[#0f766e] via-[#10B981] to-[#34d399]" />
          <div className="flex flex-col gap-4 px-6 pb-6 sm:flex-row sm:items-end">
            <span className="-mt-9 flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-[#ECFDF5] shadow-sm">
              {shop.imageUrl ? (
                <img src={shop.imageUrl} alt={shop.name} className="size-full object-cover" />
              ) : (
                <Store className="size-8 text-[#10B981]" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{shop.name}</h1>
                <Badge className="gap-1 rounded-full bg-[#ECFDF5] text-emerald-700 ring-1 ring-inset ring-emerald-600/15 hover:bg-[#ECFDF5]">
                  <ShieldCheck className="size-3" />
                  ร้านค้าที่ตรวจสอบแล้ว
                </Badge>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                {shop.rating != null && (
                  <span className="flex items-center gap-1">
                    <Star className="size-3.5 fill-amber-400 text-amber-400" />
                    <span className="font-semibold text-slate-900">{shop.rating.toFixed(1)}</span>
                    <span>({shop.reviewCount} รีวิว)</span>
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Package className="size-3.5" />
                  {shop.productCount} สินค้า
                </span>
                <span className="flex items-center gap-1">
                  <Heart className="size-3.5" />
                  ขายแล้ว {shop.orderCount} ออเดอร์
                </span>
              </div>
              {shop.description && (
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{shop.description}</p>
              )}
              {shop.announcement && (
                <p className="mt-2 inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                  {shop.announcement}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Products */}
        <section className="mt-8">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">สินค้าของร้าน</h2>
          {products.length === 0 ? (
            <div className="mt-4 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
              <Package className="size-7 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-600">ร้านนี้ยังไม่มีสินค้าลงขาย</p>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {products.map((product) => {
                const available = product.inventory?.available ?? product.inventory?.quantity ?? 0;
                const outOfStock = available <= 0;
                return (
                  <div
                    key={product.id}
                    className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(15,23,42,0.07)]"
                  >
                    <Link to={`/shop/products/${product.id}`} className="block aspect-square w-full overflow-hidden bg-slate-50">
                      {product.primaryImage ? (
                        <img
                          src={product.primaryImage.displayUrl}
                          alt={product.name}
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
                      <Link to={`/shop/products/${product.id}`} className="line-clamp-2 text-sm font-semibold leading-5 text-slate-900 hover:text-[#10B981]">
                        {product.name}
                      </Link>
                      <p
                        className={`mt-1.5 text-xs ${outOfStock ? "font-medium text-red-500" : "text-slate-400"}`}
                      >
                        {outOfStock ? "หมดชั่วคราว" : `เหลือ ${available} ${product.unit}`}
                      </p>
                      <div className="mt-3 flex items-end justify-between gap-2 border-t border-slate-100 pt-3">
                        <p className="text-base font-bold tabular-nums tracking-tight text-slate-900">
                          {formatBaht(product.price)}
                          <span className="ml-1 text-[11px] font-normal text-slate-400">/ {product.unit}</span>
                        </p>
                        <Button
                          size="sm"
                          className="gap-1 bg-slate-900 text-white hover:bg-slate-800"
                          disabled={outOfStock || product.price <= 0}
                          onClick={() => handleAdd(product)}
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
          )}
        </section>
      </main>
    </div>
  );
}
