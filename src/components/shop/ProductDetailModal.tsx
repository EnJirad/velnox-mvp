import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCart } from "@/lib/cart";
import {
  PRODUCT_CATEGORY_META,
  formatBaht,
  type StoreProduct,
} from "@/lib/commerce";
import { useTracking } from "@/lib/track";
import {
  CalendarClock,
  Heart,
  ImageOff,
  Minus,
  Plus,
  ShoppingCart,
  Store,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface ProductDetailModalProps {
  product: StoreProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubscribe?: (product: StoreProduct) => void;
}

export function ProductDetailModal({ product, open, onOpenChange, onSubscribe }: ProductDetailModalProps) {
  const { add } = useCart();
  const { track } = useTracking();
  const [activeIndex, setActiveIndex] = useState(0);
  const [qty, setQty] = useState(1);

  // CPNS: opening the quick-view modal counts as a product view.
  const viewedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open || !product || viewedRef.current === product.id) return;
    viewedRef.current = product.id;
    track("PRODUCT_VIEW", {
      entityId: product.id,
      value: product.name,
      context: { category: product.category, price: product.price, shopId: product.shopId, source: "quickview" },
    });
  }, [open, product, track]);

  if (!product) return null;

  const images = product.images ?? (product.primaryImage ? [product.primaryImage] : []);
  const active = images[activeIndex] ?? images[0];
  const inventory = product.inventory;
  const available = inventory?.available ?? inventory?.quantity ?? 0;
  const outOfStock = available <= 0;
  const lowStock = !outOfStock && available <= 5;
  const categoryMeta = PRODUCT_CATEGORY_META[product.category];

  const handleAdd = () => {
    add(
      {
        id: product.id,
        name: product.name,
        unit: product.unit,
        price: product.price,
        stock: available,
      },
      qty,
    );
    toast.success(`เพิ่ม "${product.name}" (×${qty}) ลงตะกร้าแล้ว`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="sr-only">{product.name}</DialogTitle>
          <DialogDescription className="sr-only">
            รายละเอียดสินค้า {product.name}
          </DialogDescription>
        </DialogHeader>

        <div key={product.id} className="grid gap-6 sm:grid-cols-2">
          {/* Gallery */}
          <div>
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              {active ? (
                <img
                  src={active.displayUrl || active.url}
                  alt={active.alt || product.name}
                  className="size-full object-cover"
                  loading="lazy"
                />
              ) : (
                <ImageOff className="size-12 text-slate-300" />
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
                      i === activeIndex
                        ? "border-[#10B981]"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                    aria-label={`รูปที่ ${i + 1}`}
                  >
                    <img
                      src={img.thumbUrl || img.url}
                      alt=""
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Badge className="gap-1 rounded-full bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-600/10 hover:bg-slate-100">
                  {categoryMeta.label}
                </Badge>
                <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-900">
                  {product.name}
                </h2>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                  <Store className="size-3.5" />
                  {product.shopName ?? "ร้านค้า Velnox"}
                  {product.sellerName ? ` · ${product.sellerName}` : ""}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-2xl font-bold tabular-nums tracking-tight text-slate-900">
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

            {product.description && (
              <p className="mt-4 text-sm leading-6 text-slate-500">{product.description}</p>
            )}

            <div className="mt-auto pt-6">
              {outOfStock ? (
                <Button className="w-full gap-1.5 bg-slate-100 text-slate-400 hover:bg-slate-100" disabled>
                  หมดชั่วคราว
                </Button>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 rounded-[10px] border border-slate-200 px-1.5 py-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-slate-600"
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      aria-label="ลดจำนวน"
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <span className="w-8 text-center text-sm font-semibold tabular-nums text-slate-900">
                      {qty}
                    </span>
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
                  <Button className="flex-1 gap-1.5 bg-slate-900 text-white hover:bg-slate-800" onClick={handleAdd}>
                    <ShoppingCart className="size-4" />
                    ใส่ตะกร้า · {formatBaht(product.price * qty)}
                  </Button>
                </div>
              )}

              {!outOfStock && (
                <Button
                  variant="ghost"
                  className="mt-2 h-9 w-full gap-1.5 text-xs text-slate-500 hover:bg-[#ECFDF5] hover:text-emerald-700"
                  onClick={() => onSubscribe?.(product)}
                >
                  <CalendarClock className="size-3.5" />
                  สั่งรายเดือน (VelRepeat) — ให้ระบบสั่งให้อัตโนมัติทุกช่วงเวลา
                </Button>
              )}

              <button
                type="button"
                className="mt-3 flex w-full items-center justify-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-[#10B981]"
              >
                <Heart className="size-3.5" />
                Velnox จะจำความสนใจของคุณเพื่อแนะนำสินค้าที่ใช่
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
