import { ShopHeader } from "@/components/shop/ShopHeader";
import { SubscriptionDialog } from "@/components/shop/SubscriptionDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/lib/cart";
import {
  PRODUCT_CATEGORY_META,
  formatBaht,
  formatIsoDate,
  type StoreProduct,
} from "@/lib/commerce";
import { setSeo } from "@/lib/seo";
import { useAction } from "convex/react";
import {
  ArrowLeft,
  CalendarClock,
  Heart,
  ImageOff,
  Loader2,
  Minus,
  Plus,
  ShoppingCart,
  Star,
  Store,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

interface ReviewRow {
  id: string;
  productId: string;
  shopId: string;
  userId: string;
  orderId: string | null;
  rating: number;
  title: string | null;
  comment: string | null;
  images: string[];
  status: string;
  createdAt: string;
  customerName?: string;
}

export default function ShopProductDetail() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const getProduct = useAction(api.commerce.getProductDetail);
  const productReviews = useAction(api.customer.productReviews);
  const toggleWishlist = useAction(api.customer.toggleWishlistAction);
  const myWishlist = useAction(api.customer.myWishlist);
  const { add } = useCart();

  const [product, setProduct] = useState<StoreProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [qty, setQty] = useState(1);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [wishlisted, setWishlisted] = useState(false);
  const [wishToggling, setWishToggling] = useState(false);
  const [subOpen, setSubOpen] = useState(false);

  const load = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    try {
      const p = await getProduct({ productId });
      if (!p || p.status !== "published") {
        setProduct(null);
        return;
      }
      setProduct(p);
      const [revs, wl] = await Promise.all([
        productReviews({ productId }),
        isAuthenticated ? myWishlist() : Promise.resolve([]),
      ]);
      setReviews((revs ?? []) as ReviewRow[]);
      setWishlisted((wl ?? []).some((i: { productId: string }) => i.productId === productId));
    } catch (err) {
      console.error("Load product error:", err);
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }, [productId, getProduct, productReviews, isAuthenticated, myWishlist]);

  useEffect(() => {
    void load();
  }, [load]);

  const images = product?.images && product.images.length > 0 ? product.images : product?.primaryImage ? [product.primaryImage] : [];
  const active = images[activeIndex] ?? images[0];
  const available = product?.inventory?.available ?? product?.inventory?.quantity ?? 0;
  const outOfStock = available <= 0;
  const lowStock = !outOfStock && available <= 5;

  // SEO (spec §44) — product page gets Product structured data
  useEffect(() => {
    if (!product) return;
    const rating =
      reviews.length > 0
        ? { ratingValue: (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1), ratingCount: reviews.length }
        : undefined;
    setSeo({
      title: `${product.name} — VelShop`,
      description: product.description ?? `${product.name} ราคา ${formatBaht(product.price)}/${product.unit} ที่ร้าน ${product.shopName ?? "Velnox"}`,
      ogType: "product",
      ogImage: images[0]?.displayUrl ?? undefined,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: product.description ?? undefined,
        image: images[0]?.displayUrl ?? undefined,
        ...(rating ? { aggregateRating: { "@type": "AggregateRating", ...rating } } : {}),
        offers: {
          "@type": "Offer",
          priceCurrency: "THB",
          price: product.price,
          availability: outOfStock ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
        },
      },
    });
  }, [product, reviews, images, outOfStock]);

  const handleAdd = () => {
    if (!product) return;
    if (!isAuthenticated) {
      navigate("/auth?returnTo=" + encodeURIComponent(`/shop/products/${product.id}`));
      return;
    }
    add(
      { id: product.id, name: product.name, unit: product.unit, price: product.price, stock: available },
      qty,
    );
    toast.success(`เพิ่ม "${product.name}" (×${qty}) ลงตะกร้าแล้ว`);
  };

  const handleBuyNow = () => {
    if (!product) return;
    if (!isAuthenticated) {
      navigate("/auth?returnTo=" + encodeURIComponent(`/shop/products/${product.id}`));
      return;
    }
    add(
      { id: product.id, name: product.name, unit: product.unit, price: product.price, stock: available },
      qty,
    );
    navigate("/shop/checkout");
  };

  const handleWishlist = async () => {
    if (!product) return;
    if (!isAuthenticated) {
      navigate("/auth?returnTo=" + encodeURIComponent(`/shop/products/${product.id}`));
      return;
    }
    setWishToggling(true);
    try {
      const res = await toggleWishlist({ productId: product.id });
      setWishlisted(res.added);
      toast.success(res.added ? "เพิ่มในรายการโปรดแล้ว 💚" : "นำออกจากรายการโปรดแล้ว");
    } catch (err) {
      console.error("Wishlist error:", err);
      toast.error("บันทึกรายการโปรดไม่สำเร็จ");
    } finally {
      setWishToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
        <ShopHeader />
        <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-2">
            <Skeleton className="aspect-square rounded-2xl" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
        <ShopHeader />
        <main className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 py-24 text-center sm:px-6">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-slate-100">
            <ImageOff className="size-7 text-slate-400" />
          </span>
          <h1 className="mt-5 text-xl font-bold text-slate-900">ไม่พบสินค้า</h1>
          <p className="mt-2 text-sm text-slate-500">สินค้าอาจถูกนำออกหรือยังไม่วางขาย</p>
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

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-slate-900"
        >
          <ArrowLeft className="size-4" />
          ย้อนกลับ
        </button>

        <div className="mt-5 grid gap-8 lg:grid-cols-2">
          {/* Gallery */}
          <div>
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {active ? (
                <img
                  src={active.displayUrl || active.url}
                  alt={active.alt || product.name}
                  className="size-full object-cover"
                />
              ) : (
                <span className="flex size-full items-center justify-center">
                  <ImageOff className="size-12 text-slate-300" />
                </span>
              )}
            </div>
            {images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {images.map((img, i) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setActiveIndex(i)}
                    className={`size-16 shrink-0 overflow-hidden rounded-[10px] border-2 transition-colors ${
                      i === activeIndex ? "border-[#10B981]" : "border-slate-200 hover:border-slate-300"
                    }`}
                    aria-label={`รูปที่ ${i + 1}`}
                  >
                    <img src={img.thumbUrl || img.url} alt="" className="size-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-600/10 hover:bg-slate-100">
                    {PRODUCT_CATEGORY_META[product.category].label}
                  </Badge>
                  {product.supplier && (
                    <Badge className="rounded-full bg-[#ECFDF5] text-emerald-700 ring-1 ring-inset ring-emerald-600/15 hover:bg-[#ECFDF5]">
                      {product.supplier}
                    </Badge>
                  )}
                </div>
                <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  {product.name}
                </h1>
                <Link
                  to={`/shop/shops/${product.shopId}`}
                  className="mt-2 inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-[#10B981]"
                >
                  <Store className="size-4" />
                  {product.shopName ?? "ร้านค้า Velnox"}
                </Link>
              </div>
              <Button
                variant="outline"
                size="icon"
                className={`shrink-0 border-slate-200 ${
                  wishlisted ? "bg-rose-50 text-rose-500 hover:bg-rose-50" : "text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500"
                }`}
                onClick={handleWishlist}
                disabled={wishToggling}
                aria-label="เพิ่มในรายการโปรด"
              >
                {wishToggling ? <Loader2 className="size-4 animate-spin" /> : <Heart className={`size-4 ${wishlisted ? "fill-rose-500" : ""}`} />}
              </Button>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-3xl font-bold tabular-nums tracking-tight text-slate-900">
                    {formatBaht(product.price)}
                    <span className="ml-1 text-sm font-normal text-slate-400">/ {product.unit}</span>
                  </p>
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
                      ? "หมดชั่วคราว — สินค้าอาจกลับมามีสต็อกเร็ว ๆ นี้"
                      : lowStock
                        ? `เหลือน้อย — ${available} ${product.unit}`
                        : `เหลือ ${available} ${product.unit}`}
                  </p>
                </div>
                {reviews.length > 0 && (
                  <div className="flex items-center gap-1 text-sm">
                    <Star className="size-4 fill-amber-400 text-amber-400" />
                    <span className="font-semibold tabular-nums text-slate-900">
                      {(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)}
                    </span>
                    <span className="text-xs text-slate-400">({reviews.length} รีวิว)</span>
                  </div>
                )}
              </div>

              {product.description && (
                <p className="mt-4 whitespace-pre-line border-t border-slate-100 pt-4 text-sm leading-6 text-slate-600">
                  {product.description}
                </p>
              )}
            </div>

            <div className="mt-5 space-y-2.5">
              {outOfStock ? (
                <Button className="w-full gap-1.5 bg-slate-100 text-slate-400 hover:bg-slate-100" disabled>
                  หมดชั่วคราว
                </Button>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 rounded-[10px] border border-slate-200 bg-white px-1.5 py-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-slate-600"
                        onClick={() => setQty((q) => Math.max(1, q - 1))}
                        aria-label="ลดจำนวน"
                      >
                        <Minus className="size-3.5" />
                      </Button>
                      <span className="w-8 text-center text-sm font-semibold tabular-nums text-slate-900">{qty}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-slate-600"
                        onClick={() => setQty((q) => Math.min(available, q + 1))}
                        disabled={qty >= available}
                        aria-label="เพิ่มจำนวน"
                      >
                        <Plus className="size-3.5" />
                      </Button>
                    </div>
                    <Button
                      className="flex-1 gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
                      onClick={handleAdd}
                      disabled={product.price <= 0}
                    >
                      <ShoppingCart className="size-4" />
                      ใส่ตะกร้า · {formatBaht(product.price * qty)}
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full gap-1.5 border-slate-900 text-slate-900 hover:bg-slate-900 hover:text-white"
                    onClick={handleBuyNow}
                    disabled={product.price <= 0}
                  >
                    <Zap className="size-4" />
                    ซื้อเลย
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-9 w-full gap-1.5 text-xs text-slate-500 hover:bg-[#ECFDF5] hover:text-emerald-700"
                    onClick={() => setSubOpen(true)}
                  >
                    <CalendarClock className="size-3.5" />
                    สั่งรายเดือน (VelRepeat) — ให้ระบบสั่งให้อัตโนมัติทุกช่วงเวลา
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Reviews */}
        <section className="mt-12">
          <div className="flex items-center gap-2">
            <Star className="size-4 text-amber-400" />
            <h2 className="text-lg font-bold tracking-tight text-slate-900">รีวิวสินค้า</h2>
            {reviews.length > 0 && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                {reviews.length} รายการ
              </span>
            )}
          </div>

          {reviews.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <Star className="mx-auto size-7 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-600">ยังไม่มีรีวิว</p>
              <p className="mt-1 text-xs text-slate-400">รีวิวจะแสดงเมื่อลูกค้าที่ซื้อจริงได้รับสินค้าแล้ว</p>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {reviews.map((r) => (
                <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`size-3.5 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`}
                        />
                      ))}
                    </div>
                    <span className="text-[11px] text-slate-400">{formatIsoDate(r.createdAt)}</span>
                  </div>
                  {r.title && <p className="mt-2 text-sm font-semibold text-slate-900">{r.title}</p>}
                  {r.comment && <p className="mt-1 text-sm leading-6 text-slate-600">{r.comment}</p>}
                  <p className="mt-2 text-[11px] text-slate-400">
                    {r.customerName ?? "ลูกค้า"} · {r.orderId ? "ซื้อจริงแล้ว ✓" : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <SubscriptionDialog
        product={product}
        open={subOpen}
        onOpenChange={setSubOpen}
      />
    </div>
  );
}
