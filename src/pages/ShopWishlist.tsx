import { ShopHeader } from "@/components/shop/ShopHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { useCart } from "@/lib/cart";
import { formatBaht, type StoreProduct } from "@/lib/commerce";
import { useAction } from "convex/react";
import { Heart, ImageOff, Loader2, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

interface WishlistItemRow {
  id: string;
  productId: string;
  createdAt: string;
}

export default function ShopWishlist() {
  const myWishlist = useAction(api.customer.myWishlist);
  const toggleWishlist = useAction(api.customer.toggleWishlistAction);
  const listProducts = useAction(api.commerce.listProducts);
  const { add } = useCart();

  const [items, setItems] = useState<WishlistItemRow[] | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [wl, prods] = await Promise.all([
        myWishlist(),
        listProducts({ status: "published", limit: 100 }),
      ]);
      setItems((wl ?? []) as WishlistItemRow[]);
      setProducts(prods as StoreProduct[]);
    } catch (err) {
      console.error("Load wishlist error:", err);
      setItems([]);
    }
  }, [myWishlist, listProducts]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    if (!items) return [];
    const byId = new Map(products.map((p) => [p.id, p]));
    return items
      .map((i) => ({ item: i, product: byId.get(i.productId) }))
      .filter((r) => r.product !== undefined);
  }, [items, products]);

  const handleRemove = async (productId: string) => {
    setBusyId(productId);
    try {
      await toggleWishlist({ productId });
      setItems((prev) => prev?.filter((i) => i.productId !== productId) ?? null);
      toast.success("นำออกจากรายการโปรดแล้ว");
    } catch (err) {
      console.error("Wishlist remove error:", err);
      toast.error("ไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setBusyId(null);
    }
  };

  const handleAdd = (product: StoreProduct) => {
    add(
      { id: product.id, name: product.name, unit: product.unit, price: product.price, stock: product.inventory?.available ?? product.inventory?.quantity ?? 0 },
      1,
    );
    toast.success(`เพิ่ม "${product.name}" ลงตะกร้าแล้ว`);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <ShopHeader />

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-slate-400">
            <Heart className="size-4 text-[#10B981]" />
            velshop · รายการโปรด
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">รายการโปรดของฉัน</h1>
          <p className="mt-1.5 text-sm text-slate-500">สินค้าที่คุณกดหัวใจไว้ — พร้อมสั่งได้ทันที</p>
        </div>

        {items === null ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-2xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-20 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-slate-100">
              <Heart className="size-7 text-slate-400" />
            </span>
            <h2 className="mt-5 text-lg font-semibold text-slate-900">ยังไม่มีรายการโปรด</h2>
            <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-500">
              กดหัวใจที่สินค้าที่ชอบ ระบบจะเก็บไว้ที่นี่ให้คุณ
            </p>
            <Button className="mt-6 gap-1.5 bg-slate-900 text-white hover:bg-slate-800" asChild>
              <Link to="/shop">
                <ShoppingBag className="size-4" />
                ไปเลือกสินค้า
              </Link>
            </Button>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {rows.map(({ product }) => (
              <div
                key={product!.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(15,23,42,0.07)]"
              >
                <Link to={`/shop/products/${product!.id}`} className="block aspect-square w-full overflow-hidden bg-slate-50">
                  {product!.primaryImage ? (
                    <img
                      src={product!.primaryImage.displayUrl}
                      alt={product!.name}
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
                  <Link to={`/shop/products/${product!.id}`} className="line-clamp-2 text-sm font-semibold leading-5 text-slate-900 hover:text-[#10B981]">
                    {product!.name}
                  </Link>
                  <p className="mt-1 text-xs text-slate-400">{product!.shopName ?? "ร้านค้า Velnox"}</p>
                  <div className="mt-3 flex items-end justify-between gap-2 border-t border-slate-100 pt-3">
                    <p className="text-base font-bold tabular-nums tracking-tight text-slate-900">
                      {formatBaht(product!.price)}
                      <span className="ml-1 text-[11px] font-normal text-slate-400">/ {product!.unit}</span>
                    </p>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8 border-slate-200 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500"
                        onClick={() => void handleRemove(product!.id)}
                        disabled={busyId === product!.id}
                        aria-label={`ลบ ${product!.name} ออกจากรายการโปรด`}
                      >
                        {busyId === product!.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                      </Button>
                      <Button
                        size="icon"
                        className="size-8 bg-slate-900 text-white hover:bg-slate-800"
                        disabled={(product!.inventory?.available ?? product!.inventory?.quantity ?? 0) <= 0}
                        onClick={() => handleAdd(product!)}
                        aria-label={`เพิ่ม ${product!.name} ลงตะกร้า`}
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
