import { ShopHeader } from "@/components/shop/ShopHeader";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/lib/cart";
import { formatBaht } from "@/lib/commerce";
import { useAction } from "convex/react";
import {
  ArrowLeft,
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
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof lines>();
    for (const line of lines) {
      const key = line.shopName ?? "ร้านค้า Velnox";
      const list = map.get(key) ?? [];
      list.push(line);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [lines]);

  const handleSetQty = async (productId: string, qty: number) => {
    setBusyId(productId);
    setQty(productId, qty);
    setBusyId(null);
  };

  const handleCheckout = () => {
    if (!isAuthenticated) {
      navigate("/auth?returnTo=/shop/checkout");
      return;
    }
    navigate("/shop/checkout");
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <ShopHeader />

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="size-9 text-slate-500" asChild>
            <Link to="/shop" aria-label="กลับไปหน้าร้าน">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">ตะกร้าสินค้า</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {syncing
                ? "กำลังโหลดตะกร้า..."
                : count > 0
                  ? `มีสินค้า ${count} ชิ้น จาก ${grouped.length} ร้าน`
                  : "สินค้าของคุณทั้งหมดอยู่ที่นี่"}
            </p>
          </div>
        </div>

        {syncing ? (
          <div className="mt-10 flex items-center justify-center gap-2 text-sm text-slate-400">
            <Loader2 className="size-4 animate-spin" />
            กำลังโหลดตะกร้า...
          </div>
        ) : lines.length === 0 ? (
          <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-20 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-slate-100">
              <ShoppingBag className="size-7 text-slate-400" />
            </span>
            <h2 className="mt-5 text-lg font-semibold text-slate-900">ตะกร้ายังว่างเปล่า</h2>
            <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-500">
              ไปเลือกสินค้าในหน้าร้าน แล้วกด "ใส่ตะกร้า" ได้เลย
            </p>
            <Button className="mt-6 gap-1.5 bg-slate-900 text-white hover:bg-slate-800" asChild>
              <Link to="/shop">
                <ShoppingBag className="size-4" />
                ไปเลือกสินค้า
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
                            to={`/shop/products/${line.productId}`}
                            className="block truncate text-sm font-semibold text-slate-900 hover:text-[#10B981]"
                          >
                            {line.name}
                          </Link>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {formatBaht(line.price)} / {line.unit}
                            {line.qty >= line.stock && (
                              <span className="ml-2 font-medium text-amber-600">ถึงสต็อกสูงสุดแล้ว</span>
                            )}
                          </p>
                          <div className="mt-2 flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="size-6 border-slate-200 text-slate-600"
                              onClick={() => void handleSetQty(line.productId, line.qty - 1)}
                              disabled={busyId === line.productId}
                              aria-label="ลดจำนวน"
                            >
                              <Minus className="size-3" />
                            </Button>
                            <span className="w-8 text-center text-sm font-semibold tabular-nums text-slate-900">
                              {line.qty}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="size-6 border-slate-200 text-slate-600"
                              onClick={() => void handleSetQty(line.productId, line.qty + 1)}
                              disabled={busyId === line.productId || line.qty >= line.stock}
                              aria-label="เพิ่มจำนวน"
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
                            className="size-7 text-slate-400 hover:text-red-600"
                            onClick={() => remove(line.productId)}
                            aria-label={`ลบ ${line.name}`}
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
                <h2 className="text-base font-bold tracking-tight text-slate-900">สรุปคำสั่งซื้อ</h2>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">สินค้า ({count} ชิ้น)</span>
                    <span className="font-medium tabular-nums text-slate-900">{formatBaht(total)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">ค่าจัดส่ง</span>
                    <span className="text-slate-400">คำนวณที่ขั้นตอนถัดไป</span>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                  <span className="text-sm font-medium text-slate-500">รวมทั้งสิ้น</span>
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
                  ไปชำระเงิน
                </Button>
                <p className="mt-3 flex items-center justify-center gap-1 text-center text-[11px] text-slate-400">
                  <ShieldCheck className="size-3.5 text-[#10B981]" />
                  ราคาจะถูกตรวจสอบอีกครั้งจากระบบก่อนยืนยันออเดอร์
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
